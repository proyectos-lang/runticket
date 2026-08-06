-- =========================================================================
-- Acompañantes: inscribir a un hijo o a la pareja sin que creen cuenta.
--
-- El obstáculo es que `inscripciones.corredor_id` es `not null` contra
-- `auth.users`: toda persona inscrita tiene que existir como usuario. Cambiar
-- eso obligaría a rehacer la RLS entera, `es_dueno_de_inscripcion`, el portal,
-- el dorsal y los certificados, porque todos giran alrededor de esa columna.
--
-- Así que el acompañante **sí es un usuario**, solo que uno que nunca inicia
-- sesión: se crea con `email_confirm: true` y sin contraseña, de modo que
-- Supabase no le manda ningún correo. Es exactamente lo que ya hace el panel al
-- inscribir a alguien en la mesa (`inscribir/actions.ts`), aquí llevado al
-- portal del corredor.
--
-- La ventaja de no inventar un modelo aparte: el acompañante tiene `perfiles`,
-- así que la validación de edad por categoría, la talla, el dorsal, el QR, los
-- resultados y el certificado funcionan sin tocar nada.
-- =========================================================================

-- ---------------------------------------------------------------------------
-- 1) Quién gestiona a quién
-- ---------------------------------------------------------------------------
create table if not exists public.acompanantes (
  id           uuid primary key default gen_random_uuid(),
  -- Quien lo da de alta y responde por él.
  titular_id   uuid not null references auth.users(id) on delete cascade,
  -- La cuenta silenciosa del acompañante. En cascada porque si esa cuenta
  -- desaparece, esta relación no apunta ya a nadie.
  --
  -- Ojo con la asimetría: borrar la **relación** (quitarlo de la lista) no toca
  -- sus inscripciones ni sus resultados, que siguen siendo suyos. Eso lo hace la
  -- acción del portal, no esta clave.
  usuario_id   uuid not null references auth.users(id) on delete cascade,
  parentesco   text not null default 'otro'
                 check (parentesco in ('hijo','pareja','familiar','otro')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (titular_id, usuario_id)
);

create index if not exists acompanantes_titular_idx on public.acompanantes (titular_id);

drop trigger if exists set_updated_at on public.acompanantes;
create trigger set_updated_at before update on public.acompanantes
  for each row execute function public.set_updated_at();

alter table public.acompanantes enable row level security;

drop policy if exists acompanantes_select on public.acompanantes;
create policy acompanantes_select on public.acompanantes for select
  using (titular_id = auth.uid() or usuario_id = auth.uid() or public.es_super_admin());

-- Sin INSERT ni UPDATE para `authenticated`: el alta crea además una cuenta y un
-- perfil, cosa que solo puede hacer el servidor con la clave de servicio. Dejar
-- la puerta abierta permitiría colgarse acompañantes ajenos.
drop policy if exists acompanantes_delete on public.acompanantes;
create policy acompanantes_delete on public.acompanantes for delete
  using (titular_id = auth.uid() or public.es_super_admin());

-- ---------------------------------------------------------------------------
-- 2) El titular tiene que poder ver y editar a los suyos
-- ---------------------------------------------------------------------------
create or replace function public.es_acompanante_mio(p_usuario_id uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.acompanantes
    where usuario_id = p_usuario_id and titular_id = auth.uid()
  );
$$;

-- Sin esto el titular no vería ni el nombre de su propio hijo: `perfiles` solo
-- deja leer la fila propia.
drop policy if exists perfiles_select_acompanante on public.perfiles;
create policy perfiles_select_acompanante on public.perfiles for select
  using (public.es_acompanante_mio(id));

drop policy if exists perfiles_update_acompanante on public.perfiles;
create policy perfiles_update_acompanante on public.perfiles for update
  using (public.es_acompanante_mio(id))
  with check (public.es_acompanante_mio(id));

-- Sus inscripciones, su dorsal y su kit los gestiona el titular.
drop policy if exists inscripciones_select on public.inscripciones;
create policy inscripciones_select on public.inscripciones for select
  using (
    corredor_id = auth.uid()
    or public.es_acompanante_mio(corredor_id)
    or public.es_miembro_de_empresa(empresa_id)
    or public.es_super_admin()
  );

-- Y la declaración que firmó por ellos, que es un documento que puede necesitar.
drop policy if exists inscripcion_firmas_select on public.inscripcion_firmas;
create policy inscripcion_firmas_select on public.inscripcion_firmas for select
  using (
    public.es_dueno_de_inscripcion(inscripcion_id)
    or public.es_acompanante_mio((select corredor_id from public.inscripciones where id = inscripcion_id))
    or public.es_miembro_de_empresa(public.empresa_de_inscripcion(inscripcion_id))
    or public.es_super_admin()
  );

-- ---------------------------------------------------------------------------
-- 3) Las reglas de inscripción, en un solo sitio
--
-- Es el cuerpo que antes estaba dentro de `inscribirse_en_evento` (0020),
-- parametrizado por la persona a inscribir y por el grupo. `security definer`
-- e **interna**: no se concede a `authenticated`, porque recibe el corredor como
-- argumento y quien la llamara directamente podría inscribir a cualquiera.
-- ---------------------------------------------------------------------------
create or replace function public.inscribir_persona(
  p_categoria_id      uuid,
  p_corredor_id       uuid,
  p_declaracion_id    uuid,
  p_talla             text,
  p_datos_adicionales jsonb,
  p_firma_imagen_url  text,
  p_acepto            boolean,
  p_ip                inet,
  p_dispositivo       text,
  p_tutor_nombre      text,
  p_tutor_documento   text,
  p_codigo_cupon      text,
  p_grupo_id          uuid
)
returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_cat        public.categorias%rowtype;
  v_evento     public.eventos%rowtype;
  v_nacimiento date;
  v_edad       integer;
  v_inscritos  integer;
  -- `numeric` a secas, como el original: con `numeric(12,2)` el descuento se
  -- redondearía al asignarlo y el redondeo final ya se hace al insertar.
  v_precio     numeric;
  v_cupon      public.cupones%rowtype;
  v_inscripcion uuid;
begin
  select * into v_cat from public.categorias where id = p_categoria_id;
  if not found then raise exception 'La categoría no existe'; end if;

  select * into v_evento from public.eventos where id = v_cat.evento_id;
  if v_evento.estado <> 'publicado' then
    raise exception 'Este evento no admite inscripciones en este momento';
  end if;
  if v_evento.fecha_limite_inscripcion is not null
     and now() > v_evento.fecha_limite_inscripcion then
    raise exception 'El plazo de inscripción ya cerró';
  end if;

  if p_grupo_id is not null and not exists (
    select 1 from public.grupos_inscripcion
    where id = p_grupo_id and evento_id = v_evento.id and pagador_id = auth.uid()
  ) then
    raise exception 'Ese grupo no es tuyo o no es de este evento';
  end if;

  if exists (
    select 1 from public.inscripciones
    where evento_id = v_evento.id and corredor_id = p_corredor_id and estado = 'activa'
  ) then
    raise exception 'Ya hay una inscripción activa en este evento para esa persona';
  end if;

  -- Edad calculada el día del evento, que es lo que importa para la categoría.
  select fecha_nacimiento into v_nacimiento from public.perfiles where id = p_corredor_id;
  if v_nacimiento is null then
    raise exception 'Falta la fecha de nacimiento para poder validar la categoría';
  end if;
  v_edad := extract(year from age(v_evento.fecha_inicio::date, v_nacimiento));

  if v_cat.edad_minima is not null and v_edad < v_cat.edad_minima then
    raise exception 'Esta categoría exige una edad mínima de % años (tendría %)', v_cat.edad_minima, v_edad;
  end if;
  if v_cat.edad_maxima is not null and v_edad > v_cat.edad_maxima then
    raise exception 'Esta categoría exige una edad máxima de % años (tendría %)', v_cat.edad_maxima, v_edad;
  end if;

  -- Serializa por categoría: sin esto, dos inscripciones simultáneas pueden
  -- pasar del cupo.
  perform pg_advisory_xact_lock(hashtextextended('cupo:' || v_cat.id::text, 0));

  if v_cat.cupo_maximo is not null then
    select count(*) into v_inscritos from public.inscripciones
      where categoria_id = v_cat.id and estado = 'activa';
    if v_inscritos >= v_cat.cupo_maximo then
      raise exception 'CUPO_AGOTADO';
    end if;
  end if;

  if p_talla is not null then
    update public.evento_tallas
      set inventario_disponible = inventario_disponible - 1
      where evento_id = v_evento.id and talla = p_talla
        and (inventario_disponible is null or inventario_disponible > 0);
    if not found then
      raise exception 'La talla % ya no está disponible', p_talla;
    end if;
  end if;

  select coalesce(
    (select pe.precio from public.precios_escalonados pe
      where pe.categoria_id = v_cat.id and now() between pe.fecha_inicio and pe.fecha_fin
      order by pe.fecha_inicio desc limit 1),
    v_cat.precio_base
  ) into v_precio;

  if p_codigo_cupon is not null and length(trim(p_codigo_cupon)) > 0 then
    -- `for update` en la misma transacción: sin el bloqueo, dos inscripciones
    -- simultáneas gastarían un cupón de un solo uso.
    select * into v_cupon from public.cupones
      where empresa_id = v_evento.empresa_id
        and upper(codigo) = upper(trim(p_codigo_cupon))
        and (evento_id is null or evento_id = v_evento.id)
      for update;

    if not found then raise exception 'CUPON_INVALIDO'; end if;
    if not v_cupon.activo then raise exception 'CUPON_INVALIDO'; end if;
    if v_cupon.vigente_desde is not null and now() < v_cupon.vigente_desde then
      raise exception 'CUPON_INVALIDO';
    end if;
    if v_cupon.vigente_hasta is not null and now() > v_cupon.vigente_hasta then
      raise exception 'CUPON_CADUCADO';
    end if;
    if v_cupon.usos_maximos is not null and v_cupon.usos_actuales >= v_cupon.usos_maximos then
      raise exception 'CUPON_AGOTADO';
    end if;

    v_precio := greatest(
      0,
      case
        when v_cupon.tipo_descuento = 'porcentaje' then v_precio * (1 - v_cupon.valor / 100)
        else v_precio - v_cupon.valor
      end
    );

    update public.cupones
      set usos_actuales = usos_actuales + 1, updated_at = now()
      where id = v_cupon.id;
  end if;

  insert into public.inscripciones (
    evento_id, categoria_id, empresa_id, corredor_id, talla, cupon_id,
    precio_pagado, moneda, estado, datos_adicionales, grupo_inscripcion_id, created_by
  ) values (
    v_evento.id, v_cat.id, v_evento.empresa_id, p_corredor_id, p_talla, v_cupon.id,
    round(v_precio, 2), v_evento.moneda, 'activa',
    coalesce(p_datos_adicionales, '{}'::jsonb), p_grupo_id, auth.uid()
  ) returning id into v_inscripcion;

  insert into public.inscripcion_firmas (
    inscripcion_id, declaracion_id, firma_imagen_url, aceptado_checkbox,
    ip_address, dispositivo, tutor_nombre, tutor_documento
  ) values (
    v_inscripcion, p_declaracion_id, p_firma_imagen_url, p_acepto,
    p_ip, p_dispositivo, p_tutor_nombre, p_tutor_documento
  );

  return v_inscripcion;
end;
$$;

revoke all on function public.inscribir_persona(uuid, uuid, uuid, text, jsonb, text, boolean, inet, text, text, text, text, uuid) from public, anon, authenticated;

comment on function public.inscribir_persona(uuid, uuid, uuid, text, jsonb, text, boolean, inet, text, text, text, text, uuid) is
  'Reglas comunes de inscripción (cupo, edad, inventario, precio, cupón, firma). Interna: la llaman inscribirse_en_evento e inscribir_acompanante, que son las que resuelven de quién es la inscripción.';

comment on table public.acompanantes is
  'Personas que un corredor inscribe sin que ellas creen cuenta: hijos, pareja. Cada una tiene su usuario silencioso y su perfil, para que dorsal, categoría por edad, resultados y certificado funcionen igual que con cualquier corredor.';
-- ---------------------------------------------------------------------------
-- 4) Un solo pago para toda la familia
--
-- `grupos_inscripcion` existe desde 0005 y nunca se usó. Ya está enganchada a
-- los pagos: `actualizar_estado_pago` (0006) y el disparador
-- `asignar_dorsal_al_pagar` (0013) reparten dorsal a todas las inscripciones
-- del grupo cuando el pago se confirma. Solo faltaba quien lo rellenara.
--
-- `inscribirse_en_evento` gana el parámetro del grupo para que la inscripción
-- del propio titular entre en el mismo pago que las de los suyos.
-- ---------------------------------------------------------------------------
drop function if exists public.inscribirse_en_evento(uuid, uuid, text, jsonb, text, boolean, inet, text, text, text, text);

create or replace function public.inscribirse_en_evento(
  p_categoria_id      uuid,
  p_declaracion_id    uuid,
  p_talla             text    default null,
  p_datos_adicionales jsonb   default '{}'::jsonb,
  p_firma_imagen_url  text    default null,
  p_acepto            boolean default false,
  p_ip                inet    default null,
  p_dispositivo       text    default null,
  p_tutor_nombre      text    default null,
  p_tutor_documento   text    default null,
  p_codigo_cupon      text    default null,
  p_grupo_id          uuid    default null
)
returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_usuario uuid := auth.uid();
begin
  if v_usuario is null then
    raise exception 'Debes iniciar sesión para inscribirte';
  end if;
  -- Se delega en la función común para no mantener dos copias de las mismas
  -- reglas de cupo, edad, inventario, precio y cupón.
  return public.inscribir_persona(
    p_categoria_id, v_usuario, p_declaracion_id, p_talla, p_datos_adicionales,
    p_firma_imagen_url, p_acepto, p_ip, p_dispositivo, p_tutor_nombre,
    p_tutor_documento, p_codigo_cupon, p_grupo_id
  );
end;
$$;

grant execute on function public.inscribirse_en_evento(uuid, uuid, text, jsonb, text, boolean, inet, text, text, text, text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5) La inscripción de un acompañante
--
-- Misma función que la propia, cambiando solo de quién es: por eso las reglas
-- viven en `inscribir_persona` y estas dos son envoltorios que resuelven la
-- autorización. Duplicarlas habría garantizado que se separaran.
-- ---------------------------------------------------------------------------
create or replace function public.inscribir_acompanante(
  p_categoria_id      uuid,
  p_acompanante_id    uuid,
  p_declaracion_id    uuid,
  p_talla             text    default null,
  p_datos_adicionales jsonb   default '{}'::jsonb,
  p_firma_imagen_url  text    default null,
  p_acepto            boolean default false,
  p_ip                inet    default null,
  p_dispositivo       text    default null,
  p_tutor_nombre      text    default null,
  p_tutor_documento   text    default null,
  p_codigo_cupon      text    default null,
  p_grupo_id          uuid    default null
)
returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_titular uuid := auth.uid();
  v_usuario uuid;
begin
  if v_titular is null then
    raise exception 'Debes iniciar sesión';
  end if;

  select usuario_id into v_usuario
    from public.acompanantes
    where id = p_acompanante_id and titular_id = v_titular;
  if v_usuario is null then
    raise exception 'Ese acompañante no es tuyo';
  end if;

  return public.inscribir_persona(
    p_categoria_id, v_usuario, p_declaracion_id, p_talla, p_datos_adicionales,
    p_firma_imagen_url, p_acepto, p_ip, p_dispositivo, p_tutor_nombre,
    p_tutor_documento, p_codigo_cupon, p_grupo_id
  );
end;
$$;

grant execute on function public.inscribir_acompanante(uuid, uuid, uuid, text, jsonb, text, boolean, inet, text, text, text, text, uuid) to authenticated;

