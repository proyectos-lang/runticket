-- =========================================================================
-- Fase 2: portal público e inscripción del corredor.
-- =========================================================================

-- ---------------------------------------------------------------------------
-- 1) Distancia numérica por categoría (el filtro público la necesita; el nombre
--    "10K" es texto libre y no sirve para ordenar ni filtrar por rango).
-- ---------------------------------------------------------------------------
alter table public.categorias add column if not exists distancia_km numeric(6,2);

-- ---------------------------------------------------------------------------
-- 2) Un corredor no puede tener dos inscripciones activas en el mismo evento.
-- ---------------------------------------------------------------------------
create unique index if not exists inscripciones_evento_corredor_activa_idx
  on public.inscripciones (evento_id, corredor_id)
  where estado = 'activa';

-- ---------------------------------------------------------------------------
-- 3) Cupos en tiempo real para el público.
--
-- `inscripciones` no es legible por anon (correcto: son datos personales), así
-- que el conteo se expone con una función security definer que solo devuelve
-- agregados y únicamente de eventos visibles.
-- ---------------------------------------------------------------------------
create or replace function public.categorias_con_cupo(p_evento_id uuid)
returns table (
  id uuid,
  nombre text,
  distancia_km numeric,
  precio_base numeric,
  precio_vigente numeric,
  cupo_maximo integer,
  edad_minima integer,
  edad_maxima integer,
  hora_salida time,
  inscritos integer,
  cupos_disponibles integer
)
language sql stable security definer set search_path = public, pg_temp
as $$
  select
    c.id,
    c.nombre,
    c.distancia_km,
    c.precio_base,
    coalesce(
      (select pe.precio from public.precios_escalonados pe
        where pe.categoria_id = c.id and now() between pe.fecha_inicio and pe.fecha_fin
        order by pe.fecha_inicio desc limit 1),
      c.precio_base
    ) as precio_vigente,
    c.cupo_maximo,
    c.edad_minima,
    c.edad_maxima,
    c.hora_salida,
    coalesce(cnt.n, 0)::integer as inscritos,
    case when c.cupo_maximo is null then null
         else greatest(c.cupo_maximo - coalesce(cnt.n, 0), 0)::integer end as cupos_disponibles
  from public.categorias c
  left join lateral (
    select count(*)::integer as n
    from public.inscripciones i
    where i.categoria_id = c.id and i.estado = 'activa'
  ) cnt on true
  where c.evento_id = p_evento_id
    and (public.evento_es_visible_publico(p_evento_id) or public.evento_es_visible_staff(p_evento_id))
  order by c.distancia_km nulls last, c.nombre;
$$;

grant execute on function public.categorias_con_cupo(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4) Inscripción atómica.
--
-- Hacer esto desde la aplicación abriría una carrera entre "consultar cupo" y
-- "insertar": dos corredores podrían tomar la última plaza a la vez. Aquí se
-- serializa por categoría con un advisory lock y se valida todo en la misma
-- transacción, incluida la firma de la declaración de salud, para que no pueda
-- quedar una inscripción sin su documento legal asociado.
-- ---------------------------------------------------------------------------
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
  p_tutor_documento  text default null
)
returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_usuario uuid := auth.uid();
  v_cat public.categorias%rowtype;
  v_evento public.eventos%rowtype;
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

  -- Serializa por categoría: evita que dos corredores tomen la última plaza.
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

  insert into public.inscripciones (
    evento_id, categoria_id, empresa_id, corredor_id, talla,
    precio_pagado, moneda, estado, datos_adicionales, created_by
  ) values (
    v_evento.id, v_cat.id, v_evento.empresa_id, v_usuario, p_talla,
    v_precio, v_evento.moneda, 'activa', coalesce(p_datos_adicionales, '{}'::jsonb), v_usuario
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

grant execute on function public.inscribirse_en_evento(uuid, uuid, text, jsonb, text, boolean, inet, text, text, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 5) Al anular una inscripción, devolver la talla al inventario.
-- ---------------------------------------------------------------------------
create or replace function public.devolver_talla_al_anular()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if old.estado = 'activa' and new.estado in ('anulada','transferida')
     and new.talla is not null then
    update public.evento_tallas
      set inventario_disponible = inventario_disponible + 1
      where evento_id = new.evento_id and talla = new.talla
        and inventario_disponible is not null;
  end if;
  return new;
end;
$$;

drop trigger if exists devolver_talla_al_anular on public.inscripciones;
create trigger devolver_talla_al_anular
  after update on public.inscripciones
  for each row execute function public.devolver_talla_al_anular();