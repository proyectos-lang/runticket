-- =========================================================================
-- Conciliación con PixelPay: que ningún pago con tarjeta quede como pagado
-- sin que PixelPay lo confirme, y que quede constancia de cada comprobación.
--
-- La 0032 ya exigía preguntar a PixelPay antes de cerrar un pago, pero solo
-- guardaba el sí o el no. Aquí se guarda la evidencia —qué respondió, cuándo,
-- con qué número de transacción y de autorización, y por cuánto— y se vigila
-- también el caso contrario: un pago que RunTicket tiene por pagado y PixelPay
-- no. Ese no se revierte solo (el corredor ya tiene dorsal y quizá correo):
-- queda una alerta a la vista del organizador, que es quien decide.
-- =========================================================================

alter table public.pagos
  -- Lo último que dijo PixelPay del cobro: paid, open, pending…
  add column if not exists pasarela_estado          text,
  add column if not exists pasarela_verificado_en   timestamptz,
  add column if not exists pasarela_transaccion     text,
  add column if not exists pasarela_autorizacion    text,
  -- El importe que PixelPay dice haber cobrado, si lo informa.
  add column if not exists pasarela_monto_cobrado   numeric(12,2),
  -- La respuesta completa de la última consulta, tal cual.
  add column if not exists pasarela_detalle         jsonb,
  -- Algo no cuadra entre RunTicket y PixelPay. Null cuando todo coincide.
  add column if not exists pasarela_alerta          text;

create index if not exists pagos_pasarela_alerta_idx
  on public.pagos (empresa_id) where pasarela_alerta is not null;

-- ---------------------------------------------------------------------------
-- Registra una consulta a PixelPay y actúa en consecuencia.
--
-- Solo `service_role`, y solo con lo que PixelPay acaba de responder a una
-- consulta hecha con nuestras credenciales. Devuelve qué pasó:
--
--   pagado          → se cerró el pago (el disparador asigna el dorsal)
--   ya_pagado       → ya estaba pagado y PixelPay lo confirma
--   a_revision      → PixelPay cobró, pero por otro importe: al organizador
--   ignorado        → cobrado en PixelPay, pero el pago estaba anulado/reembolsado
--   falso_positivo  → RunTicket lo tiene pagado y PixelPay dice que no
--   pendiente       → nadie ha pagado todavía
--   desconocido     → no hay pago con ese cobro
-- ---------------------------------------------------------------------------
create or replace function public.registrar_verificacion_pasarela(
  p_pasarela_uuid  text,
  p_estado         text,
  p_detalle        jsonb default null,
  p_monto_cobrado  numeric default null,
  p_transaccion    text default null,
  p_autorizacion   text default null
)
returns text
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_pago    public.pagos%rowtype;
  v_cobrado numeric;
begin
  select * into v_pago from public.pagos where pasarela_uuid = p_pasarela_uuid for update;
  if not found then return 'desconocido'; end if;

  -- La evidencia se guarda siempre, pase lo que pase después.
  update public.pagos
    set pasarela_estado        = p_estado,
        pasarela_verificado_en = now(),
        pasarela_detalle       = p_detalle,
        pasarela_monto_cobrado = coalesce(p_monto_cobrado, pasarela_monto_cobrado),
        pasarela_transaccion   = coalesce(p_transaccion, pasarela_transaccion),
        pasarela_autorizacion  = coalesce(p_autorizacion, pasarela_autorizacion)
    where id = v_pago.id;

  -- Si PixelPay no informa el importe, vale el que usamos al crear el cobro:
  -- ese lo fijó RunTicket y el corredor no pudo cambiarlo.
  v_cobrado := coalesce(p_monto_cobrado, v_pago.pasarela_monto);

  if p_estado <> 'paid' then
    if v_pago.estado = 'pagado' and v_pago.metodo = 'pasarela' then
      update public.pagos
        set pasarela_alerta = 'Figura como pagado, pero PixelPay reporta el cobro como «'
                              || p_estado || '».'
        where id = v_pago.id;
      return 'falso_positivo';
    end if;
    return 'pendiente';
  end if;

  if v_pago.estado in ('anulado', 'reembolsado') then
    update public.pagos
      set pasarela_alerta = 'PixelPay reporta el cobro pagado, pero este pago estaba '
                            || v_pago.estado || '.'
      where id = v_pago.id;
    return 'ignorado';
  end if;

  if v_cobrado is distinct from v_pago.monto then
    update public.pagos
      set pasarela_alerta = 'PixelPay cobró ' || coalesce(v_cobrado::text, '?')
                            || ' y el importe de la inscripción es ' || v_pago.monto::text || '.',
          -- Uno ya pagado se queda como está: la alerta basta para revisarlo.
          estado = case when estado = 'pagado' then estado else 'en_verificacion' end,
          referencia_externa = coalesce(p_transaccion, referencia_externa),
          updated_at = now()
      where id = v_pago.id;
    return 'a_revision';
  end if;

  if v_pago.estado = 'pagado' then
    update public.pagos set pasarela_alerta = null where id = v_pago.id;
    return 'ya_pagado';
  end if;

  update public.pagos
    set estado = 'pagado',
        metodo = 'pasarela',
        proveedor = 'pixelpay',
        referencia_externa = coalesce(p_transaccion, p_pasarela_uuid),
        pasarela_alerta = null,
        verificado_en = now(),
        updated_at = now()
    where id = v_pago.id;
  return 'pagado';
end;
$$;

revoke execute on function public.registrar_verificacion_pasarela(text, text, jsonb, numeric, text, text)
  from public, anon, authenticated;
grant execute on function public.registrar_verificacion_pasarela(text, text, jsonb, numeric, text, text)
  to service_role;

comment on function public.registrar_verificacion_pasarela(text, text, jsonb, numeric, text, text) is
  'Guarda lo que respondió PixelPay sobre un cobro y concilia el pago. Solo service_role.';

-- La de la 0032 queda como atajo de la nueva, para no tener dos criterios.
create or replace function public.confirmar_pago_pasarela(
  p_pasarela_uuid text,
  p_referencia    text default null
)
returns text
language sql security definer set search_path = public, pg_temp
as $$
  select public.registrar_verificacion_pasarela(p_pasarela_uuid, 'paid', null, null, p_referencia, null);
$$;
