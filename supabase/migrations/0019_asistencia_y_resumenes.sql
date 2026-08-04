-- =========================================================================
-- Control de asistencia (distinto de la entrega del kit) y funciones de
-- resumen para el panel.
-- =========================================================================

-- ---------------------------------------------------------------------------
-- 1) Asistencia al evento.
--
-- Hasta ahora solo existía `kit_entregado`, así que marcar el kit implicaba
-- presencia y falseaba el conteo: hay carreras donde el kit se recoge días antes
-- y gente que lo recoge pero no llega a correr. Son dos hechos distintos.
-- ---------------------------------------------------------------------------
alter table public.inscripciones
  add column if not exists asistencia_confirmada boolean not null default false,
  add column if not exists asistencia_en timestamptz,
  add column if not exists asistencia_por uuid references auth.users(id);

-- El trigger que ya blinda kit_entregado* tiene que cubrir también estas
-- columnas, o un corredor podría marcarse a sí mismo como presente.
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

create or replace function public.marcar_asistencia(p_inscripcion_id uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_insc public.inscripciones%rowtype;
begin
  select * into v_insc from public.inscripciones where id = p_inscripcion_id for update;
  if not found then raise exception 'La inscripción no existe'; end if;

  if not (public.es_miembro_de_empresa(v_insc.empresa_id) or public.es_super_admin()) then
    raise exception 'No autorizado';
  end if;
  if v_insc.estado <> 'activa' then
    raise exception 'Esta inscripción está %', v_insc.estado;
  end if;
  if v_insc.asistencia_confirmada then
    raise exception 'La asistencia ya estaba confirmada';
  end if;

  perform set_config('runticket.rpc_inscripciones', 'on', true);
  update public.inscripciones
    set asistencia_confirmada = true,
        asistencia_en = now(),
        asistencia_por = auth.uid(),
        updated_at = now()
    where id = p_inscripcion_id;
  perform set_config('runticket.rpc_inscripciones', 'off', true);
end;
$$;

grant execute on function public.marcar_asistencia(uuid) to authenticated;

-- Las funciones de búsqueda del escáner tienen que devolver también la
-- asistencia, o el operador no sabría si esa persona ya pasó por el control.
--
-- Se borran antes de recrearlas: `create or replace` no puede cambiar el tipo de
-- retorno, y añadir columnas a un `returns table` lo cambia. Los permisos se
-- pierden al borrar, por eso se vuelven a conceder más abajo.
drop function if exists public.buscar_inscripcion_por_qr(uuid, text);
drop function if exists public.buscar_inscripcion_por_dorsal(uuid, integer);

create or replace function public.buscar_inscripcion_por_qr(p_evento_id uuid, p_codigo_qr text)
returns table (
  id uuid, numero_dorsal integer, nombre_completo text, categoria text, talla text,
  kit_entregado boolean, kit_entregado_en timestamptz,
  asistencia_confirmada boolean, asistencia_en timestamptz, estado text
)
language sql stable security definer set search_path = public, pg_temp
as $$
  select
    i.id, i.numero_dorsal,
    trim(coalesce(p.nombres, '') || ' ' || coalesce(p.apellidos, '')),
    c.nombre, i.talla, i.kit_entregado, i.kit_entregado_en,
    i.asistencia_confirmada, i.asistencia_en, i.estado
  from public.inscripciones i
  join public.categorias c on c.id = i.categoria_id
  join public.perfiles p on p.id = i.corredor_id
  where i.evento_id = p_evento_id
    and i.codigo_qr = p_codigo_qr
    and (public.es_miembro_de_empresa(i.empresa_id) or public.es_super_admin());
$$;

create or replace function public.buscar_inscripcion_por_dorsal(p_evento_id uuid, p_dorsal integer)
returns table (
  id uuid, numero_dorsal integer, nombre_completo text, categoria text, talla text,
  kit_entregado boolean, kit_entregado_en timestamptz,
  asistencia_confirmada boolean, asistencia_en timestamptz, estado text
)
language sql stable security definer set search_path = public, pg_temp
as $$
  select
    i.id, i.numero_dorsal,
    trim(coalesce(p.nombres, '') || ' ' || coalesce(p.apellidos, '')),
    c.nombre, i.talla, i.kit_entregado, i.kit_entregado_en,
    i.asistencia_confirmada, i.asistencia_en, i.estado
  from public.inscripciones i
  join public.categorias c on c.id = i.categoria_id
  join public.perfiles p on p.id = i.corredor_id
  where i.evento_id = p_evento_id
    and i.numero_dorsal = p_dorsal
    and (public.es_miembro_de_empresa(i.empresa_id) or public.es_super_admin());
$$;

grant execute on function public.buscar_inscripcion_por_qr(uuid, text) to authenticated;
grant execute on function public.buscar_inscripcion_por_dorsal(uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 2) Resumen de un evento para el centro de mando.
--
-- Evita 15 peticiones de conteo separadas cada vez que se abre la carrera.
-- ---------------------------------------------------------------------------
create or replace function public.resumen_evento(p_evento_id uuid)
returns jsonb
language sql stable security definer set search_path = public, pg_temp
as $$
  select case
    when not public.evento_es_visible_staff(p_evento_id) then '{}'::jsonb
    else jsonb_build_object(
      'inscritos', (select count(*) from public.inscripciones where evento_id = p_evento_id and estado = 'activa'),
      'anuladas', (select count(*) from public.inscripciones where evento_id = p_evento_id and estado = 'anulada'),
      'kits_entregados', (select count(*) from public.inscripciones where evento_id = p_evento_id and estado = 'activa' and kit_entregado),
      'asistencias', (select count(*) from public.inscripciones where evento_id = p_evento_id and estado = 'activa' and asistencia_confirmada),
      'categorias', (select count(*) from public.categorias where evento_id = p_evento_id),
      'tallas', (select count(*) from public.evento_tallas where evento_id = p_evento_id),
      'imagenes', (select count(*) from public.evento_imagenes where evento_id = p_evento_id),
      'patrocinadores', (select count(*) from public.patrocinadores where evento_id = p_evento_id),
      'tramos_precio', (
        select count(*) from public.precios_escalonados pe
        join public.categorias c on c.id = pe.categoria_id where c.evento_id = p_evento_id),
      'en_espera', (select count(*) from public.lista_espera where evento_id = p_evento_id and estado = 'esperando'),
      'resultados', (
        select count(*) from public.resultados r
        join public.inscripciones i on i.id = r.inscripcion_id where i.evento_id = p_evento_id),
      'resultados_publicados', (
        select count(*) from public.resultados r
        join public.inscripciones i on i.id = r.inscripcion_id
        where i.evento_id = p_evento_id and r.publicado),
      'tiene_banner', (select imagen_banner_url is not null from public.eventos where id = p_evento_id),
      'tiene_ubicacion', (select lat is not null and lng is not null from public.eventos where id = p_evento_id),
      'tiene_ruta', (select ruta_gpx_url is not null from public.eventos where id = p_evento_id),
      'tiene_descripcion', (select coalesce(length(trim(descripcion)), 0) > 0 from public.eventos where id = p_evento_id)
    )
  end;
$$;

grant execute on function public.resumen_evento(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3) Métricas agregadas de toda la empresa, para el inicio del panel.
--
-- El bloque financiero solo se rellena para administradores: un operador no debe
-- ver dinero ni llamando a esta función directamente.
-- ---------------------------------------------------------------------------
create or replace function public.metricas_empresa(p_empresa_id uuid)
returns jsonb
language sql stable security definer set search_path = public, pg_temp
as $$
  select case
    when not public.es_miembro_de_empresa(p_empresa_id) and not public.es_super_admin()
      then '{}'::jsonb
    else jsonb_build_object(
      'eventos_por_estado', (
        select coalesce(jsonb_object_agg(estado, n), '{}'::jsonb)
        from (select estado, count(*)::int as n from public.eventos
              where empresa_id = p_empresa_id group by estado) e
      ),
      'inscritos_totales', (
        select count(*) from public.inscripciones
        where empresa_id = p_empresa_id and estado = 'activa'),
      'corredores_distintos', (
        select count(distinct corredor_id) from public.inscripciones
        where empresa_id = p_empresa_id and estado = 'activa'),
      'proximo_evento', (
        select to_jsonb(x) from (
          select e.id, e.nombre, e.slug, e.fecha_inicio, e.estado,
                 (select count(*) from public.inscripciones i
                   where i.evento_id = e.id and i.estado = 'activa')::int as inscritos,
                 (select sum(c.cupo_maximo) from public.categorias c where c.evento_id = e.id)::int as cupo_total
          from public.eventos e
          where e.empresa_id = p_empresa_id and e.fecha_inicio >= now()
            and e.estado in ('publicado','inscripciones_cerradas')
          order by e.fecha_inicio limit 1) x
      ),
      'inscripciones_por_mes', (
        select coalesce(jsonb_object_agg(mes, n), '{}'::jsonb) from (
          select to_char(date_trunc('month', created_at), 'YYYY-MM') as mes, count(*)::int as n
          from public.inscripciones
          where empresa_id = p_empresa_id and estado = 'activa'
            and created_at > now() - interval '12 months'
          group by 1) m
      ),
      'top_eventos', (
        select coalesce(jsonb_agg(jsonb_build_object('evento', nombre, 'inscritos', n) order by n desc), '[]'::jsonb)
        from (
          select e.nombre, count(i.id)::int as n
          from public.eventos e
          left join public.inscripciones i on i.evento_id = e.id and i.estado = 'activa'
          where e.empresa_id = p_empresa_id
          group by e.id, e.nombre order by n desc limit 5) t
      ),
      'recaudado', case when public.es_admin_o_super(p_empresa_id) then
        (select coalesce(sum(monto), 0) from public.pagos
          where empresa_id = p_empresa_id and estado = 'pagado') else null end,
      'pendiente_cobro', case when public.es_admin_o_super(p_empresa_id) then
        (select coalesce(sum(monto), 0) from public.pagos
          where empresa_id = p_empresa_id and estado in ('pendiente','en_verificacion')) else null end,
      'pagos_por_verificar', case when public.es_admin_o_super(p_empresa_id) then
        (select count(*) from public.pagos
          where empresa_id = p_empresa_id and estado = 'en_verificacion') else null end
    )
  end;
$$;

grant execute on function public.metricas_empresa(uuid) to authenticated;
