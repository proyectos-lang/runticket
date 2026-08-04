-- 0021 · Campos que pide el rediseño y no existían en el esquema.
--
-- El diseño aprobado muestra en el listado un filtro por disciplina y otro por
-- departamento, un chip de desnivel en el selector de distancia, el contenido
-- del kit en la ficha del evento y los puntos donde se retira ese kit. Nada de
-- eso se podía pintar con datos reales hasta ahora.
--
-- `distancia_km` NO se añade aquí: ya existe en `categorias` desde la 0011.

-- ---------------------------------------------------------------------------
-- eventos
-- ---------------------------------------------------------------------------

-- `not null default` y no una columna anulable: la disciplina es el filtro
-- principal del listado, y un evento sin disciplina desaparecería de todos los
-- filtros en vez de aparecer en el que le toca. Los eventos ya creados son
-- carreras de ruta.
alter table public.eventos
  add column if not exists disciplina text not null default 'ruta'
    check (disciplina in ('ruta','trail','montana','ciclismo','triatlon','caminata','otro'));

-- Sin `on delete cascade`: borrar un departamento del catálogo no puede
-- llevarse por delante los eventos que lo referencian.
alter table public.eventos
  add column if not exists departamento_id uuid references public.departamentos(id);

-- Lista de visualización («Camiseta técnica», «Medalla», «Chip»…). No merece
-- tabla propia: no se filtra por ella ni se relaciona con nada.
alter table public.eventos
  add column if not exists kit_contenido text[] not null default '{}';

create index if not exists eventos_disciplina_idx on public.eventos (disciplina);
create index if not exists eventos_departamento_idx on public.eventos (departamento_id);

-- ---------------------------------------------------------------------------
-- categorias
-- ---------------------------------------------------------------------------

alter table public.categorias
  add column if not exists desnivel_m integer check (desnivel_m >= 0);

-- ---------------------------------------------------------------------------
-- evento_puntos_entrega
-- ---------------------------------------------------------------------------

create table if not exists public.evento_puntos_entrega (
  id          uuid primary key default gen_random_uuid(),
  evento_id   uuid not null references public.eventos(id) on delete cascade,
  nombre      text not null,
  direccion   text,
  -- Texto libre y no un rango: los organizadores publican horarios como
  -- «viernes 2–7 p. m. y sábado 9 a. m.–1 p. m.», que ninguna estructura
  -- razonable representa sin estorbar.
  horario     text,
  lat         numeric(9,6),
  lng         numeric(9,6),
  orden       integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id)
);

create index if not exists evento_puntos_entrega_evento_idx
  on public.evento_puntos_entrega (evento_id);

drop trigger if exists set_updated_at on public.evento_puntos_entrega;
create trigger set_updated_at before update on public.evento_puntos_entrega
  for each row execute function public.set_updated_at();

alter table public.evento_puntos_entrega enable row level security;

-- Políticas espejo de `evento_imagenes`: se lee si el evento es público o si
-- quien pregunta es del equipo, y solo escribe la administración de la empresa.
drop policy if exists evento_puntos_entrega_select on public.evento_puntos_entrega;
create policy evento_puntos_entrega_select on public.evento_puntos_entrega for select
  using (public.evento_es_visible_publico(evento_id) or public.evento_es_visible_staff(evento_id));

drop policy if exists evento_puntos_entrega_write on public.evento_puntos_entrega;
create policy evento_puntos_entrega_write on public.evento_puntos_entrega for all
  using (public.es_admin_o_super(public.empresa_de_evento(evento_id)))
  with check (public.es_admin_o_super(public.empresa_de_evento(evento_id)));
