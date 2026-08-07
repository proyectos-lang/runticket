-- =========================================================================
-- Un solo pago para toda la familia.
--
-- La inscripción con acompañantes ya creaba el grupo desde la 0026, y la base
-- lleva preparada desde el principio: `pagos.grupo_inscripcion_id` existe desde
-- la 0006, sus políticas contemplan al pagador (0006 y 0023), y tanto
-- `actualizar_estado_pago` como el disparador `asignar_dorsal_al_pagar` reparten
-- el dorsal a **todas** las inscripciones del grupo cuando el pago se confirma.
--
-- Lo único que faltaba era la puerta de entrada: el corredor solo podía declarar
-- su pago con `registrar_intento_pago`, que recibe una inscripción. Una familia
-- de cuatro tenía que mandar cuatro comprobantes y el organizador aprobarlos de
-- uno en uno, aunque el dinero fuera una sola transferencia.
-- =========================================================================

-- ---------------------------------------------------------------------------
-- 0) Quién paga un grupo
--
-- Hace falta fuera de las funciones —lo usan las políticas del bucket de
-- comprobantes—, así que va suelto y no repetido en cada `exists`.
-- ---------------------------------------------------------------------------
create or replace function public.es_pagador_de_grupo(p_grupo_id uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.grupos_inscripcion
    where id = p_grupo_id and pagador_id = auth.uid()
  );
$$;

-- El comprobante de una familia se guarda en `comprobantes/{empresa}/{grupo}/…`.
-- La convención de rutas era `{empresa_id}/{inscripcion_id}/…` y la política
-- exigía ser dueño de esa inscripción, así que un identificador de grupo caía
-- fuera. Se abre esa rama —y solo esa— en vez de colgar el archivo de la
-- inscripción del titular, que haría que la ruta mintiera sobre lo que contiene.
drop policy if exists comprobantes_lectura on storage.objects;
create policy comprobantes_lectura on storage.objects for select
  using (
    bucket_id = 'comprobantes' and (
      public.es_admin_o_super((storage.foldername(name))[1]::uuid)
      or public.es_dueno_de_inscripcion((storage.foldername(name))[2]::uuid)
      or public.es_pagador_de_grupo((storage.foldername(name))[2]::uuid)
    )
  );

drop policy if exists comprobantes_escritura on storage.objects;
create policy comprobantes_escritura on storage.objects for insert
  with check (
    bucket_id = 'comprobantes' and (
      public.es_admin_o_super((storage.foldername(name))[1]::uuid)
      or public.es_dueno_de_inscripcion((storage.foldername(name))[2]::uuid)
      or public.es_pagador_de_grupo((storage.foldername(name))[2]::uuid)
    )
  );

-- ---------------------------------------------------------------------------
-- 1) El titular declara el pago de todo el grupo
--
-- Mismo contrato que `registrar_intento_pago` y las mismas cautelas: solo toca
-- las columnas que le competen, jamás las de verificación, y **el importe lo
-- calcula aquí** sumando las inscripciones. Si el monto llegara del navegador,
-- el corredor elegiría cuánto debe.
-- ---------------------------------------------------------------------------
create or replace function public.registrar_intento_pago_grupo(
  p_grupo_id        uuid,
  p_metodo          text,
  p_comprobante_url text default null,
  p_referencia      text default null
)
returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_grupo   public.grupos_inscripcion%rowtype;
  v_pago    public.pagos%rowtype;
  v_estado  text;
  v_total   numeric;
  v_moneda  text;
  v_cuantas integer;
begin
  select * into v_grupo from public.grupos_inscripcion where id = p_grupo_id;
  if not found then raise exception 'Ese grupo no existe'; end if;

  if v_grupo.pagador_id <> auth.uid() and not public.es_admin_o_super(v_grupo.empresa_id) then
    raise exception 'No autorizado para registrar el pago de este grupo';
  end if;
  if p_metodo not in ('whatsapp', 'comprobante_transferencia') then
    raise exception 'Método no válido para esta operación: %', p_metodo;
  end if;

  select sum(precio_pagado), min(moneda), count(*)
    into v_total, v_moneda, v_cuantas
  from public.inscripciones
  where grupo_inscripcion_id = p_grupo_id and estado = 'activa';

  if coalesce(v_cuantas, 0) = 0 then
    raise exception 'Ese grupo no tiene inscripciones activas';
  end if;

  -- Con comprobante el pago pasa a revisión; por WhatsApp queda a la espera de
  -- que el organizador confirme que recibió el dinero.
  v_estado := case when p_metodo = 'comprobante_transferencia' then 'en_verificacion' else 'pendiente' end;

  select * into v_pago from public.pagos
    where grupo_inscripcion_id = p_grupo_id
      and estado not in ('pagado', 'reembolsado', 'anulado')
    order by created_at desc
    limit 1
    for update;

  if found then
    update public.pagos
      set metodo = p_metodo,
          estado = v_estado,
          -- Se recalcula: entre un intento y otro pueden haber anulado a alguien
          -- del grupo, y el comprobante nuevo cubre lo que queda vivo.
          monto = v_total,
          comprobante_url = coalesce(p_comprobante_url, comprobante_url),
          referencia_externa = coalesce(p_referencia, referencia_externa),
          updated_at = now()
      where id = v_pago.id;
    return v_pago.id;
  end if;

  insert into public.pagos (
    grupo_inscripcion_id, empresa_id, monto, moneda, metodo,
    comprobante_url, referencia_externa, estado, created_by
  ) values (
    p_grupo_id, v_grupo.empresa_id, v_total, coalesce(v_moneda, 'HNL'), p_metodo,
    p_comprobante_url, p_referencia, v_estado, auth.uid()
  ) returning id into v_pago.id;

  return v_pago.id;
end;
$$;

grant execute on function public.registrar_intento_pago_grupo(uuid, text, text, text) to authenticated;

comment on function public.registrar_intento_pago_grupo(uuid, text, text, text) is
  'Única vía por la que el titular de un grupo declara el pago de toda la familia. Suma el importe de las inscripciones activas en la base; nunca lo recibe de fuera.';

-- ---------------------------------------------------------------------------
-- 2) Una inscripción de grupo no se paga suelta
--
-- Sin esto habría dos caminos abiertos para el mismo dinero: el organizador
-- vería un pago del grupo por 1.050 y otro del titular por 450, y no sabría cuál
-- aprobar. La regla es simple: si la inscripción pertenece a un grupo, se paga
-- por el grupo.
-- ---------------------------------------------------------------------------
create or replace function public.registrar_intento_pago(
  p_inscripcion_id  uuid,
  p_metodo          text,
  p_comprobante_url text default null,
  p_referencia      text default null
)
returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_insc public.inscripciones%rowtype;
  v_pago public.pagos%rowtype;
  v_estado text;
begin
  select * into v_insc from public.inscripciones where id = p_inscripcion_id;
  if not found then raise exception 'La inscripción no existe'; end if;

  if v_insc.corredor_id <> auth.uid() and not public.es_admin_o_super(v_insc.empresa_id) then
    raise exception 'No autorizado para registrar el pago de esta inscripción';
  end if;
  if v_insc.estado <> 'activa' then
    raise exception 'Solo se puede pagar una inscripción activa';
  end if;
  if p_metodo not in ('whatsapp', 'comprobante_transferencia') then
    raise exception 'Método no válido para esta operación: %', p_metodo;
  end if;

  -- Novedad de la 0028. El organizador conserva la vía suelta: a veces cobra a
  -- un miembro por separado en el mostrador.
  if v_insc.grupo_inscripcion_id is not null
     and not public.es_admin_o_super(v_insc.empresa_id) then
    raise exception 'PAGO_ES_DE_GRUPO';
  end if;

  v_estado := case when p_metodo = 'comprobante_transferencia' then 'en_verificacion' else 'pendiente' end;

  select * into v_pago from public.pagos
    where inscripcion_id = p_inscripcion_id
      and estado not in ('pagado', 'reembolsado', 'anulado')
    order by created_at desc
    limit 1
    for update;

  if found then
    update public.pagos
      set metodo = p_metodo,
          estado = v_estado,
          comprobante_url = coalesce(p_comprobante_url, comprobante_url),
          referencia_externa = coalesce(p_referencia, referencia_externa),
          updated_at = now()
      where id = v_pago.id;
    return v_pago.id;
  end if;

  insert into public.pagos (
    inscripcion_id, empresa_id, monto, moneda, metodo,
    comprobante_url, referencia_externa, estado, created_by
  ) values (
    p_inscripcion_id, v_insc.empresa_id, v_insc.precio_pagado, v_insc.moneda, p_metodo,
    p_comprobante_url, p_referencia, v_estado, auth.uid()
  ) returning id into v_pago.id;

  return v_pago.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3) La ficha de la familia
--
-- El titular necesita ver a los suyos con su dorsal y su QR en una sola
-- pantalla. Podría salir de consultas sueltas, pero `perfiles` solo deja leer la
-- fila propia y la de quien está en tu lista de acompañantes: si quitas a
-- alguien de la lista después de inscribirlo, su nombre dejaría de verse en una
-- carrera que ya pagaste.
--
-- Esta función resuelve el caso por la vía correcta —la pertenencia al grupo—
-- sin ensanchar la política de `perfiles`, que protege datos de todos.
-- ---------------------------------------------------------------------------
create or replace function public.personas_de_grupo(p_grupo_id uuid)
returns table (
  inscripcion_id uuid,
  corredor_id    uuid,
  nombre         text,
  categoria      text,
  distancia_km   numeric,
  talla          text,
  numero_dorsal  integer,
  codigo_qr      text,
  precio_pagado  numeric,
  kit_entregado  boolean,
  es_titular     boolean
)
language sql stable security definer set search_path = public, pg_temp
as $$
  select
    i.id,
    i.corredor_id,
    nullif(trim(coalesce(p.nombres, '') || ' ' || coalesce(p.apellidos, '')), ''),
    c.nombre,
    c.distancia_km,
    i.talla,
    i.numero_dorsal,
    i.codigo_qr,
    i.precio_pagado,
    i.kit_entregado,
    i.corredor_id = g.pagador_id
  from public.inscripciones i
  join public.grupos_inscripcion g on g.id = i.grupo_inscripcion_id
  left join public.perfiles p on p.id = i.corredor_id
  left join public.categorias c on c.id = i.categoria_id
  where i.grupo_inscripcion_id = p_grupo_id
    and i.estado = 'activa'
    and (
      g.pagador_id = auth.uid()
      or public.es_miembro_de_empresa(g.empresa_id)
      or public.es_super_admin()
    )
  -- El titular primero; el resto por dorsal, y los que aún no lo tienen al final.
  order by (i.corredor_id = g.pagador_id) desc, i.numero_dorsal nulls last, i.created_at;
$$;

grant execute on function public.personas_de_grupo(uuid) to authenticated;

comment on function public.personas_de_grupo(uuid) is
  'Las personas de una inscripción familiar con su dorsal y su QR, para la ficha del grupo en el portal. Solo responde al pagador y a la empresa organizadora.';
