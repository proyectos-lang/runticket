-- =========================================================================
-- Cierre de la escritura directa por la API REST.
--
-- Toda la lógica de negocio del proyecto vive dentro de funciones
-- `security definer`: inscribirse_en_evento comprueba cupo, edad, inventario,
-- tramo de precio, cupón y firma; registrar_intento_pago fija el monto desde la
-- inscripción; registrar_auditoria sella el autor. Las políticas de INSERT, en
-- cambio, seguían permitiendo escribir en las tablas directamente por PostgREST,
-- saltándose esa lógica entera. Como en el proyecto no hay ningún `revoke`,
-- rigen los GRANT por defecto de Supabase y cualquier usuario con sesión podía
-- hacerlo.
--
-- Nada de esto afecta a las RPC: son `security definer` y no hay
-- `force row level security` en ninguna tabla, así que siguen escribiendo igual.
-- =========================================================================

-- ---------------------------------------------------------------------------
-- 1) Inscripciones: el corredor deja de poder insertarse a mano.
--
-- La política anterior aceptaba estado in ('activa','lista_espera') sin mirar
-- precio_pagado, categoría, cupo, edad ni firma. Un POST directo a
-- /rest/v1/inscripciones creaba una inscripción activa y gratuita, y encima el
-- trigger auto_asignar_dorsal_gratis le asignaba dorsal y código QR justo por
-- tener precio 0.
--
-- Se puede cerrar del todo porque ningún punto del código inserta en esta tabla
-- desde el cliente: la vía pública es inscribirse_en_evento(), la del panel es
-- inscribir_manualmente() y la de traspaso transferir_inscripcion_firmada().
-- ---------------------------------------------------------------------------
drop policy if exists inscripciones_insert on public.inscripciones;
create policy inscripciones_insert on public.inscripciones for insert
  with check (public.es_admin_o_super(empresa_id));

-- ---------------------------------------------------------------------------
-- 2) Pagos: el pago tiene que caer en la empresa dueña de la inscripción.
--
-- La política anterior no ataba `empresa_id` ni `monto`, y aquí no hay trigger
-- de coherencia como el de inscripciones. Un corredor podía insertar un pago
-- sobre su propia inscripción declarando el `empresa_id` de OTRA empresa: la
-- fila aparecía en el panel de pagos ajeno, en su CSV de conciliación y sumaba
-- en metricas_empresa.pendiente_cobro. Escritura cruzada entre inquilinos.
--
-- Se conserva la rama del corredor —en vez de cerrarla como en inscripciones—
-- porque el pago sigue naciendo a su nombre; lo que se exige ahora es que la
-- empresa sea la correcta. El monto lo sigue fijando registrar_intento_pago,
-- que lo copia de inscripciones.precio_pagado.
-- ---------------------------------------------------------------------------
drop policy if exists pagos_insert on public.pagos;
create policy pagos_insert on public.pagos for insert
  with check (
    public.es_admin_o_super(empresa_id)
    or (
      inscripcion_id is not null
      and public.es_dueno_de_inscripcion(inscripcion_id)
      and empresa_id = public.empresa_de_inscripcion(inscripcion_id)
      and estado in ('pendiente', 'en_verificacion')
      and verificado_por is null
      and verificado_en is null
    )
    or (
      grupo_inscripcion_id is not null
      and exists (
        select 1 from public.grupos_inscripcion g
        where g.id = grupo_inscripcion_id
          and g.pagador_id = auth.uid()
          and g.empresa_id = pagos.empresa_id
      )
      and estado in ('pendiente', 'en_verificacion')
      and verificado_por is null
      and verificado_en is null
    )
  );

-- ---------------------------------------------------------------------------
-- 3) Se devuelve `estado` a las columnas protegidas, y se añaden tres más.
--
-- La versión de 0019 recreó este trigger para cubrir las columnas de asistencia
-- y perdió `estado` por el camino (sí estaba en 0005). Combinado con
-- inscripciones_update, que da UPDATE al dueño, el corredor podía:
--   · resucitar su propia inscripción anulada,
--   · convertir su 'lista_espera' en 'activa' saltándose convertir_lista_espera
--     y, con ella, la comprobación de cupo.
--
-- Se añaden además:
--   · categoria_id / evento_id, nunca protegidos: permitían moverse a una
--     categoría más cara o llena conservando el precio_pagado, porque
--     validar_empresa_inscripcion solo exige que la categoría sea del evento.
--   · talla, que en 0005 se dejó libre a propósito. Aquel criterio quedó
--     obsoleto en 0016, cuando se creó cambiar_talla_inscripcion justo para
--     mover el inventario de forma atómica: un UPDATE suelto descuadra
--     evento_tallas.inventario_disponible.
--
-- Ningún flujo legítimo se rompe: las siete RPC que tocan estas columnas
-- levantan antes la bandera de sesión `runticket.rpc_inscripciones`.
-- ---------------------------------------------------------------------------
create or replace function public.proteger_columnas_inscripcion()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if current_setting('runticket.rpc_inscripciones', true) = 'on' then
    return new;
  end if;

  if public.es_miembro_de_empresa(new.empresa_id) or public.es_super_admin() then
    return new;
  end if;

  if new.numero_dorsal is distinct from old.numero_dorsal
     or new.codigo_qr is distinct from old.codigo_qr
     or new.cupon_id is distinct from old.cupon_id
     or new.precio_pagado is distinct from old.precio_pagado
     or new.empresa_id is distinct from old.empresa_id
     or new.corredor_id is distinct from old.corredor_id
     or new.estado is distinct from old.estado
     or new.categoria_id is distinct from old.categoria_id
     or new.evento_id is distinct from old.evento_id
     or new.talla is distinct from old.talla
     or new.kit_entregado is distinct from old.kit_entregado
     or new.kit_entregado_en is distinct from old.kit_entregado_en
     or new.kit_entregado_por is distinct from old.kit_entregado_por
     or new.asistencia_confirmada is distinct from old.asistencia_confirmada
     or new.asistencia_en is distinct from old.asistencia_en
     or new.asistencia_por is distinct from old.asistencia_por then
    raise exception 'No autorizado para modificar estos campos de la inscripción';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4) Bitácora: solo se escribe por la RPC.
--
-- La política ataba `usuario_id` y dejaba libres empresa_id, accion, entidad y
-- los datos_*. Cualquier usuario con sesión podía escribir en la bitácora de
-- cualquier empresa, y como la tabla no admite UPDATE ni DELETE (correcto, es un
-- registro legal), la basura quedaba dentro para siempre y salía en la consola
-- de plataforma.
--
-- Sin política de INSERT la tabla queda cerrada a authenticated/anon.
-- registrar_auditoria() es `security definer`, así que sigue escribiendo, y es
-- la única vía que usa el código (src/lib/seguridad.ts → auditar()).
-- ---------------------------------------------------------------------------
drop policy if exists bitacora_insert on public.bitacora_auditoria;

comment on function public.proteger_columnas_inscripcion() is
  'Blinda las columnas que solo pueden cambiar desde las RPC (bandera runticket.rpc_inscripciones) o desde el staff de la empresa. Incluye estado, categoria_id, evento_id y talla.';
