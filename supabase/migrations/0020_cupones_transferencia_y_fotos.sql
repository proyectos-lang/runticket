-- =========================================================================
-- Cupones aplicados en la inscripción, transferencia con firma y privacidad
-- de las fotos por dorsal.
-- =========================================================================

-- ---------------------------------------------------------------------------
-- 1) El descuento se calcula en la base de datos, nunca en el cliente.
--
-- `inscribirse_en_evento` no aceptaba cupón. Si la aplicación calculara el
-- descuento y escribiera `precio_pagado`, el importe lo estaría fijando el
-- navegador del corredor y cualquiera podría inscribirse a cero. Aquí el precio
-- sigue saliendo de la base de datos y el cupón solo lo reduce.
--
-- `create or replace` con otra lista de parámetros crearía una SOBRECARGA en vez
-- de reemplazar, y supabase-js podría resolver la versión antigua: hay que
-- borrar con la firma exacta.
-- ---------------------------------------------------------------------------
drop function if exists public.inscribirse_en_evento(
  uuid, uuid, text, jsonb, text, boolean, inet, text, text, text
);

create or replace function public.inscribirse_en_evento(
  p_categoria_id     uuid,
  p_declaracion_id   uuid,
  p_talla            text default null,
  p_datos_adicionales jsonb default '{}'::jsonb,
  p_firma_imagen_url text default null,
  p_acepto           boolean default false,
  p_ip               inet default null,
  p_dispositivo      text default null,
  p_tutor_nombre     text default null,
  p_tutor_documento  text default null,
  p_codigo_cupon     text default null
)
returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_usuario uuid := auth.uid();
  v_cat public.categorias%rowtype;
  v_evento public.eventos%rowtype;
  v_cupon public.cupones%rowtype;
  v_edad integer;
  v_nacimiento date;
  v_ocupadas integer;
  v_precio numeric;
  v_inscripcion_id uuid;
begin
  if v_usuario is null then
    raise exception 'Debes iniciar sesión para inscribirte';
  end if;

  select * into v_cat from public.categorias where id = p_categoria_id;
  if not found then raise exception 'La categoría no existe'; end if;

  select * into v_evento from public.eventos where id = v_cat.evento_id;
  if v_evento.estado <> 'publicado' then
    raise exception 'Este evento no admite inscripciones en este momento';
  end if;
  if v_evento.fecha_limite_inscripcion is not null
     and now() > v_evento.fecha_limite_inscripcion then
    raise exception 'El plazo de inscripción ya cerró';
  end if;

  if exists (
    select 1 from public.inscripciones
    where evento_id = v_evento.id and corredor_id = v_usuario and estado = 'activa'
  ) then
    raise exception 'Ya tienes una inscripción activa en este evento';
  end if;

  -- Edad calculada el día del evento, que es lo que importa para la categoría.
  select fecha_nacimiento into v_nacimiento from public.perfiles where id = v_usuario;
  if v_nacimiento is null then
    raise exception 'Completa tu fecha de nacimiento en tu perfil antes de inscribirte';
  end if;
  v_edad := extract(year from age(v_evento.fecha_inicio::date, v_nacimiento));

  if v_cat.edad_minima is not null and v_edad < v_cat.edad_minima then
    raise exception 'Esta categoría exige una edad mínima de % años (tendrás %)', v_cat.edad_minima, v_edad;
  end if;
  if v_cat.edad_maxima is not null and v_edad > v_cat.edad_maxima then
    raise exception 'Esta categoría exige una edad máxima de % años (tendrás %)', v_cat.edad_maxima, v_edad;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('cupo:' || v_cat.id::text, 0));

  if v_cat.cupo_maximo is not null then
    select count(*) into v_ocupadas from public.inscripciones
      where categoria_id = v_cat.id and estado = 'activa';
    if v_ocupadas >= v_cat.cupo_maximo then
      raise exception 'CUPO_AGOTADO';
    end if;
  end if;

  if p_talla is not null then
    update public.evento_tallas
      set inventario_disponible = inventario_disponible - 1
      where evento_id = v_evento.id and talla = p_talla
        and (inventario_disponible is null or inventario_disponible > 0);
    if not found then
      raise exception 'La talla % ya no está disponible', p_talla;
    end if;
  end if;

  select coalesce(
    (select pe.precio from public.precios_escalonados pe
      where pe.categoria_id = v_cat.id and now() between pe.fecha_inicio and pe.fecha_fin
      order by pe.fecha_inicio desc limit 1),
    v_cat.precio_base
  ) into v_precio;

  if p_codigo_cupon is not null and length(trim(p_codigo_cupon)) > 0 then
    -- `for update` en la misma transacción: sin el bloqueo, dos inscripciones
    -- simultáneas gastarían un cupón de un solo uso.
    select * into v_cupon from public.cupones
      where empresa_id = v_evento.empresa_id
        and upper(codigo) = upper(trim(p_codigo_cupon))
        and (evento_id is null or evento_id = v_evento.id)
      for update;

    if not found then raise exception 'CUPON_INVALIDO'; end if;
    if not v_cupon.activo then raise exception 'CUPON_INVALIDO'; end if;
    if v_cupon.vigente_desde is not null and now() < v_cupon.vigente_desde then
      raise exception 'CUPON_INVALIDO';
    end if;
    if v_cupon.vigente_hasta is not null and now() > v_cupon.vigente_hasta then
      raise exception 'CUPON_CADUCADO';
    end if;
    if v_cupon.usos_maximos is not null and v_cupon.usos_actuales >= v_cupon.usos_maximos then
      raise exception 'CUPON_AGOTADO';
    end if;

    v_precio := greatest(
      0,
      case
        when v_cupon.tipo_descuento = 'porcentaje' then v_precio * (1 - v_cupon.valor / 100)
        else v_precio - v_cupon.valor
      end
    );

    update public.cupones
      set usos_actuales = usos_actuales + 1, updated_at = now()
      where id = v_cupon.id;
  end if;

  insert into public.inscripciones (
    evento_id, categoria_id, empresa_id, corredor_id, talla, cupon_id,
    precio_pagado, moneda, estado, datos_adicionales, created_by
  ) values (
    v_evento.id, v_cat.id, v_evento.empresa_id, v_usuario, p_talla, v_cupon.id,
    round(v_precio, 2), v_evento.moneda, 'activa',
    coalesce(p_datos_adicionales, '{}'::jsonb), v_usuario
  ) returning id into v_inscripcion_id;

  insert into public.inscripcion_firmas (
    inscripcion_id, declaracion_id, firma_imagen_url, aceptado_checkbox,
    ip_address, dispositivo, tutor_nombre, tutor_documento
  ) values (
    v_inscripcion_id, p_declaracion_id, p_firma_imagen_url, p_acepto,
    p_ip, p_dispositivo, p_tutor_nombre, p_tutor_documento
  );

  return v_inscripcion_id;
end;
$$;

grant execute on function public.inscribirse_en_evento(
  uuid, uuid, text, jsonb, text, boolean, inet, text, text, text, text
) to authenticated;

-- ---------------------------------------------------------------------------
-- 2) Transferencia con declaración firmada.
--
-- `transferir_inscripcion` creaba la inscripción nueva pero NO su fila en
-- `inscripcion_firmas`: el nuevo corredor quedaba corriendo sin deslinde de
-- responsabilidad, y la firma del titular original seguía colgando de la
-- inscripción vieja. Aquí ambas cosas ocurren en la misma transacción.
--
-- El dorsal se conserva si ya estaba asignado: a esas alturas suele estar
-- impreso en el kit, y renumerar obligaría a rehacerlo.
-- ---------------------------------------------------------------------------
create or replace function public.transferir_inscripcion_firmada(
  p_inscripcion_id   uuid,
  p_nuevo_corredor_id uuid,
  p_declaracion_id   uuid,
  p_firma_imagen_url text default null,
  p_ip               inet default null,
  p_dispositivo      text default null,
  p_motivo           text default null
)
returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_row public.inscripciones%rowtype;
  v_evento public.eventos%rowtype;
  v_nacimiento date;
  v_edad integer;
  v_cat public.categorias%rowtype;
  v_nueva_id uuid;
begin
  select * into v_row from public.inscripciones where id = p_inscripcion_id for update;
  if not found then raise exception 'La inscripción no existe'; end if;

  -- Solo el staff: transferir cambia quién corre y quién firmó el deslinde, así
  -- que debe hacerse con las dos partes delante, no desde el portal.
  if not (public.es_admin_o_super(v_row.empresa_id)) then
    raise exception 'Solo un administrador de la empresa puede transferir una inscripción';
  end if;
  if v_row.estado <> 'activa' then
    raise exception 'Solo se pueden transferir inscripciones activas';
  end if;
  if p_nuevo_corredor_id = v_row.corredor_id then
    raise exception 'La inscripción ya pertenece a esa persona';
  end if;
  if exists (
    select 1 from public.inscripciones
    where evento_id = v_row.evento_id and corredor_id = p_nuevo_corredor_id and estado = 'activa'
  ) then
    raise exception 'Esa persona ya tiene una inscripción activa en este evento';
  end if;

  -- La edad se vuelve a validar: la categoría puede no admitir al nuevo titular.
  select * into v_evento from public.eventos where id = v_row.evento_id;
  select * into v_cat from public.categorias where id = v_row.categoria_id;
  select fecha_nacimiento into v_nacimiento from public.perfiles where id = p_nuevo_corredor_id;
  if v_nacimiento is null then
    raise exception 'Falta la fecha de nacimiento de la persona que recibe la inscripción';
  end if;
  v_edad := extract(year from age(v_evento.fecha_inicio::date, v_nacimiento));

  if v_cat.edad_minima is not null and v_edad < v_cat.edad_minima then
    raise exception 'La categoría exige una edad mínima de % años (tendrá %)', v_cat.edad_minima, v_edad;
  end if;
  if v_cat.edad_maxima is not null and v_edad > v_cat.edad_maxima then
    raise exception 'La categoría exige una edad máxima de % años (tendrá %)', v_cat.edad_maxima, v_edad;
  end if;

  perform set_config('runticket.rpc_inscripciones', 'on', true);

  update public.inscripciones
    set estado = 'transferida',
        numero_dorsal = null,
        codigo_qr = null,
        updated_at = now()
    where id = p_inscripcion_id;

  insert into public.inscripciones (
    evento_id, categoria_id, empresa_id, corredor_id, talla, cupon_id,
    numero_dorsal, codigo_qr, precio_pagado, moneda, estado,
    grupo_inscripcion_id, transferido_de_inscripcion_id, datos_adicionales, created_by
  ) values (
    v_row.evento_id, v_row.categoria_id, v_row.empresa_id, p_nuevo_corredor_id,
    v_row.talla, v_row.cupon_id,
    v_row.numero_dorsal, v_row.codigo_qr,
    v_row.precio_pagado, v_row.moneda, 'activa',
    v_row.grupo_inscripcion_id, v_row.id,
    coalesce(v_row.datos_adicionales, '{}'::jsonb) || jsonb_build_object('transferencia_motivo', p_motivo),
    auth.uid()
  ) returning id into v_nueva_id;

  perform set_config('runticket.rpc_inscripciones', 'off', true);

  -- Sin esta fila la inscripción nueva no tendría deslinde firmado.
  insert into public.inscripcion_firmas (
    inscripcion_id, declaracion_id, firma_imagen_url, aceptado_checkbox,
    ip_address, dispositivo
  ) values (
    v_nueva_id, p_declaracion_id, p_firma_imagen_url, true, p_ip, p_dispositivo
  );

  -- El pago sigue al corredor: lo que se transfiere es la plaza ya comprada.
  update public.pagos set inscripcion_id = v_nueva_id where inscripcion_id = p_inscripcion_id;

  return v_nueva_id;
end;
$$;

grant execute on function public.transferir_inscripcion_firmada(
  uuid, uuid, uuid, text, inet, text, text
) to authenticated;

-- La versión antigua queda inutilizable: dejaba corredores sin declaración.
revoke execute on function public.transferir_inscripcion(uuid, uuid) from authenticated;

-- ---------------------------------------------------------------------------
-- 3) Privacidad de las fotos.
--
-- La política anterior dejaba a cualquiera hacer un `select` sobre
-- `fotos_evento`, que devuelve la URL junto con el array `numeros_dorsal`.
-- Cruzando eso con los resultados publicados (dorsal → nombre y apellidos) se
-- construye un índice «nombre → fotos» de todos los participantes, menores
-- incluidos, sin necesidad de conocer ningún dorsal.
--
-- Ahora la tabla solo la lee el staff y el dueño de las fotos, y el público
-- accede por dorsal a través de una función con límite de intentos, que nunca
-- devuelve el listado completo.
-- ---------------------------------------------------------------------------
drop policy if exists fotos_evento_select on public.fotos_evento;

create policy fotos_evento_select on public.fotos_evento for select
  using (public.evento_es_visible_staff(evento_id));

create or replace function public.fotos_por_dorsal(p_evento_id uuid, p_dorsal integer)
returns table (id uuid, url text)
language sql stable security definer set search_path = public, pg_temp
as $$
  select f.id, f.url
  from public.fotos_evento f
  where f.evento_id = p_evento_id
    and p_dorsal = any(f.numeros_dorsal)
    and public.evento_es_visible_publico(p_evento_id)
  order by f.created_at
  limit 200;
$$;

grant execute on function public.fotos_por_dorsal(uuid, integer) to anon, authenticated;
