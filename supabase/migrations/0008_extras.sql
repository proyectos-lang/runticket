create table public.encuestas_satisfaccion (
  id              uuid primary key default gen_random_uuid(),
  evento_id       uuid not null references public.eventos(id) on delete cascade,
  inscripcion_id  uuid not null references public.inscripciones(id) on delete cascade,
  puntaje_nps     integer not null check (puntaje_nps between 0 and 10),
  comentario      text,
  respondido_en   timestamptz not null default now(),
  created_at      timestamptz not null default now()
);
create index encuestas_evento_idx on public.encuestas_satisfaccion (evento_id);
create unique index encuestas_inscripcion_idx on public.encuestas_satisfaccion (inscripcion_id);

create table public.insignias (
  id           uuid primary key default gen_random_uuid(),
  codigo       text not null unique,
  nombre       text not null,
  descripcion  text,
  criterio     jsonb not null default '{}'::jsonb,
  icono_url    text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid references auth.users(id)
);
create trigger set_updated_at before update on public.insignias for each row execute function public.set_updated_at();

create table public.usuario_insignias (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null references auth.users(id) on delete cascade,
  insignia_id   uuid not null references public.insignias(id) on delete cascade,
  obtenida_en   timestamptz not null default now(),
  unique (usuario_id, insignia_id)
);
create index usuario_insignias_usuario_idx on public.usuario_insignias (usuario_id);

alter table public.encuestas_satisfaccion enable row level security;
alter table public.insignias enable row level security;
alter table public.usuario_insignias enable row level security;

create policy encuestas_select on public.encuestas_satisfaccion for select
  using (
    public.es_dueno_de_inscripcion(inscripcion_id)
    or public.es_miembro_de_empresa(public.empresa_de_evento(evento_id))
    or public.es_super_admin()
  );
create policy encuestas_insert on public.encuestas_satisfaccion for insert
  with check (public.es_dueno_de_inscripcion(inscripcion_id));
-- Sin update/delete: la respuesta es inmutable una vez enviada.

create policy insignias_select on public.insignias for select using (true);
create policy insignias_write on public.insignias for all
  using (public.es_super_admin()) with check (public.es_super_admin());

create policy usuario_insignias_select on public.usuario_insignias for select
  using (usuario_id = auth.uid() or public.es_super_admin());
-- Sin insert para authenticated/anon: se otorgan desde el servidor (service_role)
-- cuando se cumple el criterio (ej. al finalizar un evento).

-- Vista de exportación para cronometraje: solo columnas operativas, sin datos financieros.
-- security_invoker=true: respeta el RLS de quien consulta, no hereda privilegios del creador.
create or replace view public.vista_exportacion_cronometraje
  with (security_invoker = true) as
select
  i.evento_id,
  i.numero_dorsal,
  trim(coalesce(p.nombres, '') || ' ' || coalesce(p.apellidos, '')) as nombre_completo,
  c.nombre as categoria,
  p.sexo,
  null::text as chip
from public.inscripciones i
join public.categorias c on c.id = i.categoria_id
join public.perfiles p on p.id = i.corredor_id
where i.estado = 'activa';

-- Nota: la "landing page por empresa" no requiere tabla nueva — se resuelve en el código
-- con empresas.slug (ruta /organizadores/[slug]), ya definido en 0002.
