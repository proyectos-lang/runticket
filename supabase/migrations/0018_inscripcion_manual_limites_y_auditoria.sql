-- =========================================================================
-- Inscripción en punto de venta, límite de intentos, panel global del
-- super-admin y escritura en la bitácora.
-- =========================================================================

-- ---------------------------------------------------------------------------
-- 1) Inscripción manual en sitio.
--
-- `inscribirse_en_evento` toma al corredor de auth.uid(), así que no sirve para
-- que el personal inscriba a otra persona en la mesa. Esta variante recibe el
-- corredor, exige ser staff del evento y mantiene TODAS las validaciones de la
-- inscripción normal: cupo con bloqueo, inventario de talla, edad y firma de la
-- declaración. Sin eso, la puerta de atrás sería más permisiva que la principal.
-- ---------------------------------------------------------------------------
create or replace function public.inscribir_manualmente(
  p_categoria_id     uuid,
  p_corredor_id      uuid,
  p_declaracion_id   uuid,
  p_talla            text default null,
  p_datos_adicionales jsonb default '{}'::jsonb,
  p_firma_imagen_url text default null,
  p_ip               inet default null,
  p_dispositivo      text default null,
  p_tutor_nombre     text default null,
  p_tutor_documento  text default null,
  p_precio           numeric default null,
  p_cobrar_en_efectivo boolean default false
)
returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_cat public.categorias%rowtype;
  v_evento public.eventos%rowtype;
  v_nacimiento date;
  v_edad integer;
  v_ocupadas integer;
  v_precio numeric;
  v_inscripcion_id uuid;
begin
  select * into v_cat from public.categorias where id = p_categoria_id;
  if not found then raise exception 'La categoría no existe'; end if;

  select * into v_evento from public.eventos where id = v_cat.evento_id;

  if not (public.es_admin_o_super(v_evento.empresa_id)) then
    raise exception 'Solo un administrador de la empresa puede inscribir manualmente';
  end if;

  -- A diferencia del flujo público, aquí se admite un evento con inscripciones
  -- cerradas: la mesa del día de la carrera es justo ese caso.
  if v_evento.estado not in ('publicado', 'inscripciones_cerradas') then
    raise exception 'Este evento no admite inscripciones';
  end if;

  if exists (
    select 1 from public.inscripciones
    where evento_id = v_evento.id and corredor_id = p_corredor_id and estado = 'activa'
  ) then
    raise exception 'Esa persona ya tiene una inscripción activa en este evento';
  end if;

  select fecha_nacimiento into v_nacimiento from public.perfiles where id = p_corredor_id;
  if v_nacimiento is null then
    raise exception 'Falta la fecha de nacimiento del corredor';
  end if;
  v_edad := extract(year from age(v_evento.fecha_inicio::date, v_nacimiento));

  if v_cat.edad_minima is not null and v_edad < v_cat.edad_minima then
    raise exception 'La categoría exige una edad mínima de % años (tendrá %)', v_cat.edad_minima, v_edad;
  end if;
  if v_cat.edad_maxima is not null and v_edad > v_cat.edad_maxima then
    raise exception 'La categoría exige una edad máxima de % años (tendrá %)', v_cat.edad_maxima, v_edad;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('cupo:' || v_cat.id::text, 0));

  if v_cat.cupo_maximo is not null then
    select count(*) into v_ocupadas from public.inscripciones
      where categoria_id = v_cat.id and estado = 'activa';
    if v_ocupadas >= v_cat.cupo_maximo then
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

  -- El precio puede fijarlo el personal (descuento en mesa); si no, sale del
  -- tramo vigente como en la inscripción normal.
  v_precio := coalesce(
    p_precio,
    (select pe.precio from public.precios_escalonados pe
      where pe.categoria_id = v_cat.id and now() between pe.fecha_inicio and pe.fecha_fin
      order by pe.fecha_inicio desc limit 1),
    v_cat.precio_base
  );

  insert into public.inscripciones (
    evento_id, categoria_id, empresa_id, corredor_id, talla,
    precio_pagado, moneda, estado, datos_adicionales, created_by
  ) values (
    v_evento.id, v_cat.id, v_evento.empresa_id, p_corredor_id, p_talla,
    v_precio, v_evento.moneda, 'activa', coalesce(p_datos_adicionales, '{}'::jsonb), auth.uid()
  ) returning id into v_inscripcion_id;

  insert into public.inscripcion_firmas (
    inscripcion_id, declaracion_id, firma_imagen_url, aceptado_checkbox,
    ip_address, dispositivo, tutor_nombre, tutor_documento
  ) values (
    v_inscripcion_id, p_declaracion_id, p_firma_imagen_url, true,
    p_ip, p_dispositivo, p_tutor_nombre, p_tutor_documento
  );

  -- Cobro en efectivo en la propia mesa: el trigger de pagos asigna el dorsal.
  if p_cobrar_en_efectivo and v_precio > 0 then
    insert into public.pagos (inscripcion_id, empresa_id, monto, moneda, metodo, estado, created_by)
    values (v_inscripcion_id, v_evento.empresa_id, v_precio, v_evento.moneda, 'efectivo', 'pagado', auth.uid());
  end if;

  return v_inscripcion_id;
end;
$$;

grant execute on function public.inscribir_manualmente(
  uuid, uuid, uuid, text, jsonb, text, inet, text, text, text, numeric, boolean
) to authenticated;

-- ---------------------------------------------------------------------------
-- 2) Límite de intentos en los formularios públicos.
--
-- Registro, recuperación de contraseña e inscripción están abiertos a internet.
-- Un contador en memoria no sirve: en Vercel cada petición puede caer en una
-- instancia distinta, así que el estado tiene que vivir en la base de datos.
-- ---------------------------------------------------------------------------
create table if not exists public.limites_intentos (
  clave       text primary key,
  contador    integer not null default 0,
  ventana_fin timestamptz not null
);

alter table public.limites_intentos enable row level security;
-- Sin políticas: solo se toca a través de la función de abajo.

/**
 * Devuelve true si la acción puede seguir. Cuenta por clave (habitualmente
 * IP + acción) dentro de una ventana deslizante.
 */
create or replace function public.consumir_limite(
  p_clave text,
  p_maximo integer,
  p_ventana_segundos integer
)
returns boolean
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_contador integer;
begin
  insert into public.limites_intentos (clave, contador, ventana_fin)
  values (p_clave, 1, now() + make_interval(secs => p_ventana_segundos))
  on conflict (clave) do update
    set contador = case
          when public.limites_intentos.ventana_fin < now() then 1
          else public.limites_intentos.contador + 1
        end,
        ventana_fin = case
          when public.limites_intentos.ventana_fin < now()
          then now() + make_interval(secs => p_ventana_segundos)
          else public.limites_intentos.ventana_fin
        end
  returning contador into v_contador;

  return v_contador <= p_maximo;
end;
$$;

grant execute on function public.consumir_limite(text, integer, integer) to anon, authenticated;

/** Limpieza de ventanas vencidas; se llama de vez en cuando desde la app. */
create or replace function public.purgar_limites()
returns void
language sql security definer set search_path = public, pg_temp
as $$
  delete from public.limites_intentos where ventana_fin < now() - interval '1 hour';
$$;

grant execute on function public.purgar_limites() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3) Panel consolidado del super-admin: agregados de toda la plataforma.
-- ---------------------------------------------------------------------------
create or replace function public.metricas_plataforma()
returns jsonb
language sql stable security definer set search_path = public, pg_temp
as $$
  select case when not public.es_super_admin() then '{}'::jsonb else jsonb_build_object(
    'empresas_activas', (select count(*) from public.empresas where estado in ('activa','prueba')),
    'empresas_suspendidas', (select count(*) from public.empresas where estado = 'suspendida'),
    'eventos_publicados', (select count(*) from public.eventos where estado = 'publicado'),
    'eventos_totales', (select count(*) from public.eventos),
    'inscripciones_activas', (select count(*) from public.inscripciones where estado = 'activa'),
    'corredores', (select count(distinct corredor_id) from public.inscripciones where estado = 'activa'),
    'usuarios', (select count(*) from public.perfiles),
    'recaudado', (select coalesce(sum(monto), 0) from public.pagos where estado = 'pagado'),
    'pendiente_cobro', (select coalesce(sum(monto), 0) from public.pagos where estado in ('pendiente','en_verificacion')),
    'inscripciones_por_mes', (
      select coalesce(jsonb_object_agg(mes, n), '{}'::jsonb) from (
        select to_char(date_trunc('month', created_at), 'YYYY-MM') as mes, count(*)::int as n
        from public.inscripciones
        where estado = 'activa' and created_at > now() - interval '12 months'
        group by 1) m
    ),
    'top_empresas', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'empresa', nombre_comercial, 'inscripciones', n) order by n desc), '[]'::jsonb)
      from (
        select e.nombre_comercial, count(i.id)::int as n
        from public.empresas e
        left join public.inscripciones i on i.empresa_id = e.id and i.estado = 'activa'
        group by e.id, e.nombre_comercial
        order by n desc
        limit 5) t
    )
  ) end;
$$;

grant execute on function public.metricas_plataforma() to authenticated;

-- ---------------------------------------------------------------------------
-- 4) Bitácora de auditoría.
--
-- La tabla existía desde el principio pero nadie escribía en ella. La política
-- de INSERT exige `usuario_id = auth.uid()`, lo que impide falsear el autor
-- desde la API; esta función además rellena la marca temporal y la IP.
-- ---------------------------------------------------------------------------
create or replace function public.registrar_auditoria(
  p_accion text,
  p_entidad text,
  p_entidad_id uuid default null,
  p_empresa_id uuid default null,
  p_datos_anteriores jsonb default null,
  p_datos_nuevos jsonb default null,
  p_ip inet default null
)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  insert into public.bitacora_auditoria (
    usuario_id, empresa_id, accion, entidad, entidad_id,
    datos_anteriores, datos_nuevos, ip_address
  ) values (
    auth.uid(), p_empresa_id, p_accion, p_entidad, p_entidad_id,
    p_datos_anteriores, p_datos_nuevos, p_ip
  );
end;
$$;

grant execute on function public.registrar_auditoria(text, text, uuid, uuid, jsonb, jsonb, inet)
  to authenticated;

create index if not exists bitacora_empresa_fecha_idx
  on public.bitacora_auditoria (empresa_id, created_at desc);
create index if not exists bitacora_fecha_idx
  on public.bitacora_auditoria (created_at desc);
