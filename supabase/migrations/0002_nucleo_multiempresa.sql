-- ---------- TABLAS ----------

create table public.empresas (
  id                 uuid primary key default gen_random_uuid(),
  nombre_comercial   text not null,
  slug               text not null unique check (slug ~ '^[a-z0-9-]+$'),
  logo_url           text,
  colores_marca      jsonb not null default '{}'::jsonb,
  correo_contacto    text,
  telefono_contacto  text,
  rtn                text,
  estado             text not null default 'prueba'
                        check (estado in ('activa','suspendida','prueba')),
  zona_horaria       text not null default 'America/Tegucigalpa',
  moneda             text not null default 'HNL',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  created_by         uuid references auth.users(id)
);

-- 1:1 con auth.users. pais/departamento/ciudad se agregan como FK real en 0003.
create table public.perfiles (
  id                              uuid primary key references auth.users(id) on delete cascade,
  rol_plataforma                  text not null default 'usuario'
                                     check (rol_plataforma in ('super_admin','usuario')),
  nombres                         text,
  apellidos                       text,
  correo                          text,
  telefono                        text,
  fecha_nacimiento                date,
  sexo                            text check (sexo in ('masculino','femenino','otro')),
  documento_identidad             text,
  pais_id                         uuid,
  departamento_id                 uuid,
  ciudad_id                       uuid,
  nacionalidad                    text,
  talla_predeterminada            text,
  tipo_sangre                     text check (tipo_sangre in ('O+','O-','A+','A-','B+','B-','AB+','AB-')),
  contacto_emergencia_nombre      text,
  contacto_emergencia_parentesco  text,
  contacto_emergencia_telefono    text,
  ocupacion                       text,
  como_se_entero                  text,
  nivel_experiencia               text check (nivel_experiencia in
                                     ('principiante','intermedio','avanzado','competitivo')),
  terminos_aceptados_en           timestamptz,
  created_at                      timestamptz not null default now(),
  updated_at                      timestamptz not null default now()
);

create table public.empresa_miembros (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   uuid not null references public.empresas(id) on delete cascade,
  usuario_id   uuid not null references auth.users(id) on delete cascade,
  rol          text not null check (rol in ('admin_empresa','operador')),
  estado       text not null default 'invitado'
                 check (estado in ('invitado','activo','suspendido')),
  invitado_en  timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid references auth.users(id),
  unique (empresa_id, usuario_id)
);

create table public.bitacora_auditoria (
  id                uuid primary key default gen_random_uuid(),
  usuario_id        uuid references auth.users(id),
  empresa_id        uuid references public.empresas(id),
  accion            text not null,
  entidad           text not null,
  entidad_id        uuid,
  datos_anteriores  jsonb,
  datos_nuevos      jsonb,
  ip_address        inet,
  created_at        timestamptz not null default now()
);

create table public.configuracion_plataforma (
  id           uuid primary key default gen_random_uuid(),
  clave        text not null unique,
  valor        jsonb not null,
  descripcion  text,
  es_publico   boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid references auth.users(id)
);

-- ---------- ÍNDICES ----------
create index empresas_estado_idx on public.empresas (estado);
create index perfiles_rol_plataforma_idx on public.perfiles (rol_plataforma);
create index empresa_miembros_usuario_idx on public.empresa_miembros (usuario_id);
create index empresa_miembros_empresa_idx on public.empresa_miembros (empresa_id);
create index bitacora_empresa_idx on public.bitacora_auditoria (empresa_id);
create index bitacora_usuario_idx on public.bitacora_auditoria (usuario_id);
create index bitacora_entidad_idx on public.bitacora_auditoria (entidad, entidad_id);

-- ---------- FUNCIONES HELPER DE ROL ----------

create or replace function public.es_super_admin()
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.perfiles
    where id = auth.uid() and rol_plataforma = 'super_admin'
  );
$$;

create or replace function public.es_admin_de_empresa(p_empresa_id uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.empresa_miembros
    where empresa_id = p_empresa_id
      and usuario_id = auth.uid()
      and rol = 'admin_empresa'
      and estado = 'activo'
  );
$$;

create or replace function public.es_operador_de_empresa(p_empresa_id uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.empresa_miembros
    where empresa_id = p_empresa_id
      and usuario_id = auth.uid()
      and rol = 'operador'
      and estado = 'activo'
  );
$$;

create or replace function public.es_miembro_de_empresa(p_empresa_id uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select public.es_admin_de_empresa(p_empresa_id) or public.es_operador_de_empresa(p_empresa_id);
$$;

create or replace function public.es_admin_o_super(p_empresa_id uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select public.es_admin_de_empresa(p_empresa_id) or public.es_super_admin();
$$;

comment on function public.es_admin_o_super(uuid) is
  'true si es admin_empresa ACTIVO de esa empresa o super_admin. NUNCA operador: usar en pagos/cupones/plantillas.';

-- ---------- TRIGGERS DE PROTECCIÓN DE COLUMNAS SENSIBLES ----------

create or replace function public.proteger_rol_plataforma()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  -- auth.uid() es null cuando la mutación viene de fuera de una sesión de la API
  -- (SQL Editor, Supabase CLI, o el cliente admin/service_role sin contexto de
  -- usuario) — esa vía ya está protegida por requerir credenciales de la base de
  -- datos, y es la única forma de dar de alta al primer super_admin del sistema.
  -- Si SÍ hay una sesión (auth.uid() no nulo), debe ser de un super_admin.
  if new.rol_plataforma is distinct from old.rol_plataforma
     and auth.uid() is not null
     and not public.es_super_admin() then
    raise exception 'Solo super_admin puede cambiar rol_plataforma';
  end if;
  return new;
end;
$$;

create or replace function public.proteger_estado_empresa()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if new.estado is distinct from old.estado
     and auth.uid() is not null
     and not public.es_super_admin() then
    raise exception 'Solo super_admin puede cambiar el estado de una empresa';
  end if;
  return new;
end;
$$;

create trigger set_updated_at before update on public.empresas
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.perfiles
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.empresa_miembros
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.configuracion_plataforma
  for each row execute function public.set_updated_at();

create trigger proteger_rol_plataforma before update on public.perfiles
  for each row execute function public.proteger_rol_plataforma();
create trigger proteger_estado_empresa before update on public.empresas
  for each row execute function public.proteger_estado_empresa();

-- ---------- ALTA AUTOMÁTICA DE PERFIL AL REGISTRARSE ----------

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  insert into public.perfiles (id, correo)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- RPC: aceptar invitación a empresa ----------

create or replace function public.aceptar_invitacion_empresa(p_empresa_id uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  update public.empresa_miembros
    set estado = 'activo'
    where empresa_id = p_empresa_id
      and usuario_id = auth.uid()
      and estado = 'invitado';
  if not found then
    raise exception 'No existe invitación pendiente para este usuario en esta empresa';
  end if;
end;
$$;

grant execute on function public.aceptar_invitacion_empresa(uuid) to authenticated;

-- ---------- RLS ----------

alter table public.empresas enable row level security;
alter table public.perfiles enable row level security;
alter table public.empresa_miembros enable row level security;
alter table public.bitacora_auditoria enable row level security;
alter table public.configuracion_plataforma enable row level security;

create policy empresas_select on public.empresas for select
  using (estado in ('activa','prueba') or public.es_super_admin() or public.es_miembro_de_empresa(id));
create policy empresas_insert on public.empresas for insert
  with check (public.es_super_admin());
create policy empresas_update on public.empresas for update
  using (public.es_admin_o_super(id)) with check (public.es_admin_o_super(id));
-- Sin policy de DELETE: baja lógica vía estado='suspendida'.

-- perfiles: cada quien ve/edita el suyo; super_admin ve todo.
-- (0005 agrega una policy adicional de SELECT para que staff vea perfiles de
-- corredores inscritos en sus eventos y de sus propios compañeros de equipo).
create policy perfiles_select_propio on public.perfiles for select
  using (id = auth.uid() or public.es_super_admin());
create policy perfiles_insert_propio on public.perfiles for insert
  with check (id = auth.uid());
create policy perfiles_update_propio on public.perfiles for update
  using (id = auth.uid() or public.es_super_admin())
  with check (id = auth.uid() or public.es_super_admin());

create policy empresa_miembros_select on public.empresa_miembros for select
  using (usuario_id = auth.uid() or public.es_admin_o_super(empresa_id));
create policy empresa_miembros_insert on public.empresa_miembros for insert
  with check (public.es_admin_o_super(empresa_id));
create policy empresa_miembros_update on public.empresa_miembros for update
  using (public.es_admin_o_super(empresa_id)) with check (public.es_admin_o_super(empresa_id));
create policy empresa_miembros_delete on public.empresa_miembros for delete
  using (public.es_admin_o_super(empresa_id));

create policy bitacora_insert on public.bitacora_auditoria for insert
  with check (usuario_id = auth.uid() or usuario_id is null);
create policy bitacora_select on public.bitacora_auditoria for select
  using (public.es_super_admin() or (empresa_id is not null and public.es_admin_de_empresa(empresa_id)));
-- Sin UPDATE/DELETE: bitácora inmutable.

create policy configuracion_select on public.configuracion_plataforma for select
  using (es_publico = true or public.es_super_admin());
create policy configuracion_insert on public.configuracion_plataforma for insert
  with check (public.es_super_admin());
create policy configuracion_update on public.configuracion_plataforma for update
  using (public.es_super_admin()) with check (public.es_super_admin());
create policy configuracion_delete on public.configuracion_plataforma for delete
  using (public.es_super_admin());
