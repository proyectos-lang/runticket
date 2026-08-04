-- =========================================================================
-- El corredor no tenía forma de elegir o corregir su talla después de
-- inscribirse: el campo se mostraba solo de lectura y, si se equivocó o dejó
-- "Sin talla", quedaba atrapado hasta el día del evento.
--
-- El cambio no puede hacerse con un UPDATE directo porque hay que mover
-- inventario: devolver una prenda a la talla anterior y descontarla de la
-- nueva, comprobando que quede stock. Las dos operaciones tienen que ocurrir
-- juntas o ninguna.
-- =========================================================================

create or replace function public.cambiar_talla_inscripcion(
  p_inscripcion_id uuid,
  p_talla text
)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_insc public.inscripciones%rowtype;
  v_estado_evento text;
begin
  select * into v_insc from public.inscripciones where id = p_inscripcion_id for update;
  if not found then raise exception 'La inscripción no existe'; end if;

  if v_insc.corredor_id <> auth.uid()
     and not (public.es_miembro_de_empresa(v_insc.empresa_id) or public.es_super_admin()) then
    raise exception 'No autorizado para cambiar la talla de esta inscripción';
  end if;

  if v_insc.estado <> 'activa' then
    raise exception 'Solo se puede cambiar la talla de una inscripción activa';
  end if;

  -- Una vez entregado el kit, cambiar la talla ya no significa nada: la prenda
  -- física ya está en manos del corredor.
  if v_insc.kit_entregado then
    raise exception 'El kit ya fue entregado: pide el cambio directamente al organizador';
  end if;

  select estado into v_estado_evento from public.eventos where id = v_insc.evento_id;
  if v_estado_evento in ('finalizado', 'cancelado') then
    raise exception 'Este evento ya no admite cambios';
  end if;

  if p_talla is not distinct from v_insc.talla then
    return;
  end if;

  -- Serializa por evento para que dos cambios simultáneos no descuadren el
  -- inventario de una misma talla.
  perform pg_advisory_xact_lock(hashtextextended('talla:' || v_insc.evento_id::text, 0));

  if p_talla is not null then
    if not exists (
      select 1 from public.evento_tallas
      where evento_id = v_insc.evento_id and talla = p_talla
    ) then
      raise exception 'La talla % no existe en este evento', p_talla;
    end if;

    update public.evento_tallas
      set inventario_disponible = inventario_disponible - 1
      where evento_id = v_insc.evento_id and talla = p_talla
        and (inventario_disponible is null or inventario_disponible > 0);
    if not found then
      raise exception 'Ya no quedan prendas de la talla %', p_talla;
    end if;
  end if;

  if v_insc.talla is not null then
    update public.evento_tallas
      set inventario_disponible = inventario_disponible + 1
      where evento_id = v_insc.evento_id and talla = v_insc.talla
        and inventario_disponible is not null;
  end if;

  -- Bandera de sesión: el trigger proteger_columnas_inscripcion permite el
  -- cambio porque viene de esta función y no de un UPDATE suelto del corredor.
  perform set_config('runticket.rpc_inscripciones', 'on', true);
  update public.inscripciones
    set talla = p_talla, updated_at = now()
    where id = p_inscripcion_id;
  perform set_config('runticket.rpc_inscripciones', 'off', true);
end;
$$;

grant execute on function public.cambiar_talla_inscripcion(uuid, text) to authenticated;

comment on function public.cambiar_talla_inscripcion(uuid, text) is
  'Cambia la talla moviendo el inventario de forma atómica. La usa tanto el corredor (sobre su propia inscripción) como el organizador.'; 