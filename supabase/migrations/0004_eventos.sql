create table public.eventos (
  id                        uuid primary key default gen_random_uuid(),
  empresa_id                uuid not null references public.empresas(id) on delete cascade,
  nombre                    text not null,
  slug                      text not null unique check (slug ~ '^[a-z0-9-]+$'),
  descripcion               text,
  fecha_inicio              timestamptz not null,
  fecha_limite_inscripcion  timestamptz,
  direccion                 text,
  lat                       numeric(9,6),
  lng                       numeric(9,6),
  estado                    text not null default 'borrador'
                              check (estado in ('borrador','publicado','inscripciones_cerradas','finalizado','cancelado')),
  imagen_banner_url         text,
  moneda                    text not null default 'HNL',
  zona_horaria              text not null default 'America/Tegucigalpa',
  ruta_gpx_url              text,
  punto_encuentro_lat       numeric(9,6),
  punto_encuentro_lng       numeric(9,6),
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  created_by                uuid references auth.users(id)
);

create table public.evento_imagenes (
  id          uuid primary key default gen_random_uuid(),
  evento_id   uuid not null references public.eventos(id) on delete cascade,
  url         text not null,
  orden       integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id)
);

create table public.categorias (
  id            uuid primary key default gen_random_uuid(),
  evento_id     uuid not null references public.eventos(id) on delete cascade,
  nombre        text not null,
  precio_base   numeric(12,2) not null default 0,
  cupo_maximo   integer,
  edad_minima   integer,
  edad_maxima   integer,
  hora_salida   time,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id),
  unique (evento_id, nombre)
);

create table public.precios_escalonados (
  id            uuid primary key default gen_random_uuid(),
  categoria_id  uuid not null references public.categorias(id) on delete cascade,
  nombre        text not null,
  precio        numeric(12,2) not null,
  fecha_inicio  timestamptz not null,
  fecha_fin     timestamptz not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id),
  check (fecha_fin > fecha_inicio)
);

create table public.evento_tallas (
  id                     uuid primary key default gen_random_uuid(),
  evento_id              uuid not null references public.eventos(id) on delete cascade,
  talla                  text not null,
  inventario_total       integer,
  inventario_disponible  integer,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  created_by             uuid references auth.users(id),
  unique (evento_id, talla)
);

create table public.patrocinadores (
  id          uuid primary key default gen_random_uuid(),
  evento_id   uuid not null references public.eventos(id) on delete cascade,
  nombre      text not null,
  logo_url    text,
  url_sitio   text,
  orden       integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id)
);

create table public.eventos_politica_reembolso (
  id                     uuid primary key default gen_random_uuid(),
  evento_id              uuid not null unique references public.eventos(id) on delete cascade,
  tipo                   text not null check (tipo in ('sin_reembolso','parcial','completo')),
  dias_limite            integer,
  porcentaje_reembolso   numeric(5,2),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  created_by             uuid references auth.users(id)
);

create index eventos_empresa_idx on public.eventos (empresa_id);
create index eventos_estado_idx on public.eventos (estado);
create index evento_imagenes_evento_idx on public.evento_imagenes (evento_id);
create index categorias_evento_idx on public.categorias (evento_id);
create index precios_escalonados_categoria_idx on public.precios_escalonados (categoria_id);
create index evento_tallas_evento_idx on public.evento_tallas (evento_id);
create index patrocinadores_evento_idx on public.patrocinadores (evento_id);

create or replace function public.empresa_de_evento(p_evento_id uuid)
returns uuid
language sql stable security definer set search_path = public, pg_temp
as $$
  select empresa_id from public.eventos where id = p_evento_id;
$$;

create or replace function public.evento_de_categoria(p_categoria_id uuid)
returns uuid
language sql stable security definer set search_path = public, pg_temp
as $$
  select evento_id from public.categorias where id = p_categoria_id;
$$;

create or replace function public.evento_es_visible_publico(p_evento_id uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select estado in ('publicado','inscripciones_cerradas','finalizado')
  from public.eventos where id = p_evento_id;
$$;

create or replace function public.evento_es_visible_staff(p_evento_id uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select public.es_miembro_de_empresa(public.empresa_de_evento(p_evento_id))
      or public.es_super_admin();
$$;

create trigger set_updated_at before update on public.eventos for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.evento_imagenes for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.categorias for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.precios_escalonados for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.evento_tallas for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.patrocinadores for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.eventos_politica_reembolso for each row execute function public.set_updated_at();

alter table public.eventos enable row level security;
alter table public.evento_imagenes enable row level security;
alter table public.categorias enable row level security;
alter table public.precios_escalonados enable row level security;
alter table public.evento_tallas enable row level security;
alter table public.patrocinadores enable row level security;
alter table public.eventos_politica_reembolso enable row level security;

-- Resuelve la visibilidad con las columnas de la propia fila, NO llamando a
-- evento_es_visible_publico/staff(id): esas funciones son `stable` y vuelven a
-- consultar public.eventos, por lo que no ven la fila que inserta la sentencia en
-- curso — un INSERT ... RETURNING (lo que hace PostgREST con .select()) fallaría.
-- Las funciones siguen siendo válidas para las tablas hijas, que sí referencian
-- un evento ya existente.
create policy eventos_select on public.eventos for select
  using (
    estado in ('publicado','inscripciones_cerradas','finalizado')
    or public.es_miembro_de_empresa(empresa_id)
    or public.es_super_admin()
  );
create policy eventos_insert on public.eventos for insert
  with check (public.es_admin_o_super(empresa_id));
create policy eventos_update on public.eventos for update
  using (public.es_admin_o_super(empresa_id)) with check (public.es_admin_o_super(empresa_id));
create policy eventos_delete on public.eventos for delete
  using (public.es_admin_o_super(empresa_id));

create policy evento_imagenes_select on public.evento_imagenes for select
  using (public.evento_es_visible_publico(evento_id) or public.evento_es_visible_staff(evento_id));
create policy evento_imagenes_write on public.evento_imagenes for all
  using (public.es_admin_o_super(public.empresa_de_evento(evento_id)))
  with check (public.es_admin_o_super(public.empresa_de_evento(evento_id)));

create policy categorias_select on public.categorias for select
  using (public.evento_es_visible_publico(evento_id) or public.evento_es_visible_staff(evento_id));
create policy categorias_write on public.categorias for all
  using (public.es_admin_o_super(public.empresa_de_evento(evento_id)))
  with check (public.es_admin_o_super(public.empresa_de_evento(evento_id)));

create policy precios_escalonados_select on public.precios_escalonados for select
  using (public.evento_es_visible_publico(public.evento_de_categoria(categoria_id))
      or public.evento_es_visible_staff(public.evento_de_categoria(categoria_id)));
create policy precios_escalonados_write on public.precios_escalonados for all
  using (public.es_admin_o_super(public.empresa_de_evento(public.evento_de_categoria(categoria_id))))
  with check (public.es_admin_o_super(public.empresa_de_evento(public.evento_de_categoria(categoria_id))));

create policy evento_tallas_select on public.evento_tallas for select
  using (public.evento_es_visible_publico(evento_id) or public.evento_es_visible_staff(evento_id));
create policy evento_tallas_write on public.evento_tallas for all
  using (public.es_admin_o_super(public.empresa_de_evento(evento_id)))
  with check (public.es_admin_o_super(public.empresa_de_evento(evento_id)));

create policy patrocinadores_select on public.patrocinadores for select
  using (public.evento_es_visible_publico(evento_id) or public.evento_es_visible_staff(evento_id));
create policy patrocinadores_write on public.patrocinadores for all
  using (public.es_admin_o_super(public.empresa_de_evento(evento_id)))
  with check (public.es_admin_o_super(public.empresa_de_evento(evento_id)));

create policy politica_reembolso_select on public.eventos_politica_reembolso for select
  using (public.evento_es_visible_publico(evento_id) or public.evento_es_visible_staff(evento_id));
create policy politica_reembolso_write on public.eventos_politica_reembolso for all
  using (public.es_admin_o_super(public.empresa_de_evento(evento_id)))
  with check (public.es_admin_o_super(public.empresa_de_evento(evento_id)));
