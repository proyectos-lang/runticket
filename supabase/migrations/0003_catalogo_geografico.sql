create table public.paises (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  codigo_iso  text not null unique,
  created_at  timestamptz not null default now()
);

create table public.departamentos (
  id          uuid primary key default gen_random_uuid(),
  pais_id     uuid not null references public.paises(id) on delete cascade,
  nombre      text not null,
  created_at  timestamptz not null default now(),
  unique (pais_id, nombre)
);

create table public.ciudades (
  id                uuid primary key default gen_random_uuid(),
  departamento_id   uuid not null references public.departamentos(id) on delete cascade,
  nombre            text not null,
  created_at        timestamptz not null default now(),
  unique (departamento_id, nombre)
);

create index departamentos_pais_idx on public.departamentos (pais_id);
create index ciudades_departamento_idx on public.ciudades (departamento_id);

-- Completa las FKs pendientes de perfiles (creadas en 0002 como uuid simple).
alter table public.perfiles
  add constraint perfiles_pais_id_fkey foreign key (pais_id) references public.paises(id),
  add constraint perfiles_departamento_id_fkey foreign key (departamento_id) references public.departamentos(id),
  add constraint perfiles_ciudad_id_fkey foreign key (ciudad_id) references public.ciudades(id);

create index perfiles_pais_idx on public.perfiles (pais_id);
create index perfiles_departamento_idx on public.perfiles (departamento_id);
create index perfiles_ciudad_idx on public.perfiles (ciudad_id);

alter table public.paises enable row level security;
alter table public.departamentos enable row level security;
alter table public.ciudades enable row level security;

create policy paises_select on public.paises for select using (true);
create policy paises_write on public.paises for all
  using (public.es_super_admin()) with check (public.es_super_admin());

create policy departamentos_select on public.departamentos for select using (true);
create policy departamentos_write on public.departamentos for all
  using (public.es_super_admin()) with check (public.es_super_admin());

create policy ciudades_select on public.ciudades for select using (true);
create policy ciudades_write on public.ciudades for all
  using (public.es_super_admin()) with check (public.es_super_admin());
