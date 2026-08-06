-- =========================================================================
-- Avisos al inscribirse: al corredor y, sobre todo, a la empresa.
--
-- Hasta ahora la tabla `notificaciones` existía desde 0007 pero solo escribía
-- en ella `notificar_siguiente_lista_espera`. El organizador no se enteraba de
-- una inscripción nueva por ningún medio: tenía que entrar al panel y mirar.
--
-- No hay correo transaccional en el proyecto (decisión de fase 2), así que el
-- aviso es dentro de la aplicación. `notificaciones` ya sirve: su RLS es
-- `usuario_id = auth.uid()`, y los miembros de una empresa son usuarios como
-- cualquier otro, de modo que la misma tabla y la misma política valen para la
-- bandeja del panel sin tocar nada de seguridad.
-- =========================================================================

-- ---------------------------------------------------------------------------
-- 1) Un aviso puede referirse a algo, y entonces no debe repetirse
--
-- Sin esto, recargar o reintentar la acción del servidor dejaría al organizador
-- tres avisos de la misma inscripción. La referencia es el grupo cuando la
-- inscripción es familiar y la inscripción cuando va sola.
-- ---------------------------------------------------------------------------
alter table public.notificaciones add column if not exists referencia_id uuid;

create unique index if not exists notificaciones_unicas_por_referencia
  on public.notificaciones (usuario_id, tipo, referencia_id)
  where referencia_id is not null;

comment on column public.notificaciones.referencia_id is
  'A qué se refiere el aviso (inscripción o grupo). Con el índice único evita que un reintento genere avisos repetidos del mismo hecho.';

-- ---------------------------------------------------------------------------
-- 2) Avisar de una inscripción recién hecha
--
-- Recibe **todas** las inscripciones de una misma operación —la del titular y
-- las de sus acompañantes— para poder mandar un solo aviso por familia en vez
-- de uno por persona. Con cuatro miembros, cuatro avisos idénticos en la bandeja
-- del organizador no informan más que uno bien redactado.
--
-- `security definer` porque escribe en la bandeja de **otros** usuarios (los
-- miembros de la empresa), cosa que la RLS no permite a nadie: la tabla no tiene
-- política de INSERT a propósito.
--
-- Por eso mismo comprueba antes que quien llama es dueño de todas ellas. Sin esa
-- comprobación sería un buzón abierto para escribirle a cualquiera.
-- ---------------------------------------------------------------------------
create or replace function public.avisar_de_inscripcion(p_inscripcion_ids uuid[])
returns integer
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_actor      uuid := auth.uid();
  v_evento     public.eventos%rowtype;
  v_titular    public.inscripciones%rowtype;
  v_nombres    text[];
  v_total      numeric;
  v_referencia uuid;
  v_quien      text;
  v_detalle    text;
  v_a_empresa  integer := 0;
begin
  if v_actor is null then
    raise exception 'Debes iniciar sesión';
  end if;
  if p_inscripcion_ids is null or array_length(p_inscripcion_ids, 1) is null then
    return 0;
  end if;

  -- Todas tienen que ser suyas: la propia o la de alguien de su lista. Si
  -- aparece una ajena se aborta entero, no se filtra: quien llama con una
  -- inscripción que no es suya no está usando el portal.
  if exists (
    select 1 from public.inscripciones i
    where i.id = any(p_inscripcion_ids)
      and i.corredor_id <> v_actor
      and not public.es_acompanante_mio(i.corredor_id)
  ) then
    raise exception 'Esas inscripciones no son tuyas';
  end if;

  -- La del titular manda: da el evento, el enlace y el nombre de quien inscribe.
  select * into v_titular from public.inscripciones
    where id = any(p_inscripcion_ids) and corredor_id = v_actor
    limit 1;
  if not found then
    select * into v_titular from public.inscripciones
      where id = any(p_inscripcion_ids) limit 1;
  end if;
  if not found then return 0; end if;

  select * into v_evento from public.eventos where id = v_titular.evento_id;
  if not found then return 0; end if;

  select array_agg(trim(coalesce(p.nombres, '') || ' ' || coalesce(p.apellidos, ''))
                   order by (i.corredor_id = v_actor) desc),
         sum(i.precio_pagado)
    into v_nombres, v_total
  from public.inscripciones i
  join public.perfiles p on p.id = i.corredor_id
  where i.id = any(p_inscripcion_ids);

  v_quien      := coalesce(v_nombres[1], 'Un corredor');
  v_referencia := coalesce(v_titular.grupo_inscripcion_id, v_titular.id);
  v_detalle    := case
                    when array_length(v_nombres, 1) > 1
                      then v_quien || ' y ' || (array_length(v_nombres, 1) - 1) ||
                           ' acompañante(s): ' || array_to_string(v_nombres[2:], ', ')
                    else v_quien
                  end;

  -- ── Al corredor: su comprobante de que quedó dentro ──────────────────────
  insert into public.notificaciones (usuario_id, tipo, titulo, mensaje, enlace, referencia_id)
  values (
    v_actor,
    'inscripcion_confirmada',
    'Ya estás inscrito en ' || v_evento.nombre,
    case
      when array_length(v_nombres, 1) > 1
        then 'Quedaron dentro ' || array_length(v_nombres, 1) ||
             ' personas: ' || array_to_string(v_nombres, ', ') ||
             '. El dorsal de cada una se asigna cuando el organizador confirme el pago.'
      else 'Tu plaza está reservada. El dorsal se asigna cuando el organizador confirme el pago.'
    end,
    '/portal/inscripciones/' || v_titular.id,
    v_referencia
  )
  on conflict do nothing;

  -- ── A la empresa: una fila por miembro activo ────────────────────────────
  --
  -- Una por miembro y no una «de la empresa» porque `notificaciones` es personal
  -- por diseño: cada quien marca como leído lo suyo. Un aviso compartido
  -- desaparecería de la bandeja del segundo en cuanto el primero lo abriera.
  insert into public.notificaciones (usuario_id, tipo, titulo, mensaje, enlace, referencia_id)
  select
    m.usuario_id,
    'inscripcion_nueva',
    'Nueva inscripción en ' || v_evento.nombre,
    -- `to_char` con máscara fija y sin separador de miles: el separador depende
    -- de la configuración regional del servidor y aquí solo se necesita una
    -- cifra legible y estable.
    v_detalle || ' · ' || trim(to_char(coalesce(v_total, 0), 'FM999999990.00')) || ' ' || v_evento.moneda ||
      case when coalesce(v_total, 0) > 0 then ' pendientes de cobro.' else '.' end,
    '/panel/eventos/' || v_evento.id || '/inscritos',
    v_referencia
  from public.empresa_miembros m
  where m.empresa_id = v_evento.empresa_id and m.estado = 'activo'
  on conflict do nothing;

  get diagnostics v_a_empresa = row_count;
  return v_a_empresa;
end;
$$;

grant execute on function public.avisar_de_inscripcion(uuid[]) to authenticated;

comment on function public.avisar_de_inscripcion(uuid[]) is
  'Deja un aviso al corredor y otro a cada miembro activo de la empresa tras una inscripción. Recibe la operación completa (titular y acompañantes) para mandar un solo aviso por familia. Idempotente: repetir la llamada no duplica nada.';

-- ---------------------------------------------------------------------------
-- 3) Quién responde por cada inscrito
--
-- Un acompañante lleva una dirección interna inventada (`acompanante-…@
-- interno.runticket.hn`), porque `createUser` exige un correo y esa persona no
-- va a recibir nunca ninguno. En la lista de inscritos del panel eso salía tal
-- cual bajo su nombre: un correo falso al que escribir y **ninguna pista** de
-- quién es el adulto responsable de ese dorsal.
--
-- La política de `acompanantes` es del titular, no de la empresa —y así debe
-- seguir: una empresa no tiene por qué leerse las listas familiares enteras—.
-- Esta función abre justo la rendija necesaria: solo las personas inscritas en
-- **un evento suyo**, y solo si quien pregunta es miembro de esa empresa.
-- ---------------------------------------------------------------------------
create or replace function public.gestores_de_inscritos(p_evento_id uuid)
returns table (usuario_id uuid, titular_nombre text, titular_telefono text)
language sql stable security definer set search_path = public, pg_temp
as $$
  select distinct on (a.usuario_id)
    a.usuario_id,
    nullif(trim(coalesce(p.nombres, '') || ' ' || coalesce(p.apellidos, '')), ''),
    p.telefono
  from public.acompanantes a
  join public.perfiles p on p.id = a.titular_id
  where (
      public.es_miembro_de_empresa(public.empresa_de_evento(p_evento_id))
      or public.es_super_admin()
    )
    and exists (
      select 1 from public.inscripciones i
      where i.evento_id = p_evento_id and i.corredor_id = a.usuario_id
    )
  -- Con varios titulares gana el primero que lo dio de alta, que es el que
  -- viene respondiendo por él.
  order by a.usuario_id, a.created_at;
$$;

grant execute on function public.gestores_de_inscritos(uuid) to authenticated;

comment on function public.gestores_de_inscritos(uuid) is
  'Para el panel: quién gestiona a cada acompañante inscrito en un evento, con su teléfono. Solo devuelve filas a miembros de la empresa dueña del evento.';
