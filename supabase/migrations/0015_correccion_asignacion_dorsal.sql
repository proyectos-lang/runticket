-- =========================================================================
-- Correcciones detectadas al probar el flujo completo de Fase 3.
-- Es idempotente: se puede ejecutar aunque 0013 ya se haya aplicado.
-- =========================================================================

-- ---------------------------------------------------------------------------
-- 1) asignar_dorsal: dos fallos que impedían que existiera un solo dorsal.
--
-- a) Rechazaba cualquier llamada sin sesión de API. auth.uid() es null cuando la
--    operación viene del SQL Editor, de la CLI, de un job del servidor o de un
--    webhook de pasarela (todos con service_role); la función levantaba
--    'No autorizado' y la inscripción se quedaba sin dorsal para siempre. Esa
--    vía ya está protegida por exigir credenciales de la base de datos; lo que
--    se sigue controlando es el caso con sesión.
--
-- b) Usaba gen_random_bytes(), que pertenece a pgcrypto. Supabase instala esa
--    extensión en el esquema `extensions`, que no está en el search_path fijado
--    por la propia función, así que la llamada fallaba con "function does not
--    exist" en el momento de escribir el código QR. El identificador se genera
--    ahora con gen_random_uuid(), que vive en pg_catalog (núcleo de Postgres
--    desde la versión 13) y siempre resuelve: 32 caracteres hexadecimales, 122
--    bits de entropía, sin depender de ninguna extensión.
-- ---------------------------------------------------------------------------
create or replace function public.asignar_dorsal(p_inscripcion_id uuid)
returns integer
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_evento_id uuid; v_empresa_id uuid; v_corredor_id uuid;
  v_precio_pagado numeric; v_numero_dorsal integer; v_siguiente integer;
begin
  select evento_id, empresa_id, corredor_id, precio_pagado, numero_dorsal
    into v_evento_id, v_empresa_id, v_corredor_id, v_precio_pagado, v_numero_dorsal
  from public.inscripciones where id = p_inscripcion_id for update;

  if not found then raise exception 'Inscripción % no existe', p_inscripcion_id; end if;

  if auth.uid() is not null and not (
    public.es_miembro_de_empresa(v_empresa_id) or public.es_super_admin()
    or (v_corredor_id = auth.uid() and v_precio_pagado = 0)
  ) then
    raise exception 'No autorizado para asignar dorsal';
  end if;

  if v_numero_dorsal is not null then return v_numero_dorsal; end if;

  -- Serializa la asignación por evento para evitar colisiones bajo concurrencia.
  perform pg_advisory_xact_lock(hashtextextended('dorsal:' || v_evento_id::text, 0));

  select coalesce(max(numero_dorsal), 0) + 1 into v_siguiente
  from public.inscripciones where evento_id = v_evento_id;

  perform set_config('runticket.rpc_inscripciones', 'on', true);
  update public.inscripciones
    set numero_dorsal = v_siguiente,
        codigo_qr = coalesce(codigo_qr, replace(gen_random_uuid()::text, '-', '')),
        updated_at = now()
    where id = p_inscripcion_id;
  perform set_config('runticket.rpc_inscripciones', 'off', true);

  return v_siguiente;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2) Reinstalación de los triggers de pagos.
--
-- Al probar se comprobó que no estaban activos: se insertaron pagos en estado
-- 'pagado' sin que se asignara el dorsal ni se escribiera pagos_historial. Se
-- recrean aquí para que el estado del esquema no dependa de que 0013 se haya
-- ejecutado por completo.
-- ---------------------------------------------------------------------------

create or replace function public.asignar_dorsal_al_pagar()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if new.estado = 'pagado' and (tg_op = 'INSERT' or old.estado is distinct from 'pagado') then
    if new.inscripcion_id is not null then
      perform public.asignar_dorsal(new.inscripcion_id);
    elsif new.grupo_inscripcion_id is not null then
      perform public.asignar_dorsal(i.id)
        from public.inscripciones i
        where i.grupo_inscripcion_id = new.grupo_inscripcion_id and i.estado = 'activa';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists asignar_dorsal_al_pagar on public.pagos;
create trigger asignar_dorsal_al_pagar
  after insert or update on public.pagos
  for each row execute function public.asignar_dorsal_al_pagar();

create or replace function public.registrar_historial_pago()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.pagos_historial (pago_id, estado_anterior, estado_nuevo, usuario_id, notas)
    values (new.id, null, new.estado, auth.uid(), new.notas);
  elsif new.estado is distinct from old.estado then
    insert into public.pagos_historial (pago_id, estado_anterior, estado_nuevo, usuario_id, notas)
    values (new.id, old.estado, new.estado, auth.uid(), new.notas);
  end if;
  return new;
end;
$$;

drop trigger if exists registrar_historial_pago on public.pagos;
create trigger registrar_historial_pago
  after insert or update on public.pagos
  for each row execute function public.registrar_historial_pago();

-- ---------------------------------------------------------------------------
-- 3) Repara los pagos ya confirmados que se quedaron sin dorsal por el fallo.
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select distinct p.inscripcion_id
    from public.pagos p
    join public.inscripciones i on i.id = p.inscripcion_id
    where p.estado = 'pagado' and i.numero_dorsal is null and i.estado = 'activa'
  loop
    perform public.asignar_dorsal(r.inscripcion_id);
  end loop;
end;
$$;
