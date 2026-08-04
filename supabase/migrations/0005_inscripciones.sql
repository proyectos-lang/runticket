-- ---------- GRUPOS DE INSCRIPCIÓN (equipos / inscripción grupal) ----------

create table public.grupos_inscripcion (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   uuid not null references public.empresas(id) on delete cascade,
  evento_id    uuid not null references public.eventos(id) on delete cascade,
  pagador_id   uuid not null references auth.users(id),
  created_at   timestamptz not null default now(),
  created_by   uuid references auth.users(id)
);
create index grupos_inscripcion_empresa_idx on public.grupos_inscripcion (empresa_id);
create index grupos_inscripcion_evento_idx on public.grupos_inscripcion (evento_id);
create index grupos_inscripcion_pagador_idx on public.grupos_inscripcion (pagador_id);

alter table public.grupos_inscripcion enable row level security;
create policy grupos_inscripcion_select on public.grupos_inscripcion for select
  using (pagador_id = auth.uid() or public.es_miembro_de_empresa(empresa_id) or public.es_super_admin());
create policy grupos_inscripcion_insert on public.grupos_inscripcion for insert
  with check (pagador_id = auth.uid() or public.es_admin_o_super(empresa_id));
-- Sin UPDATE/DELETE: los grupos son inmutables; se gestiona cada inscripción individual.

-- ---------- CUPONES ----------

create table public.cupones (
  id               uuid primary key default gen_random_uuid(),
  empresa_id       uuid not null references public.empresas(id) on delete cascade,
  evento_id        uuid references public.eventos(id) on delete cascade,
  codigo           text not null,
  tipo_descuento   text not null check (tipo_descuento in ('porcentaje','monto_fijo')),
  valor            numeric(12,2) not null check (valor > 0),
  usos_maximos     integer,
  usos_actuales    integer not null default 0,
  vigente_desde    timestamptz,
  vigente_hasta    timestamptz,
  activo           boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  created_by       uuid references auth.users(id),
  unique (empresa_id, codigo)
);
create index cupones_empresa_idx on public.cupones (empresa_id);
create index cupones_evento_idx on public.cupones (evento_id);
create trigger set_updated_at before update on public.cupones for each row execute function public.set_updated_at();

alter table public.cupones enable row level security;
-- Nunca SELECT directo para corredor/anon: filtraría todos los códigos promocionales.
create policy cupones_select_staff on public.cupones for select
  using (public.es_admin_o_super(empresa_id));
create policy cupones_write on public.cupones for all
  using (public.es_admin_o_super(empresa_id)) with check (public.es_admin_o_super(empresa_id));

create or replace function public.validar_cupon(p_empresa_id uuid, p_evento_id uuid, p_codigo text)
returns table (valido boolean, tipo_descuento text, valor numeric, motivo text)
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare
  v_cupon public.cupones%rowtype;
begin
  select * into v_cupon from public.cupones
    where empresa_id = p_empresa_id and codigo = p_codigo
      and (evento_id is null or evento_id = p_evento_id);

  if not found then
    return query select false, null::text, null::numeric, 'Código no encontrado'; return;
  end if;
  if not v_cupon.activo then
    return query select false, null::text, null::numeric, 'Código inactivo'; return;
  end if;
  if v_cupon.vigente_desde is not null and now() < v_cupon.vigente_desde then
    return query select false, null::text, null::numeric, 'Código aún no vigente'; return;
  end if;
  if v_cupon.vigente_hasta is not null and now() > v_cupon.vigente_hasta then
    return query select false, null::text, null::numeric, 'Código expirado'; return;
  end if;
  if v_cupon.usos_maximos is not null and v_cupon.usos_actuales >= v_cupon.usos_maximos then
    return query select false, null::text, null::numeric, 'Código agotado'; return;
  end if;

  return query select true, v_cupon.tipo_descuento, v_cupon.valor, null::text;
end;
$$;

grant execute on function public.validar_cupon(uuid, uuid, text) to anon, authenticated;

-- ---------- DECLARACIÓN DE SALUD (versionable) ----------

create table public.declaraciones_salud (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references public.empresas(id) on delete cascade,
  evento_id     uuid references public.eventos(id) on delete cascade,
  version       integer not null,
  contenido     text not null,
  vigente_desde timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id)
);
create index declaraciones_salud_empresa_idx on public.declaraciones_salud (empresa_id);
create index declaraciones_salud_evento_idx on public.declaraciones_salud (evento_id);
create unique index declaraciones_salud_evento_version_idx
  on public.declaraciones_salud (evento_id, version) where evento_id is not null;
create unique index declaraciones_salud_empresa_version_idx
  on public.declaraciones_salud (empresa_id, version) where evento_id is null;
create trigger set_updated_at before update on public.declaraciones_salud for each row execute function public.set_updated_at();

alter table public.declaraciones_salud enable row level security;
create policy declaraciones_salud_select on public.declaraciones_salud for select
  using (
    (evento_id is not null and (public.evento_es_visible_publico(evento_id) or public.evento_es_visible_staff(evento_id)))
    or (evento_id is null and (public.es_miembro_de_empresa(empresa_id) or public.es_super_admin()))
  );
create policy declaraciones_salud_write on public.declaraciones_salud for all
  using (public.es_admin_o_super(empresa_id)) with check (public.es_admin_o_super(empresa_id));

-- ---------- INSCRIPCIONES ----------

create table public.inscripciones (
  id                             uuid primary key default gen_random_uuid(),
  evento_id                      uuid not null references public.eventos(id) on delete cascade,
  categoria_id                   uuid not null references public.categorias(id) on delete cascade,
  empresa_id                     uuid not null references public.empresas(id) on delete cascade,
  corredor_id                    uuid not null references auth.users(id),
  talla                          text,
  numero_dorsal                  integer,
  codigo_qr                      text unique,
  cupon_id                       uuid references public.cupones(id),
  precio_pagado                  numeric(12,2) not null default 0,
  moneda                         text not null default 'HNL',
  estado                         text not null default 'activa'
                                    check (estado in ('activa','anulada','transferida','lista_espera')),
  kit_entregado                  boolean not null default false,
  kit_entregado_en               timestamptz,
  kit_entregado_por              uuid references auth.users(id),
  datos_adicionales              jsonb not null default '{}'::jsonb,
  grupo_inscripcion_id           uuid references public.grupos_inscripcion(id),
  transferido_de_inscripcion_id  uuid references public.inscripciones(id),
  created_at                     timestamptz not null default now(),
  updated_at                     timestamptz not null default now(),
  created_by                     uuid references auth.users(id)
);

create unique index inscripciones_evento_dorsal_idx
  on public.inscripciones (evento_id, numero_dorsal) where numero_dorsal is not null;
create index inscripciones_evento_idx on public.inscripciones (evento_id);
create index inscripciones_empresa_idx on public.inscripciones (empresa_id);
create index inscripciones_corredor_idx on public.inscripciones (corredor_id);
create index inscripciones_categoria_idx on public.inscripciones (categoria_id);
create index inscripciones_estado_idx on public.inscripciones (estado);

create trigger set_updated_at before update on public.inscripciones for each row execute function public.set_updated_at();

-- Coherencia: empresa_id debe ser el dueño real del evento; categoría debe pertenecer al evento.
create or replace function public.validar_empresa_inscripcion()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if new.empresa_id is distinct from public.empresa_de_evento(new.evento_id) then
    raise exception 'empresa_id no coincide con la empresa dueña del evento';
  end if;
  if public.evento_de_categoria(new.categoria_id) is distinct from new.evento_id then
    raise exception 'La categoría no pertenece al evento indicado';
  end if;
  return new;
end;
$$;

create trigger validar_empresa_inscripcion
  before insert or update on public.inscripciones
  for each row execute function public.validar_empresa_inscripcion();

-- Protege columnas sensibles: solo se modifican numero_dorsal/precio_pagado/estado/
-- kit_entregado*/cupon_id desde las RPC de este archivo (bandera de sesión
-- runticket.rpc_inscripciones) o por staff/super_admin. El corredor dueño conserva
-- UPDATE libre sobre talla/datos_adicionales mientras la inscripción está activa.
create or replace function public.proteger_columnas_inscripcion()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if current_setting('runticket.rpc_inscripciones', true) = 'on' then
    return new;
  end if;

  if public.es_miembro_de_empresa(new.empresa_id) or public.es_super_admin() then
    return new;
  end if;

  if new.numero_dorsal is distinct from old.numero_dorsal
     or new.precio_pagado is distinct from old.precio_pagado
     or new.estado is distinct from old.estado
     or new.kit_entregado is distinct from old.kit_entregado
     or new.kit_entregado_en is distinct from old.kit_entregado_en
     or new.kit_entregado_por is distinct from old.kit_entregado_por
     or new.cupon_id is distinct from old.cupon_id
     or new.empresa_id is distinct from old.empresa_id
     or new.corredor_id is distinct from old.corredor_id
  then
    raise exception 'No autorizado para modificar campos protegidos de la inscripción';
  end if;

  return new;
end;
$$;

create trigger proteger_columnas_inscripcion
  before update on public.inscripciones
  for each row execute function public.proteger_columnas_inscripcion();

alter table public.inscripciones enable row level security;

create policy inscripciones_select on public.inscripciones for select
  using (corredor_id = auth.uid() or public.es_miembro_de_empresa(empresa_id) or public.es_super_admin());

create policy inscripciones_insert on public.inscripciones for insert
  with check (
    (corredor_id = auth.uid() and estado in ('activa','lista_espera'))
    or public.es_admin_o_super(empresa_id)
  );

create policy inscripciones_update on public.inscripciones for update
  using (corredor_id = auth.uid() or public.es_miembro_de_empresa(empresa_id) or public.es_super_admin())
  with check (corredor_id = auth.uid() or public.es_miembro_de_empresa(empresa_id) or public.es_super_admin());
-- Sin DELETE: las inscripciones se anulan (estado), nunca se borran.

-- Amplía perfiles: staff ve el perfil de corredores inscritos en sus eventos y de
-- sus propios compañeros de empresa (necesario para listados de inscritos/equipo).
-- Se agrega aquí porque depende de public.inscripciones, creada recién arriba.
create policy perfiles_select_staff on public.perfiles for select
  using (
    exists (
      select 1 from public.inscripciones i
      where i.corredor_id = perfiles.id and public.es_miembro_de_empresa(i.empresa_id)
    )
    or exists (
      select 1 from public.empresa_miembros m
      where m.usuario_id = perfiles.id and public.es_admin_o_super(m.empresa_id)
    )
  );

-- ---------- HELPERS DE INSCRIPCIÓN ----------
-- Van aquí (y no al inicio del archivo) porque son funciones `language sql`: Postgres
-- resuelve sus referencias a tablas en el momento de CREATE FUNCTION, no en tiempo de
-- ejecución como con plpgsql. Necesitan que public.inscripciones ya exista.

create or replace function public.empresa_de_inscripcion(p_inscripcion_id uuid)
returns uuid
language sql stable security definer set search_path = public, pg_temp
as $$
  select empresa_id from public.inscripciones where id = p_inscripcion_id;
$$;

create or replace function public.evento_de_inscripcion(p_inscripcion_id uuid)
returns uuid
language sql stable security definer set search_path = public, pg_temp
as $$
  select evento_id from public.inscripciones where id = p_inscripcion_id;
$$;

create or replace function public.es_dueno_de_inscripcion(p_inscripcion_id uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.inscripciones
    where id = p_inscripcion_id and corredor_id = auth.uid()
  );
$$;

-- ---------- FIRMA DE DECLARACIÓN DE SALUD ----------

create table public.inscripcion_firmas (
  id                  uuid primary key default gen_random_uuid(),
  inscripcion_id      uuid not null unique references public.inscripciones(id) on delete cascade,
  declaracion_id      uuid not null references public.declaraciones_salud(id),
  firma_imagen_url    text,
  aceptado_checkbox   boolean not null default false,
  ip_address          inet,
  dispositivo         text,
  firmado_en          timestamptz not null default now(),
  tutor_nombre        text,
  tutor_documento     text,
  pdf_url             text,
  created_at          timestamptz not null default now()
);
create index inscripcion_firmas_declaracion_idx on public.inscripcion_firmas (declaracion_id);

create or replace function public.validar_firma_inscripcion()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_decl public.declaraciones_salud%rowtype;
begin
  select * into v_decl from public.declaraciones_salud where id = new.declaracion_id;
  if not found then
    raise exception 'La declaración de salud indicada no existe';
  end if;
  if v_decl.empresa_id is distinct from public.empresa_de_inscripcion(new.inscripcion_id) then
    raise exception 'La declaración de salud no corresponde a la empresa de la inscripción';
  end if;
  if v_decl.evento_id is not null
     and v_decl.evento_id is distinct from public.evento_de_inscripcion(new.inscripcion_id) then
    raise exception 'La declaración de salud no corresponde al evento de la inscripción';
  end if;
  return new;
end;
$$;

create trigger validar_firma_inscripcion
  before insert on public.inscripcion_firmas
  for each row execute function public.validar_firma_inscripcion();

alter table public.inscripcion_firmas enable row level security;

create policy inscripcion_firmas_select on public.inscripcion_firmas for select
  using (
    public.es_dueno_de_inscripcion(inscripcion_id)
    or public.es_miembro_de_empresa(public.empresa_de_inscripcion(inscripcion_id))
    or public.es_super_admin()
  );
create policy inscripcion_firmas_insert on public.inscripcion_firmas for insert
  with check (
    public.es_dueno_de_inscripcion(inscripcion_id)
    or public.es_miembro_de_empresa(public.empresa_de_inscripcion(inscripcion_id))
    or public.es_super_admin()
  );
-- Sin UPDATE: documento legal inmutable. pdf_url se completa después vía service_role.
create policy inscripcion_firmas_delete_super_admin on public.inscripcion_firmas for delete
  using (public.es_super_admin());

-- ---------- LISTA DE ESPERA ----------

create table public.lista_espera (
  id                  uuid primary key default gen_random_uuid(),
  evento_id           uuid not null references public.eventos(id) on delete cascade,
  categoria_id        uuid not null references public.categorias(id) on delete cascade,
  usuario_id          uuid not null references auth.users(id),
  estado              text not null default 'esperando'
                        check (estado in ('esperando','notificado','expirado','convertido')),
  notificado_en       timestamptz,
  enlace_expira_en    timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create unique index ux_lista_espera_activa
  on public.lista_espera (evento_id, categoria_id, usuario_id)
  where estado in ('esperando','notificado');
create index lista_espera_usuario_idx on public.lista_espera (usuario_id);
create index lista_espera_evento_idx on public.lista_espera (evento_id);

create or replace function public.validar_lista_espera()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if public.evento_de_categoria(new.categoria_id) is distinct from new.evento_id then
    raise exception 'La categoría no pertenece al evento indicado';
  end if;
  return new;
end;
$$;

create trigger validar_lista_espera
  before insert or update on public.lista_espera
  for each row execute function public.validar_lista_espera();
create trigger set_updated_at before update on public.lista_espera for each row execute function public.set_updated_at();

alter table public.lista_espera enable row level security;

create policy lista_espera_select on public.lista_espera for select
  using (usuario_id = auth.uid() or public.es_miembro_de_empresa(public.empresa_de_evento(evento_id)) or public.es_super_admin());
create policy lista_espera_insert on public.lista_espera for insert
  with check (
    (usuario_id = auth.uid() and public.evento_es_visible_publico(evento_id))
    or public.es_miembro_de_empresa(public.empresa_de_evento(evento_id))
    or public.es_super_admin()
  );
create policy lista_espera_update_staff on public.lista_espera for update
  using (public.es_miembro_de_empresa(public.empresa_de_evento(evento_id)) or public.es_super_admin())
  with check (public.es_miembro_de_empresa(public.empresa_de_evento(evento_id)) or public.es_super_admin());
create policy lista_espera_delete on public.lista_espera for delete
  using (usuario_id = auth.uid() or public.es_miembro_de_empresa(public.empresa_de_evento(evento_id)) or public.es_super_admin());

-- ---------- RPCs DE NEGOCIO ----------

create or replace function public.asignar_dorsal(p_inscripcion_id uuid)
returns integer
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_evento_id uuid; v_empresa_id uuid; v_corredor_id uuid;
  v_precio_pagado numeric; v_numero_dorsal integer; v_siguiente integer;
begin
  select evento_id, empresa_id, corredor_id, precio_pagado, numero_dorsal
    into v_evento_id, v_empresa_id, v_corredor_id, v_precio_pagado, v_numero_dorsal
  from public.inscripciones where id = p_inscripcion_id for update;

  if not found then raise exception 'Inscripción % no existe', p_inscripcion_id; end if;

  -- Con auth.uid() null la llamada viene de fuera de la API (service_role: SQL
  -- Editor, CLI, jobs, webhooks de pasarela), vía ya protegida por credenciales
  -- de base de datos. Solo se controla el caso con sesión de usuario.
  if auth.uid() is not null and not (
    public.es_miembro_de_empresa(v_empresa_id) or public.es_super_admin()
    or (v_corredor_id = auth.uid() and v_precio_pagado = 0)
  ) then
    raise exception 'No autorizado para asignar dorsal';
  end if;

  if v_numero_dorsal is not null then return v_numero_dorsal; end if;

  -- Serializa la asignación por evento para evitar colisiones bajo concurrencia.
  perform pg_advisory_xact_lock(hashtextextended('dorsal:' || v_evento_id::text, 0));

  select coalesce(max(numero_dorsal), 0) + 1 into v_siguiente
  from public.inscripciones where evento_id = v_evento_id;

  perform set_config('runticket.rpc_inscripciones', 'on', true);
  update public.inscripciones
    set numero_dorsal = v_siguiente,
        -- gen_random_uuid() vive en pg_catalog (núcleo desde PG13) y siempre
        -- resuelve; gen_random_bytes() es de pgcrypto, que Supabase instala en
        -- el esquema `extensions`, fuera del search_path fijado arriba.
        codigo_qr = coalesce(codigo_qr, replace(gen_random_uuid()::text, '-', '')),
        updated_at = now()
    where id = p_inscripcion_id;
  perform set_config('runticket.rpc_inscripciones', 'off', true);

  return v_siguiente;
end;
$$;

grant execute on function public.asignar_dorsal(uuid) to authenticated;

create or replace function public.auto_asignar_dorsal_gratis()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if new.precio_pagado = 0 and new.estado = 'activa' then
    perform public.asignar_dorsal(new.id);
  end if;
  return new;
end;
$$;

create trigger auto_asignar_dorsal_gratis
  after insert on public.inscripciones
  for each row execute function public.auto_asignar_dorsal_gratis();

create or replace function public.anular_inscripcion(p_inscripcion_id uuid, p_motivo text default null)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_empresa_id uuid; v_corredor_id uuid; v_estado text;
begin
  select empresa_id, corredor_id, estado into v_empresa_id, v_corredor_id, v_estado
  from public.inscripciones where id = p_inscripcion_id for update;

  if not found then raise exception 'Inscripción % no existe', p_inscripcion_id; end if;

  if not (public.es_miembro_de_empresa(v_empresa_id) or public.es_super_admin() or v_corredor_id = auth.uid()) then
    raise exception 'No autorizado para anular esta inscripción';
  end if;
  if v_estado = 'anulada' then raise exception 'La inscripción ya está anulada'; end if;

  perform set_config('runticket.rpc_inscripciones', 'on', true);
  update public.inscripciones
    set estado = 'anulada', numero_dorsal = null,
        datos_adicionales = datos_adicionales || jsonb_build_object(
          'anulada_en', now(), 'anulada_por', auth.uid(), 'motivo_anulacion', p_motivo),
        updated_at = now()
    where id = p_inscripcion_id;
  perform set_config('runticket.rpc_inscripciones', 'off', true);
end;
$$;

grant execute on function public.anular_inscripcion(uuid, text) to authenticated;

create or replace function public.transferir_inscripcion(p_inscripcion_id uuid, p_nuevo_corredor_id uuid)
returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_row public.inscripciones%rowtype; v_nueva_id uuid;
begin
  select * into v_row from public.inscripciones where id = p_inscripcion_id for update;
  if not found then raise exception 'Inscripción % no existe', p_inscripcion_id; end if;

  if not (public.es_miembro_de_empresa(v_row.empresa_id) or public.es_super_admin() or v_row.corredor_id = auth.uid()) then
    raise exception 'No autorizado para transferir esta inscripción';
  end if;
  if v_row.estado <> 'activa' then raise exception 'Solo se pueden transferir inscripciones activas'; end if;
  if p_nuevo_corredor_id = v_row.corredor_id then raise exception 'La inscripción ya pertenece a ese corredor'; end if;

  perform set_config('runticket.rpc_inscripciones', 'on', true);

  update public.inscripciones
    set estado = 'transferida', numero_dorsal = null, updated_at = now()
    where id = p_inscripcion_id;

  insert into public.inscripciones (
    evento_id, categoria_id, empresa_id, corredor_id, talla, cupon_id,
    precio_pagado, moneda, estado, grupo_inscripcion_id, transferido_de_inscripcion_id, created_by
  ) values (
    v_row.evento_id, v_row.categoria_id, v_row.empresa_id, p_nuevo_corredor_id, v_row.talla, v_row.cupon_id,
    v_row.precio_pagado, v_row.moneda, 'activa', v_row.grupo_inscripcion_id, v_row.id, auth.uid()
  ) returning id into v_nueva_id;

  perform set_config('runticket.rpc_inscripciones', 'off', true);
  return v_nueva_id;
end;
$$;

grant execute on function public.transferir_inscripcion(uuid, uuid) to authenticated;

create or replace function public.marcar_kit_entregado(p_inscripcion_id uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_empresa_id uuid; v_estado text;
begin
  select empresa_id, estado into v_empresa_id, v_estado
  from public.inscripciones where id = p_inscripcion_id for update;
  if not found then raise exception 'Inscripción % no existe', p_inscripcion_id; end if;

  -- Permitido a operador Y admin_empresa/super_admin (nunca al propio corredor).
  if not (public.es_miembro_de_empresa(v_empresa_id) or public.es_super_admin()) then
    raise exception 'No autorizado para entregar kits';
  end if;
  if v_estado <> 'activa' then raise exception 'Solo se puede entregar el kit de una inscripción activa'; end if;

  perform set_config('runticket.rpc_inscripciones', 'on', true);
  update public.inscripciones
    set kit_entregado = true, kit_entregado_en = now(), kit_entregado_por = auth.uid(), updated_at = now()
    where id = p_inscripcion_id;
  perform set_config('runticket.rpc_inscripciones', 'off', true);
end;
$$;

grant execute on function public.marcar_kit_entregado(uuid) to authenticated;

create or replace function public.convertir_lista_espera(p_lista_espera_id uuid)
returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_le public.lista_espera%rowtype; v_empresa_id uuid;
  v_cupo_maximo integer; v_ocupadas integer; v_precio numeric; v_moneda text; v_nueva_id uuid;
begin
  select * into v_le from public.lista_espera where id = p_lista_espera_id for update;
  if not found then raise exception 'Registro de lista de espera % no existe', p_lista_espera_id; end if;

  v_empresa_id := public.empresa_de_evento(v_le.evento_id);

  if not (
    public.es_miembro_de_empresa(v_empresa_id) or public.es_super_admin()
    or (v_le.usuario_id = auth.uid() and v_le.estado = 'notificado'
        and (v_le.enlace_expira_en is null or v_le.enlace_expira_en > now()))
  ) then
    raise exception 'No autorizado para convertir este registro de lista de espera';
  end if;
  if v_le.estado not in ('esperando','notificado') then
    raise exception 'Este registro ya no está disponible para conversión (estado: %)', v_le.estado;
  end if;

  select cupo_maximo into v_cupo_maximo from public.categorias where id = v_le.categoria_id;
  select count(*) into v_ocupadas from public.inscripciones
    where categoria_id = v_le.categoria_id and estado = 'activa';
  if v_cupo_maximo is not null and v_ocupadas >= v_cupo_maximo then
    raise exception 'No hay cupo disponible en la categoría';
  end if;

  select precio_base into v_precio from public.categorias where id = v_le.categoria_id;
  select moneda into v_moneda from public.eventos where id = v_le.evento_id;

  insert into public.inscripciones (evento_id, categoria_id, empresa_id, corredor_id, precio_pagado, moneda, estado, created_by)
  values (v_le.evento_id, v_le.categoria_id, v_empresa_id, v_le.usuario_id, coalesce(v_precio, 0), v_moneda, 'activa', auth.uid())
  returning id into v_nueva_id;

  update public.lista_espera set estado = 'convertido', updated_at = now() where id = p_lista_espera_id;
  return v_nueva_id;
end;
$$;

grant execute on function public.convertir_lista_espera(uuid) to authenticated;
