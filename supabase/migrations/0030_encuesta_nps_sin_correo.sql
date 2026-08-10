-- =========================================================================
-- Encuesta de satisfacción (NPS) sin correo — requisito 9.5.
--
-- La tabla `encuestas_satisfaccion` existe desde la 0008 y nunca tuvo interfaz.
-- La objeción registrada era razonable: «sin correos la tasa de respuesta sería
-- mínima». Pero el correo está excluido a petición del cliente, así que la
-- alternativa no es no hacerlo: es **pedirla dentro del producto**, en el
-- momento en que el corredor ya está mirando.
--
-- Dos momentos, ninguno interruptivo:
--   * un aviso en la campana al dar la carrera por finalizada;
--   * un bloque en su ficha de inscripción y junto a su resultado, que es la
--     pantalla que abre por voluntad propia para ver su tiempo.
--
-- Aquí va lo que tiene que vivir en la base: el reparto de avisos y la
-- agregación del resultado. El formulario en sí usa el `insert` que la 0008 ya
-- concede al dueño de la inscripción; **no se abre ningún permiso nuevo**.
-- =========================================================================

-- ---------------------------------------------------------------------------
-- 1) Repartir el aviso al finalizar la carrera
--
-- Idempotente a propósito: el organizador puede volver a marcar la carrera como
-- finalizada, y nadie debe recibir dos veces la misma petición. Tampoco se
-- molesta a quien ya respondió.
-- ---------------------------------------------------------------------------
create or replace function public.avisar_encuesta_pendiente(p_evento_id uuid)
returns integer
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_evento public.eventos%rowtype;
  v_n      integer;
begin
  select * into v_evento from public.eventos where id = p_evento_id;
  if not found then raise exception 'El evento no existe'; end if;

  if not public.es_admin_o_super(v_evento.empresa_id) then
    raise exception 'No autorizado';
  end if;

  -- Solo tiene sentido preguntar por una carrera que ya se corrió.
  if v_evento.estado <> 'finalizado' then
    return 0;
  end if;

  -- La no repetición se apoya en el índice único
  -- `notificaciones (usuario_id, tipo, referencia_id)` que puso la 0027, no en
  -- un `not exists` que dos cierres simultáneos podrían esquivar.
  insert into public.notificaciones (usuario_id, tipo, titulo, mensaje, enlace, referencia_id)
  select
    i.corredor_id,
    'encuesta_pendiente',
    '¿Qué tal estuvo ' || v_evento.nombre || '?',
    'Cuéntale al organizador cómo te fue. Son dos toques y le sirve para la próxima edición.',
    '/portal/inscripciones/' || i.id::text,
    i.id
  from public.inscripciones i
  where i.evento_id = p_evento_id
    and i.estado = 'activa'
    -- A quien ya opinó no se le vuelve a pedir.
    and not exists (
      select 1 from public.encuestas_satisfaccion e where e.inscripcion_id = i.id
    )
  on conflict (usuario_id, tipo, referencia_id) where referencia_id is not null
  do nothing;

  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

grant execute on function public.avisar_encuesta_pendiente(uuid) to authenticated;

comment on function public.avisar_encuesta_pendiente(uuid) is
  'Reparte el aviso de encuesta a los inscritos de una carrera finalizada. Idempotente: no repite a quien ya lo tiene ni molesta a quien ya respondió.';

-- ---------------------------------------------------------------------------
-- 2) El resultado, para el organizador
--
-- El NPS no es la media de las notas. Es el porcentaje de promotores (9-10)
-- menos el de detractores (0-6), y va de -100 a +100. Se calcula aquí y no en el
-- servidor de aplicación para que la pantalla y cualquier exportación futura no
-- puedan discrepar en la fórmula.
--
-- Los comentarios se devuelven **sin identificar a quien los escribió**. La
-- encuesta se pide como opinión franca sobre la organización; si el organizador
-- pudiera poner nombre a cada queja, la franqueza se acaba. El vínculo con la
-- inscripción sigue en la tabla —hace falta para no preguntar dos veces— pero no
-- sale por aquí.
-- ---------------------------------------------------------------------------
create or replace function public.nps_evento(p_evento_id uuid)
returns jsonb
language sql stable security definer set search_path = public, pg_temp
as $$
  select case
    when not (public.evento_es_visible_staff(p_evento_id)) then '{}'::jsonb
    else (
      with respuestas as (
        select e.puntaje_nps, e.comentario, e.respondido_en
        from public.encuestas_satisfaccion e
        where e.evento_id = p_evento_id
      ),
      conteo as (
        select
          count(*)::int as respuestas,
          count(*) filter (where puntaje_nps >= 9)::int as promotores,
          count(*) filter (where puntaje_nps between 7 and 8)::int as pasivos,
          count(*) filter (where puntaje_nps <= 6)::int as detractores
        from respuestas
      )
      select jsonb_build_object(
        'respuestas', c.respuestas,
        'invitados', (
          select count(*)::int from public.inscripciones
          where evento_id = p_evento_id and estado = 'activa'
        ),
        'promotores', c.promotores,
        'pasivos', c.pasivos,
        'detractores', c.detractores,
        'nps', case
          when c.respuestas = 0 then null
          else round(((c.promotores - c.detractores)::numeric * 100) / c.respuestas)::int
        end,
        'promedio', (select round(avg(puntaje_nps), 1) from respuestas),
        'comentarios', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'puntaje', puntaje_nps,
            'comentario', comentario,
            'respondido_en', respondido_en
          ) order by respondido_en desc), '[]'::jsonb)
          from (
            select puntaje_nps, comentario, respondido_en
            from respuestas
            where nullif(trim(comentario), '') is not null
            order by respondido_en desc
            limit 100
          ) x
        )
      )
      from conteo c
    )
  end;
$$;

grant execute on function public.nps_evento(uuid) to authenticated;

comment on function public.nps_evento(uuid) is
  'NPS de un evento (promotores - detractores, en porcentaje) con sus comentarios anónimos. Solo responde al staff de la empresa dueña.';
