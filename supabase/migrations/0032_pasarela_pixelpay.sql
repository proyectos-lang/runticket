-- =========================================================================
-- Pago con tarjeta a través de PixelPay.
--
-- La tabla `pagos` lleva desde la 0006 el método 'pasarela' y la columna
-- `proveedor` esperando este momento. Lo que faltaba:
--
--   · dónde guardar el cobro que PixelPay genera (su uuid y su enlace), y
--   · dos puertas: una para que el corredor abra el pago y otra para que el
--     **servidor** —y solo él— lo dé por pagado.
--
-- La segunda puerta es la delicada. `actualizar_estado_pago` exige ser
-- administrador de la empresa, y el aviso de PixelPay llega sin usuario. En vez
-- de relajar esa comprobación se abre una función aparte que ni `anon` ni
-- `authenticated` pueden ejecutar: la llama el servidor con la llave de
-- servicio, y solo después de preguntarle a PixelPay si el cobro está pagado.
-- =========================================================================

alter table public.pagos
  add column if not exists pasarela_uuid  text,
  add column if not exists pasarela_url   text,
  -- El importe con el que se creó el cobro en PixelPay. Si el de `pagos` cambia
  -- después (en un grupo anulan a alguien), el cobro viejo ya no sirve.
  add column if not exists pasarela_monto numeric(12,2);

create unique index if not exists pagos_pasarela_uuid_idx
  on public.pagos (pasarela_uuid) where pasarela_uuid is not null;

-- ---------------------------------------------------------------------------
-- 1) El corredor (o el titular de un grupo) abre el pago con tarjeta
--
-- Mismas cautelas que `registrar_intento_pago` y `registrar_intento_pago_grupo`:
-- quién puede, en qué estado, y **el importe se calcula aquí**. Devuelve el id
-- del pago; el servidor crea después el cobro en PixelPay y lo guarda.
--
-- No pisa un comprobante en revisión: el organizador ya lo tiene delante y
-- cambiarlo a tarjeta lo haría desaparecer de su bandeja.
-- ---------------------------------------------------------------------------
create or replace function public.preparar_pago_pasarela(
  p_inscripcion_id uuid default null,
  p_grupo_id       uuid default null
)
returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_empresa_id uuid;
  v_total      numeric;
  v_moneda     text;
  v_cuantas    integer;
  v_pago       public.pagos%rowtype;
begin
  if (p_inscripcion_id is null) = (p_grupo_id is null) then
    raise exception 'Indica una inscripción o un grupo, no ambos';
  end if;

  if p_inscripcion_id is not null then
    select empresa_id, precio_pagado, moneda
      into v_empresa_id, v_total, v_moneda
    from public.inscripciones
    where id = p_inscripcion_id
      and corredor_id = auth.uid()
      and estado = 'activa';
    if not found then raise exception 'No encontramos esa inscripción'; end if;

    if exists (select 1 from public.inscripciones
               where id = p_inscripcion_id and grupo_inscripcion_id is not null) then
      raise exception 'PAGO_ES_DE_GRUPO';
    end if;

    select * into v_pago from public.pagos
      where inscripcion_id = p_inscripcion_id
        and estado not in ('pagado', 'reembolsado', 'anulado')
      order by created_at desc
      limit 1
      for update;
  else
    select empresa_id into v_empresa_id
    from public.grupos_inscripcion
    where id = p_grupo_id and pagador_id = auth.uid();
    if not found then raise exception 'No encontramos ese grupo'; end if;

    select sum(precio_pagado), min(moneda), count(*)
      into v_total, v_moneda, v_cuantas
    from public.inscripciones
    where grupo_inscripcion_id = p_grupo_id and estado = 'activa';
    if coalesce(v_cuantas, 0) = 0 then
      raise exception 'Ese grupo no tiene inscripciones activas';
    end if;

    select * into v_pago from public.pagos
      where grupo_inscripcion_id = p_grupo_id
        and estado not in ('pagado', 'reembolsado', 'anulado')
      order by created_at desc
      limit 1
      for update;
  end if;

  if coalesce(v_total, 0) <= 0 then
    raise exception 'No hay nada que pagar';
  end if;

  if v_pago.id is not null then
    if v_pago.estado = 'en_verificacion' then
      raise exception 'COMPROBANTE_EN_REVISION';
    end if;

    update public.pagos
      set metodo = 'pasarela',
          proveedor = 'pixelpay',
          estado = 'pendiente',
          monto = v_total,
          -- Un cobro creado por otro importe no puede cerrar este pago.
          pasarela_uuid  = case when pasarela_monto = v_total then pasarela_uuid end,
          pasarela_url   = case when pasarela_monto = v_total then pasarela_url end,
          pasarela_monto = case when pasarela_monto = v_total then pasarela_monto end,
          updated_at = now()
      where id = v_pago.id;
    return v_pago.id;
  end if;

  insert into public.pagos (
    inscripcion_id, grupo_inscripcion_id, empresa_id, monto, moneda,
    metodo, proveedor, estado, created_by
  ) values (
    p_inscripcion_id, p_grupo_id, v_empresa_id, v_total, coalesce(v_moneda, 'HNL'),
    'pasarela', 'pixelpay', 'pendiente', auth.uid()
  ) returning id into v_pago.id;

  return v_pago.id;
end;
$$;

revoke execute on function public.preparar_pago_pasarela(uuid, uuid) from public, anon;
grant execute on function public.preparar_pago_pasarela(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2) El servidor da el cobro por pagado
--
-- Solo `service_role`. Quien la llama ya comprobó con PixelPay que el cobro
-- está pagado; aquí se decide qué hacer con eso:
--
--   · ya pagado → nada (el aviso de PixelPay puede llegar varias veces);
--   · anulado o reembolsado → se deja constancia y no se toca: hay dinero de
--     una inscripción que ya no existe y eso lo resuelve una persona;
--   · el cobro se hizo por otro importe → a revisión del organizador;
--   · en otro caso → pagado. El disparador `asignar_dorsal_al_pagar` hace el
--     resto, igual que cuando confirma el organizador.
-- ---------------------------------------------------------------------------
create or replace function public.confirmar_pago_pasarela(
  p_pasarela_uuid text,
  p_referencia    text default null
)
returns text
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_pago public.pagos%rowtype;
begin
  select * into v_pago from public.pagos where pasarela_uuid = p_pasarela_uuid for update;
  if not found then return 'desconocido'; end if;

  if v_pago.estado = 'pagado' then return 'ya_pagado'; end if;

  if v_pago.estado in ('anulado', 'reembolsado') then
    update public.pagos
      set notas = concat_ws(' · ', notas,
            'PixelPay reporta el cobro pagado, pero este pago estaba ' || v_pago.estado || '.'),
          updated_at = now()
      where id = v_pago.id;
    return 'ignorado';
  end if;

  if v_pago.pasarela_monto is distinct from v_pago.monto then
    update public.pagos
      set estado = 'en_verificacion',
          referencia_externa = coalesce(p_referencia, referencia_externa),
          notas = concat_ws(' · ', notas,
            'Cobrado por PixelPay ' || coalesce(v_pago.pasarela_monto::text, '?')
            || ', pero el importe vigente es ' || v_pago.monto::text || '.'),
          updated_at = now()
      where id = v_pago.id;
    return 'a_revision';
  end if;

  update public.pagos
    set estado = 'pagado',
        metodo = 'pasarela',
        proveedor = 'pixelpay',
        referencia_externa = coalesce(p_referencia, referencia_externa),
        verificado_en = now(),
        updated_at = now()
    where id = v_pago.id;
  return 'pagado';
end;
$$;

revoke execute on function public.confirmar_pago_pasarela(text, text) from public, anon, authenticated;
grant execute on function public.confirmar_pago_pasarela(text, text) to service_role;

comment on function public.confirmar_pago_pasarela(text, text) is
  'Marca como pagado el pago de un cobro de PixelPay. Solo service_role, y solo tras consultar el estado del cobro en PixelPay.';
