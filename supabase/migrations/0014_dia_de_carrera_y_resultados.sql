-- =========================================================================
-- Fase 3: día de la carrera (check-in por QR), lista de espera, resultados y
-- certificados.
-- =========================================================================

-- ---------------------------------------------------------------------------
-- 1) Check-in por QR.
--
-- El operador escanea y necesita resolver el QR a una inscripción. No se le
-- puede dar un SELECT abierto por codigo_qr sobre `inscripciones` (expondría el
-- padrón entero a fuerza bruta), así que la resolución va por una función que
-- exige ser staff del evento y devuelve solo lo necesario para entregar el kit.
-- Nunca incluye información financiera: el operador no la puede ver.
-- ---------------------------------------------------------------------------
create or replace function public.buscar_inscripcion_por_qr(p_evento_id uuid, p_codigo_qr text)
returns table (
  id uuid,
  numero_dorsal integer,
  nombre_completo text,
  categoria text,
  talla text,
  kit_entregado boolean,
  kit_entregado_en timestamptz,
  estado text
)
language sql stable security definer set search_path = public, pg_temp
as $$
  select
    i.id,
    i.numero_dorsal,
    trim(coalesce(p.nombres, '') || ' ' || coalesce(p.apellidos, '')),
    c.nombre,
    i.talla,
    i.kit_entregado,
    i.kit_entregado_en,
    i.estado
  from public.inscripciones i
  join public.categorias c on c.id = i.categoria_id
  join public.perfiles p on p.id = i.corredor_id
  where i.evento_id = p_evento_id
    and i.codigo_qr = p_codigo_qr
    and (public.es_miembro_de_empresa(i.empresa_id) or public.es_super_admin());
$$;

grant execute on function public.buscar_inscripcion_por_qr(uuid, text) to authenticated;

-- Misma resolución pero por número de dorsal: si la cámara falla o el corredor
-- olvidó el teléfono, el operador teclea el dorsal y sigue atendiendo.
create or replace function public.buscar_inscripcion_por_dorsal(p_evento_id uuid, p_dorsal integer)
returns table (
  id uuid,
  numero_dorsal integer,
  nombre_completo text,
  categoria text,
  talla text,
  kit_entregado boolean,
  kit_entregado_en timestamptz,
  estado text
)
language sql stable security definer set search_path = public, pg_temp
as $$
  select
    i.id, i.numero_dorsal,
    trim(coalesce(p.nombres, '') || ' ' || coalesce(p.apellidos, '')),
    c.nombre, i.talla, i.kit_entregado, i.kit_entregado_en, i.estado
  from public.inscripciones i
  join public.categorias c on c.id = i.categoria_id
  join public.perfiles p on p.id = i.corredor_id
  where i.evento_id = p_evento_id
    and i.numero_dorsal = p_dorsal
    and (public.es_miembro_de_empresa(i.empresa_id) or public.es_super_admin());
$$;

grant execute on function public.buscar_inscripcion_por_dorsal(uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 2) Inventario de tallas en tiempo real.
--
-- Lo que el organizador necesita para comprar exactamente lo que hace falta:
-- cuántas prendas se han comprometido por talla frente al inventario cargado.
-- ---------------------------------------------------------------------------
create or replace function public.inventario_tallas(p_evento_id uuid)
returns table (
  talla text,
  inventario_total integer,
  inventario_disponible integer,
  comprometidas integer
)
language sql stable security definer set search_path = public, pg_temp
as $$
  select
    t.talla,
    t.inventario_total,
    t.inventario_disponible,
    coalesce((
      select count(*)::integer from public.inscripciones i
      where i.evento_id = p_evento_id and i.talla = t.talla and i.estado = 'activa'
    ), 0)
  from public.evento_tallas t
  where t.evento_id = p_evento_id
    and (public.evento_es_visible_staff(p_evento_id) or public.evento_es_visible_publico(p_evento_id))
  order by t.talla;
$$;

grant execute on function public.inventario_tallas(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3) Lista de espera: notificar al primero cuando se libera un cupo.
--
-- Sin correo todavía, así que la notificación es in-app: se crea la fila en
-- `notificaciones` y se abre una ventana de 24 h para que use el enlace.
-- ---------------------------------------------------------------------------
create or replace function public.notificar_siguiente_lista_espera(p_categoria_id uuid)
returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_le public.lista_espera%rowtype;
  v_evento public.eventos%rowtype;
  v_empresa uuid;
begin
  select e.* into v_evento
    from public.categorias c join public.eventos e on e.id = c.evento_id
    where c.id = p_categoria_id;
  if not found then raise exception 'La categoría no existe'; end if;
  v_empresa := v_evento.empresa_id;

  if not (public.es_miembro_de_empresa(v_empresa) or public.es_super_admin()) then
    raise exception 'No autorizado';
  end if;

  select * into v_le from public.lista_espera
    where categoria_id = p_categoria_id and estado = 'esperando'
    order by created_at
    limit 1
    for update;
  if not found then return null; end if;

  update public.lista_espera
    set estado = 'notificado',
        notificado_en = now(),
        enlace_expira_en = now() + interval '24 hours',
        updated_at = now()
    where id = v_le.id;

  insert into public.notificaciones (usuario_id, tipo, titulo, mensaje, enlace)
  values (
    v_le.usuario_id,
    'cupo_liberado',
    'Se liberó un cupo en ' || v_evento.nombre,
    'Tienes 24 horas para completar tu inscripción antes de que el cupo pase al siguiente de la lista.',
    '/eventos/' || v_evento.slug || '/inscripcion'
  );

  return v_le.id;
end;
$$;

grant execute on function public.notificar_siguiente_lista_espera(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4) Resultados: carga masiva por dorsal.
--
-- El cronometraje entrega un CSV con dorsal y tiempo. Resolver dorsal→inscripción
-- desde la aplicación exigiría leer el padrón completo; aquí se hace en una sola
-- operación y validando que quien la ejecuta es del evento.
-- ---------------------------------------------------------------------------
create or replace function public.registrar_resultado(
  p_evento_id uuid,
  p_dorsal integer,
  p_tiempo interval,
  p_posicion_general integer default null,
  p_posicion_categoria integer default null
)
returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_insc uuid;
  v_empresa uuid;
  v_resultado uuid;
begin
  select i.id, i.empresa_id into v_insc, v_empresa
    from public.inscripciones i
    where i.evento_id = p_evento_id and i.numero_dorsal = p_dorsal and i.estado = 'activa';
  if not found then
    raise exception 'No hay inscripción activa con el dorsal % en este evento', p_dorsal;
  end if;

  if not (public.es_miembro_de_empresa(v_empresa) or public.es_super_admin()) then
    raise exception 'No autorizado para registrar resultados';
  end if;

  insert into public.resultados (inscripcion_id, tiempo_oficial, posicion_general, posicion_categoria, created_by)
  values (v_insc, p_tiempo, p_posicion_general, p_posicion_categoria, auth.uid())
  on conflict (inscripcion_id) do update
    set tiempo_oficial = excluded.tiempo_oficial,
        posicion_general = excluded.posicion_general,
        posicion_categoria = excluded.posicion_categoria,
        updated_at = now()
  returning id into v_resultado;

  return v_resultado;
end;
$$;

grant execute on function public.registrar_resultado(uuid, integer, interval, integer, integer) to authenticated;

-- Calcula posiciones a partir de los tiempos ya cargados: general y por
-- categoría. Evita que el organizador tenga que numerar a mano.
create or replace function public.recalcular_posiciones(p_evento_id uuid)
returns integer
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_empresa uuid;
  v_actualizados integer;
begin
  select empresa_id into v_empresa from public.eventos where id = p_evento_id;
  if not (public.es_miembro_de_empresa(v_empresa) or public.es_super_admin()) then
    raise exception 'No autorizado';
  end if;

  with clasificacion as (
    select
      r.id,
      rank() over (order by r.tiempo_oficial) as general,
      rank() over (partition by i.categoria_id order by r.tiempo_oficial) as por_categoria
    from public.resultados r
    join public.inscripciones i on i.id = r.inscripcion_id
    where i.evento_id = p_evento_id and r.tiempo_oficial is not null
  )
  update public.resultados r
    set posicion_general = c.general,
        posicion_categoria = c.por_categoria,
        updated_at = now()
    from clasificacion c
    where r.id = c.id;

  get diagnostics v_actualizados = row_count;
  return v_actualizados;
end;
$$;

grant execute on function public.recalcular_posiciones(uuid) to authenticated;

-- Resultados públicos de un evento: `inscripciones` no es legible por anon, así
-- que la tabla pública se sirve desde aquí, solo con lo publicado.
create or replace function public.resultados_publicos(p_evento_id uuid)
returns table (
  numero_dorsal integer,
  nombre_completo text,
  categoria text,
  sexo text,
  tiempo_oficial interval,
  posicion_general integer,
  posicion_categoria integer
)
language sql stable security definer set search_path = public, pg_temp
as $$
  select
    i.numero_dorsal,
    trim(coalesce(p.nombres, '') || ' ' || coalesce(p.apellidos, '')),
    c.nombre,
    p.sexo,
    r.tiempo_oficial,
    r.posicion_general,
    r.posicion_categoria
  from public.resultados r
  join public.inscripciones i on i.id = r.inscripcion_id
  join public.categorias c on c.id = i.categoria_id
  join public.perfiles p on p.id = i.corredor_id
  where i.evento_id = p_evento_id
    and r.publicado = true
    and public.evento_es_visible_publico(p_evento_id)
  order by r.posicion_general nulls last, r.tiempo_oficial nulls last;
$$;

grant execute on function public.resultados_publicos(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5) Métricas agregadas del evento para el panel.
--
-- Devuelve conteos, nunca filas personales, para que la reportería no dependa de
-- traerse el padrón completo al servidor de la aplicación.
-- ---------------------------------------------------------------------------
create or replace function public.metricas_evento(p_evento_id uuid)
returns jsonb
language sql stable security definer set search_path = public, pg_temp
as $$
  select case
    when not (public.evento_es_visible_staff(p_evento_id)) then '{}'::jsonb
    else jsonb_build_object(
      'inscritos', (select count(*) from public.inscripciones where evento_id = p_evento_id and estado = 'activa'),
      'anuladas', (select count(*) from public.inscripciones where evento_id = p_evento_id and estado = 'anulada'),
      'kits_entregados', (select count(*) from public.inscripciones where evento_id = p_evento_id and estado = 'activa' and kit_entregado),
      'por_categoria', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'categoria', c.nombre, 'cupo', c.cupo_maximo, 'inscritos', x.n) order by c.nombre), '[]'::jsonb)
        from public.categorias c
        left join lateral (
          select count(*)::int as n from public.inscripciones i
          where i.categoria_id = c.id and i.estado = 'activa') x on true
        where c.evento_id = p_evento_id
      ),
      'por_sexo', (
        select coalesce(jsonb_object_agg(coalesce(p.sexo, 'sin_dato'), n), '{}'::jsonb) from (
          select p.sexo, count(*)::int as n
          from public.inscripciones i join public.perfiles p on p.id = i.corredor_id
          where i.evento_id = p_evento_id and i.estado = 'activa'
          group by p.sexo) p
      ),
      'por_talla', (
        select coalesce(jsonb_object_agg(coalesce(talla, 'sin_talla'), n), '{}'::jsonb) from (
          select talla, count(*)::int as n from public.inscripciones
          where evento_id = p_evento_id and estado = 'activa' group by talla) t
      ),
      'por_experiencia', (
        select coalesce(jsonb_object_agg(coalesce(p.nivel_experiencia, 'sin_dato'), n), '{}'::jsonb) from (
          select p.nivel_experiencia, count(*)::int as n
          from public.inscripciones i join public.perfiles p on p.id = i.corredor_id
          where i.evento_id = p_evento_id and i.estado = 'activa'
          group by p.nivel_experiencia) p
      ),
      'por_origen', (
        select coalesce(jsonb_object_agg(coalesce(p.como_se_entero, 'sin_dato'), n), '{}'::jsonb) from (
          select p.como_se_entero, count(*)::int as n
          from public.inscripciones i join public.perfiles p on p.id = i.corredor_id
          where i.evento_id = p_evento_id and i.estado = 'activa'
          group by p.como_se_entero) p
      ),
      'por_rango_edad', (
        select coalesce(jsonb_object_agg(rango, n), '{}'::jsonb) from (
          select case
            when edad < 18 then 'Menor de 18'
            when edad between 18 and 29 then '18-29'
            when edad between 30 and 39 then '30-39'
            when edad between 40 and 49 then '40-49'
            when edad between 50 and 59 then '50-59'
            else '60 o más' end as rango,
            count(*)::int as n
          from (
            select extract(year from age(e.fecha_inicio::date, p.fecha_nacimiento))::int as edad
            from public.inscripciones i
            join public.perfiles p on p.id = i.corredor_id
            join public.eventos e on e.id = i.evento_id
            where i.evento_id = p_evento_id and i.estado = 'activa' and p.fecha_nacimiento is not null
          ) edades group by rango) r
      ),
      'por_ciudad', (
        select coalesce(jsonb_object_agg(ciudad, n), '{}'::jsonb) from (
          select coalesce(ci.nombre, 'Sin dato') as ciudad, count(*)::int as n
          from public.inscripciones i
          join public.perfiles p on p.id = i.corredor_id
          left join public.ciudades ci on ci.id = p.ciudad_id
          where i.evento_id = p_evento_id and i.estado = 'activa'
          group by ci.nombre order by count(*) desc limit 10) c
      ),
      'inscripciones_por_dia', (
        select coalesce(jsonb_object_agg(dia::text, n), '{}'::jsonb) from (
          select created_at::date as dia, count(*)::int as n
          from public.inscripciones
          where evento_id = p_evento_id and estado = 'activa'
          group by created_at::date) d
      )
    )
  end;
$$;

grant execute on function public.metricas_evento(uuid) to authenticated;
