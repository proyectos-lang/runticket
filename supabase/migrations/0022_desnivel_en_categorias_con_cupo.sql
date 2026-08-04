-- 0022 · `desnivel_m` en la función que alimenta el selector de distancia.
--
-- La 0021 añadió la columna a `categorias`, pero el selector público lee de
-- `categorias_con_cupo`, que declara su lista de columnas de salida: sin
-- añadirla aquí, el dato existe en la tabla y no llega nunca a la pantalla.
--
-- `create or replace` no puede cambiar el tipo de retorno de una función que ya
-- existe, así que primero se borra. Se recrea entera a continuación.
drop function if exists public.categorias_con_cupo(uuid);

create function public.categorias_con_cupo(p_evento_id uuid)
returns table (
  id uuid,
  nombre text,
  distancia_km numeric,
  desnivel_m integer,
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
    c.desnivel_m,
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
