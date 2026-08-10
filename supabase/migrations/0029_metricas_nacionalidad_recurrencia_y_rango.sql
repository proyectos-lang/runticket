-- Métricas del evento: nacionalidad (6.6), recurrencia del corredor (6.12) y
-- filtro por rango libre de fechas (6.15).
--
-- La firma cambia: se le añaden dos fechas opcionales. Hay que soltar la de un
-- solo argumento antes de crear la nueva, o las dos convivirían y una llamada
-- con un único parámetro quedaría ambigua.
drop function if exists public.metricas_evento(uuid);

-- El rango acota **por fecha de inscripción**, no por fecha de carrera: la
-- pregunta que responde es «qué pasó entre estas dos fechas» —el efecto de una
-- promoción, de un tramo de precio o de la última semana de plazo—.
--
-- La fecha se interpreta en la zona horaria del evento y no en la del servidor.
-- Sin eso, en producción (UTC) las inscripciones de la tarde de un día caerían
-- en el siguiente y los bordes del rango dejarían fuera lo que sí entra.
--
-- «Recurrente» es **por empresa organizadora**, nunca por plataforma: que la
-- empresa A supiera que un corredor suyo también corre con la B sería una fuga
-- entre inquilinos, justo lo que el aislamiento multiempresa existe para
-- impedir. Se cuenta sobre corredores distintos, no sobre inscripciones, porque
-- lo que se pregunta es cuánta gente repite.
create or replace function public.metricas_evento(
  p_evento_id uuid,
  p_desde     date default null,
  p_hasta     date default null
)
returns jsonb
language sql stable security definer set search_path = public, pg_temp
as $$
  select case
    when not (public.evento_es_visible_staff(p_evento_id)) then '{}'::jsonb
    else (
      with evento as (
        select e.id, e.empresa_id, e.fecha_inicio, e.zona_horaria
        from public.eventos e
        where e.id = p_evento_id
      ),
      activas as (
        select i.id, i.corredor_id, i.categoria_id, i.talla, i.kit_entregado, i.created_at
        from public.inscripciones i
        cross join evento e
        where i.evento_id = e.id
          and i.estado = 'activa'
          and (p_desde is null or (i.created_at at time zone e.zona_horaria)::date >= p_desde)
          and (p_hasta is null or (i.created_at at time zone e.zona_horaria)::date <= p_hasta)
      ),
      -- Una fila por corredor distinto del evento, con cuántas carreras
      -- anteriores de esta misma empresa tiene a la espalda.
      corredores as (
        select
          c.corredor_id,
          (
            select count(distinct i2.evento_id)
            from public.inscripciones i2
            join public.eventos e2 on e2.id = i2.evento_id
            cross join evento e
            where i2.corredor_id = c.corredor_id
              and i2.estado = 'activa'
              and e2.empresa_id = e.empresa_id
              and e2.id <> e.id
              and e2.fecha_inicio < e.fecha_inicio
          )::int as previas
        from (select distinct corredor_id from activas) c
      )
      select jsonb_build_object(
        'inscritos', (select count(*) from activas),
        -- Las anuladas siguen el mismo rango que las activas. Si no, con un
        -- rango puesto la pantalla enfrentaría los inscritos de una semana
        -- contra las bajas de toda la carrera.
        'anuladas', (
          select count(*)
          from public.inscripciones i
          cross join evento e
          where i.evento_id = e.id
            and i.estado = 'anulada'
            and (p_desde is null or (i.created_at at time zone e.zona_horaria)::date >= p_desde)
            and (p_hasta is null or (i.created_at at time zone e.zona_horaria)::date <= p_hasta)
        ),
        'kits_entregados', (select count(*) from activas where kit_entregado),
        'por_categoria', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'categoria', c.nombre, 'cupo', c.cupo_maximo, 'inscritos', x.n) order by c.nombre), '[]'::jsonb)
          from public.categorias c
          left join lateral (
            select count(*)::int as n from activas a where a.categoria_id = c.id) x on true
          where c.evento_id = p_evento_id
        ),
        'por_sexo', (
          select coalesce(jsonb_object_agg(sexo, n), '{}'::jsonb) from (
            select coalesce(p.sexo, 'sin_dato') as sexo, count(*)::int as n
            from activas a join public.perfiles p on p.id = a.corredor_id
            group by 1) s
        ),
        'por_talla', (
          select coalesce(jsonb_object_agg(talla, n), '{}'::jsonb) from (
            select coalesce(a.talla, 'sin_talla') as talla, count(*)::int as n
            from activas a group by 1) t
        ),
        'por_experiencia', (
          select coalesce(jsonb_object_agg(nivel, n), '{}'::jsonb) from (
            select coalesce(p.nivel_experiencia, 'sin_dato') as nivel, count(*)::int as n
            from activas a join public.perfiles p on p.id = a.corredor_id
            group by 1) x
        ),
        'por_origen', (
          select coalesce(jsonb_object_agg(origen, n), '{}'::jsonb) from (
            select coalesce(p.como_se_entero, 'sin_dato') as origen, count(*)::int as n
            from activas a join public.perfiles p on p.id = a.corredor_id
            group by 1) x
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
              from activas a
              join public.perfiles p on p.id = a.corredor_id
              cross join evento e
              where p.fecha_nacimiento is not null
            ) edades group by rango) r
        ),
        'por_ciudad', (
          select coalesce(jsonb_object_agg(ciudad, n), '{}'::jsonb) from (
            select coalesce(ci.nombre, 'Sin dato') as ciudad, count(*)::int as n
            from activas a
            join public.perfiles p on p.id = a.corredor_id
            left join public.ciudades ci on ci.id = p.ciudad_id
            group by ci.nombre order by count(*) desc limit 10) c
        ),
        -- 6.6. Es texto libre en el perfil, así que se normaliza el espaciado y
        -- lo vacío cuenta como «Sin dato»; sin eso salen «Honduras» y
        -- «Honduras » como dos nacionalidades distintas.
        'por_nacionalidad', (
          select coalesce(jsonb_object_agg(nacionalidad, n), '{}'::jsonb) from (
            select coalesce(nullif(trim(p.nacionalidad), ''), 'Sin dato') as nacionalidad,
                   count(*)::int as n
            from activas a
            join public.perfiles p on p.id = a.corredor_id
            group by 1 order by count(*) desc limit 10) x
        ),
        -- 6.12.
        'recurrencia', (
          select jsonb_build_object(
            'corredores', count(*)::int,
            'recurrentes', count(*) filter (where previas > 0)::int,
            'nuevos', count(*) filter (where previas = 0)::int
          )
          from corredores
        ),
        'inscripciones_por_dia', (
          select coalesce(jsonb_object_agg(dia::text, n), '{}'::jsonb) from (
            select (a.created_at at time zone e.zona_horaria)::date as dia, count(*)::int as n
            from activas a cross join evento e
            group by 1) d
        )
      )
    )
  end;
$$;

grant execute on function public.metricas_evento(uuid, date, date) to authenticated;

-- Las inscripciones se cruzan por corredor y por evento en cada cálculo de
-- recurrencia; sin este índice es un recorrido completo de la tabla por cada
-- corredor del padrón.
create index if not exists inscripciones_corredor_estado_idx
  on public.inscripciones (corredor_id, estado);

-- ---------------------------------------------------------------------------
-- Conciliación del evento
--
-- Existe por dos motivos, y ninguno es cosmético.
--
-- 1) **Corrige una cifra falsa.** La pantalla de métricas se traía *todos* los
--    pagos de la empresa y los cruzaba en memoria contra las inscripciones del
--    evento por `inscripcion_id`. Desde el pago familiar (0028) un pago de grupo
--    tiene `inscripcion_id` nulo y solo `grupo_inscripcion_id`, así que **todo
--    lo cobrado a familias quedaba fuera del recaudado**. Aquí se contempla la
--    inscripción suelta y el grupo.
--
-- 2) **Deja de traerse la tabla entera.** Con varios años de historia, abrir las
--    métricas de una carrera descargaba el histórico de cobros completo de la
--    empresa para quedarse con una parte. La agregación baja a Postgres.
--
-- El rango es el mismo que el de `metricas_evento` —fecha de inscripción, en la
-- zona del evento— para que las dos mitades de la pantalla hablen del mismo
-- periodo. Un pago familiar cuyo grupo caiga parcialmente dentro del rango se
-- cuenta entero: el dinero entró de una vez y no es divisible por fecha.
create or replace function public.conciliacion_evento(
  p_evento_id uuid,
  p_desde     date default null,
  p_hasta     date default null
)
returns jsonb
language sql stable security definer set search_path = public, pg_temp
as $$
  select case
    when not (public.evento_es_visible_staff(p_evento_id)) then '{}'::jsonb
    else (
      with evento as (
        select e.id, e.zona_horaria from public.eventos e where e.id = p_evento_id
      ),
      activas as (
        select i.id, i.grupo_inscripcion_id
        from public.inscripciones i
        cross join evento e
        where i.evento_id = e.id
          and i.estado = 'activa'
          and (p_desde is null or (i.created_at at time zone e.zona_horaria)::date >= p_desde)
          and (p_hasta is null or (i.created_at at time zone e.zona_horaria)::date <= p_hasta)
      ),
      pagos_evento as (
        select distinct pg.id, pg.monto, pg.metodo, pg.estado, pg.verificado_en, pg.created_at
        from public.pagos pg
        where exists (select 1 from activas a where a.id = pg.inscripcion_id)
           or (
             pg.grupo_inscripcion_id is not null
             and exists (select 1 from activas a where a.grupo_inscripcion_id = pg.grupo_inscripcion_id)
           )
      ),
      -- La conversión se cuenta **por inscripción y no por pago**: un pago
      -- familiar cubre a cuatro personas, y contarlo como uno hundía la tasa de
      -- las carreras con muchas familias. Manda el intento más reciente: quien
      -- tuvo un rechazo y luego un cobro bueno está pagado.
      pagadas as (
        select count(*)::int as n
        from activas a
        where (
          select pg.estado
          from public.pagos pg
          where pg.inscripcion_id = a.id
             or (a.grupo_inscripcion_id is not null
                 and pg.grupo_inscripcion_id = a.grupo_inscripcion_id)
          order by pg.created_at desc
          limit 1
        ) = 'pagado'
      )
      select jsonb_build_object(
        'total_pagado', (
          select coalesce(sum(monto), 0)::numeric from pagos_evento where estado = 'pagado'),
        'total_pendiente', (
          select coalesce(sum(monto), 0)::numeric from pagos_evento where estado = 'pendiente'),
        'total_en_verificacion', (
          select coalesce(sum(monto), 0)::numeric from pagos_evento where estado = 'en_verificacion'),
        'inscripciones_pagadas', (select n from pagadas),
        'por_metodo', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'metodo', metodo, 'total', total, 'cantidad', cantidad) order by total desc), '[]'::jsonb)
          from (
            select metodo, sum(monto)::numeric as total, count(*)::int as cantidad
            from pagos_evento where estado = 'pagado' group by metodo) m
        ),
        'por_dia', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'dia', dia, 'total', total, 'cantidad', cantidad) order by dia), '[]'::jsonb)
          from (
            -- El día en que se confirmó el cobro, no el de la inscripción.
            select (coalesce(pe.verificado_en, pe.created_at) at time zone e.zona_horaria)::date::text as dia,
                   sum(pe.monto)::numeric as total,
                   count(*)::int as cantidad
            from pagos_evento pe cross join evento e
            where pe.estado = 'pagado'
            group by 1) d
        )
      )
    )
  end;
$$;

grant execute on function public.conciliacion_evento(uuid, date, date) to authenticated;

comment on function public.conciliacion_evento(uuid, date, date) is
  'Totales cobrados de un evento, contemplando el pago familiar (grupo_inscripcion_id). Agrega en la base para no traer el histórico de la empresa al servidor de aplicación.';

-- ---------------------------------------------------------------------------
-- Recurrencia fila a fila, para el padrón
--
-- `metricas_evento` da el agregado; esto da el dato por corredor, que es lo que
-- el informe de inscritos necesita para marcar cada fila y para poder filtrar
-- «solo los que repiten».
--
-- Va por RPC y no por consulta directa por el mismo motivo que
-- `gestores_de_inscritos`: cruzar el historial exigiría que el panel leyera
-- inscripciones de otras carreras corredor a corredor, y la lista de corredores
-- del padrón no cabe en la URL de PostgREST. Aquí entra un evento y sale lo
-- justo, tras comprobar la membresía.
create or replace function public.recurrencia_de_inscritos(p_evento_id uuid)
returns table (corredor_id uuid, carreras_previas integer)
language sql stable security definer set search_path = public, pg_temp
as $$
  select
    i.corredor_id,
    (
      select count(distinct i2.evento_id)::int
      from public.inscripciones i2
      join public.eventos e2 on e2.id = i2.evento_id
      where i2.corredor_id = i.corredor_id
        and i2.estado = 'activa'
        and e2.empresa_id = e.empresa_id
        and e2.id <> e.id
        and e2.fecha_inicio < e.fecha_inicio
    )
  from public.inscripciones i
  join public.eventos e on e.id = i.evento_id
  where i.evento_id = p_evento_id
    and i.estado = 'activa'
    and (
      public.es_miembro_de_empresa(e.empresa_id)
      or public.es_super_admin()
    )
  group by i.corredor_id, e.id, e.empresa_id, e.fecha_inicio;
$$;

grant execute on function public.recurrencia_de_inscritos(uuid) to authenticated;

comment on function public.recurrencia_de_inscritos(uuid) is
  'Cuántas carreras anteriores de la MISMA empresa lleva cada inscrito de un evento. Nunca cruza empresas: eso rompería el aislamiento multiempresa.';
