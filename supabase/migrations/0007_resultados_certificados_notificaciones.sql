create table public.resultados (
  id                  uuid primary key default gen_random_uuid(),
  inscripcion_id      uuid not null unique references public.inscripciones(id) on delete cascade,
  tiempo_oficial      interval,
  posicion_general    integer,
  posicion_categoria  integer,
  publicado           boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  created_by          uuid references auth.users(id)
);
create index resultados_inscripcion_idx on public.resultados (inscripcion_id);
create trigger set_updated_at before update on public.resultados for each row execute function public.set_updated_at();

create table public.certificados (
  id              uuid primary key default gen_random_uuid(),
  inscripcion_id  uuid not null references public.inscripciones(id) on delete cascade,
  pdf_url         text not null,
  generado_en     timestamptz not null default now(),
  created_at      timestamptz not null default now()
);
create index certificados_inscripcion_idx on public.certificados (inscripcion_id);

create table public.notificaciones (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null references auth.users(id) on delete cascade,
  tipo        text not null,
  titulo      text not null,
  mensaje     text not null,
  leido       boolean not null default false,
  leido_en    timestamptz,
  enlace      text,
  created_at  timestamptz not null default now()
);
create index notificaciones_usuario_idx on public.notificaciones (usuario_id);
create index notificaciones_leido_idx on public.notificaciones (usuario_id, leido);

create table public.plantillas_correo (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  tipo            text not null check (tipo in (
                    'confirmacion_cuenta','confirmacion_inscripcion','confirmacion_pago',
                    'cupo_liberado','recordatorio_3dias','recordatorio_1dia','certificado_disponible')),
  asunto          text not null,
  contenido_html  text not null,
  activo          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id),
  unique (empresa_id, tipo)
);
create trigger set_updated_at before update on public.plantillas_correo for each row execute function public.set_updated_at();

create table public.fotos_evento (
  id              uuid primary key default gen_random_uuid(),
  evento_id       uuid not null references public.eventos(id) on delete cascade,
  url             text not null,
  numeros_dorsal  integer[] not null default '{}',
  subido_por      uuid references auth.users(id),
  created_at      timestamptz not null default now()
);
create index fotos_evento_evento_idx on public.fotos_evento (evento_id);
create index fotos_evento_dorsal_idx on public.fotos_evento using gin (numeros_dorsal);

alter table public.resultados enable row level security;
alter table public.certificados enable row level security;
alter table public.notificaciones enable row level security;
alter table public.plantillas_correo enable row level security;
alter table public.fotos_evento enable row level security;

create policy resultados_select on public.resultados for select
  using (
    publicado = true
    or public.es_dueno_de_inscripcion(inscripcion_id)
    or public.es_miembro_de_empresa(public.empresa_de_inscripcion(inscripcion_id))
    or public.es_super_admin()
  );
create policy resultados_write on public.resultados for all
  using (public.es_miembro_de_empresa(public.empresa_de_inscripcion(inscripcion_id)) or public.es_super_admin())
  with check (public.es_miembro_de_empresa(public.empresa_de_inscripcion(inscripcion_id)) or public.es_super_admin());

create policy certificados_select on public.certificados for select
  using (
    public.es_dueno_de_inscripcion(inscripcion_id)
    or public.es_miembro_de_empresa(public.empresa_de_inscripcion(inscripcion_id))
    or public.es_super_admin()
  );
-- Sin insert/update/delete para authenticated/anon: los certificados los genera y sube
-- el servidor (service_role, tras finalizar el evento), que bypassa RLS.

create policy notificaciones_select on public.notificaciones for select using (usuario_id = auth.uid());
create policy notificaciones_update on public.notificaciones for update
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
-- Sin insert para authenticated/anon: las crea el servidor (service_role) al disparar eventos.

create policy plantillas_correo_select on public.plantillas_correo for select
  using (public.es_miembro_de_empresa(empresa_id) or public.es_super_admin());
create policy plantillas_correo_write on public.plantillas_correo for all
  using (public.es_admin_o_super(empresa_id)) with check (public.es_admin_o_super(empresa_id));

create policy fotos_evento_select on public.fotos_evento for select
  using (public.evento_es_visible_publico(evento_id) or public.evento_es_visible_staff(evento_id));
create policy fotos_evento_write on public.fotos_evento for all
  using (public.es_miembro_de_empresa(public.empresa_de_evento(evento_id)) or public.es_super_admin())
  with check (public.es_miembro_de_empresa(public.empresa_de_evento(evento_id)) or public.es_super_admin());
