-- =========================================================================
-- Fase 2 (pagos): coordinación por WhatsApp, comprobante de transferencia y
-- registro manual. Sin pasarela: el adaptador se añadirá cuando el cliente
-- elija banco, sin tocar nada de esto.
-- =========================================================================

-- ---------------------------------------------------------------------------
-- 1) El dorsal se asigna en cuanto un pago queda 'pagado', venga de donde venga.
--
-- Antes solo lo hacía actualizar_estado_pago(), así que un pago registrado
-- directamente como 'pagado' por el organizador (efectivo en punto de venta)
-- dejaba al corredor sin dorsal. Con un trigger, todos los caminos convergen.
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

-- ---------------------------------------------------------------------------
-- 2) El historial también registra el alta, no solo los cambios de estado, para
--    que la trazabilidad del pago empiece desde el primer momento.
-- ---------------------------------------------------------------------------
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
-- 3) El corredor declara cómo va a pagar (o sube su comprobante).
--
-- No se le puede dar UPDATE directo sobre `pagos`: podría reescribir el monto o
-- marcarse como pagado. Esta función solo toca las columnas que le competen y
-- jamás las de verificación.
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

  -- Con comprobante el pago pasa a revisión; por WhatsApp queda a la espera de
  -- que el organizador confirme que recibió el dinero.
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

grant execute on function public.registrar_intento_pago(uuid, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4) El corredor necesita ver el estado de su propio pago.
--
-- La política de SELECT ya lo permite, pero no la de UPDATE (correcto: el estado
-- lo decide el organizador). Nada que cambiar aquí; queda anotado para que no se
-- añada por error una política de UPDATE al corredor más adelante.
-- ---------------------------------------------------------------------------

comment on function public.registrar_intento_pago(uuid, text, text, text) is
  'Única vía por la que un corredor puede tocar su pago: fija método/comprobante y deja el estado en pendiente o en_verificacion. Nunca escribe verificado_por/verificado_en ni el monto.';
