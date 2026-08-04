-- =========================================================================
-- CRUD completo del panel: cosas que la RLS no puede expresar.
-- Las políticas existentes ya autorizan todas las escrituras nuevas; lo que
-- falta son operaciones atómicas, restricciones de integridad y límites.
-- =========================================================================

-- ---------------------------------------------------------------------------
-- 1) Ajuste del inventario de una talla.
--
-- `inventario_disponible` lo mueven TRES funciones por delta:
-- inscribirse_en_evento (-1), devolver_talla_al_anular (+1) y
-- cambiar_talla_inscripcion (±1). Si el panel fijara `inventario_total` con un
-- UPDATE suelto, `disponible` quedaría obsoleto: al bajar el total podría
-- superar lo que de verdad hay y se vendería de más. Aquí se recalcula contra
-- las prendas ya comprometidas, en una sola transacción.
--
-- NULL en `inventario_total` significa "ilimitado" en toda la lógica.
-- ---------------------------------------------------------------------------
create or replace function public.ajustar_inventario_talla(
  p_talla_id uuid,
  p_inventario_total integer
)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_talla public.evento_tallas%rowtype;
  v_comprometidas integer;
begin
  select * into v_talla from public.evento_tallas where id = p_talla_id for update;
  if not found then raise exception 'La talla no existe'; end if;

  if not public.es_admin_o_super(
    (select empresa_id from public.eventos where id = v_talla.evento_id)
  ) then
    raise exception 'No autorizado para modificar el inventario';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('talla:' || v_talla.evento_id::text, 0));

  select count(*)::integer into v_comprometidas
    from public.inscripciones
    where evento_id = v_talla.evento_id and talla = v_talla.talla and estado = 'activa';

  if p_inventario_total is not null and p_inventario_total < v_comprometidas then
    raise exception 'Ya hay % inscritos con la talla %: el total no puede ser menor',
      v_comprometidas, v_talla.talla;
  end if;

  update public.evento_tallas
    set inventario_total = p_inventario_total,
        inventario_disponible = case
          when p_inventario_total is null then null
          else p_inventario_total - v_comprometidas
        end,
        updated_at = now()
    where id = p_talla_id;
end;
$$;

grant execute on function public.ajustar_inventario_talla(uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 2) `inscripciones.talla` es texto libre sin clave foránea, y todo el
-- inventario cruza por ese texto. Renombrar o borrar una talla con inscritos
-- los deja huérfanos: la devolución de stock al anular dejaría de encontrar la
-- fila y el inventario nunca volvería a cuadrar.
-- ---------------------------------------------------------------------------
create or replace function public.proteger_talla_en_uso()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_evento uuid := coalesce(old.evento_id, new.evento_id);
  v_talla text := old.talla;
  v_inscritos integer;
begin
  if tg_op = 'UPDATE' and new.talla is not distinct from old.talla then
    return new;
  end if;

  select count(*) into v_inscritos
    from public.inscripciones
    where evento_id = v_evento and talla = v_talla and estado = 'activa';

  if v_inscritos > 0 then
    raise exception 'Hay % inscripciones con la talla %. Cámbialas antes de %.',
      v_inscritos, v_talla,
      case when tg_op = 'DELETE' then 'eliminarla' else 'renombrarla' end;
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists proteger_talla_en_uso on public.evento_tallas;
create trigger proteger_talla_en_uso
  before update or delete on public.evento_tallas
  for each row execute function public.proteger_talla_en_uso();

-- ---------------------------------------------------------------------------
-- 3) `inscripciones.evento_id` tiene ON DELETE CASCADE. Borrar un evento
-- arrastraría en silencio inscripciones, pagos, resultados y las declaraciones
-- de salud firmadas, que son documentos legales marcados como inmutables.
-- El trigger lo impide también fuera de la aplicación (SQL Editor, CLI).
-- Para un evento en marcha existe el estado 'cancelado'.
-- ---------------------------------------------------------------------------
create or replace function public.proteger_evento_con_inscripciones()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_inscripciones integer;
begin
  select count(*) into v_inscripciones from public.inscripciones where evento_id = old.id;
  if v_inscripciones > 0 then
    raise exception
      'El evento tiene % inscripciones y borrarlo destruiría sus declaraciones firmadas y sus pagos. Cancélalo en vez de borrarlo.',
      v_inscripciones;
  end if;
  return old;
end;
$$;

drop trigger if exists proteger_evento_con_inscripciones on public.eventos;
create trigger proteger_evento_con_inscripciones
  before delete on public.eventos
  for each row execute function public.proteger_evento_con_inscripciones();

-- ---------------------------------------------------------------------------
-- 4) Los buckets se crearon sin límites, así que hoy un miembro puede subir un
-- archivo de cualquier tamaño y tipo. La validación en el navegador es solo
-- comodidad: el control real es este.
-- ---------------------------------------------------------------------------
update storage.buckets set
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/avif']
  where id in ('logos-empresa', 'fotos-evento');

update storage.buckets set
  file_size_limit = 8388608,
  allowed_mime_types = array[
    'image/jpeg','image/png','image/webp','image/avif',
    'application/gpx+xml','application/xml','text/xml'
  ]
  where id = 'eventos';

update storage.buckets set
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','application/pdf']
  where id = 'comprobantes';

update storage.buckets set
  file_size_limit = 5242880,
  allowed_mime_types = array['image/png','application/pdf']
  where id in ('declaraciones', 'certificados');

-- ---------------------------------------------------------------------------
-- 5) Lista de espera: expirar antes de notificar.
--
-- La ventana de 24 h no la hacía cumplir nada: las filas se quedaban en
-- 'notificado' para siempre y cada pulsación avanzaba al siguiente, de modo que
-- se acababa notificando a varias personas por un mismo cupo y nadie volvía a
-- la cola. Ahora se caducan primero las vencidas.
-- ---------------------------------------------------------------------------
create or replace function public.expirar_lista_espera(p_categoria_id uuid)
returns integer
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_expirados integer;
begin
  update public.lista_espera
    set estado = 'expirado', updated_at = now()
    where categoria_id = p_categoria_id
      and estado = 'notificado'
      and enlace_expira_en is not null
      and enlace_expira_en < now();
  get diagnostics v_expirados = row_count;
  return v_expirados;
end;
$$;

grant execute on function public.expirar_lista_espera(uuid) to authenticated;

create or replace function public.notificar_siguiente_lista_espera(p_categoria_id uuid)
returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_le public.lista_espera%rowtype;
  v_evento public.eventos%rowtype;
begin
  select e.* into v_evento
    from public.categorias c join public.eventos e on e.id = c.evento_id
    where c.id = p_categoria_id;
  if not found then raise exception 'La categoría no existe'; end if;

  if not (public.es_miembro_de_empresa(v_evento.empresa_id) or public.es_super_admin()) then
    raise exception 'No autorizado';
  end if;

  perform public.expirar_lista_espera(p_categoria_id);

  -- Si ya hay alguien con la ventana abierta, no se notifica a otro: el cupo es uno.
  if exists (
    select 1 from public.lista_espera
    where categoria_id = p_categoria_id and estado = 'notificado'
  ) then
    raise exception 'Ya hay una persona notificada con la ventana abierta. Espera a que expire.';
  end if;

  select * into v_le from public.lista_espera
    where categoria_id = p_categoria_id and estado = 'esperando'
    order by created_at
    limit 1
    for update;
  if not found then return null; end if;

  update public.lista_espera
    set estado = 'notificado',
        notificado_en = now(),
        enlace_expira_en = now() + interval '24 hours',
        updated_at = now()
    where id = v_le.id;

  insert into public.notificaciones (usuario_id, tipo, titulo, mensaje, enlace)
  values (
    v_le.usuario_id,
    'cupo_liberado',
    'Se liberó un cupo en ' || v_evento.nombre,
    'Tienes 24 horas para completar tu inscripción antes de que el cupo pase al siguiente de la lista.',
    '/eventos/' || v_evento.slug || '/inscripcion'
  );

  return v_le.id;
end;
$$;

grant execute on function public.notificar_siguiente_lista_espera(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6) Índices que faltaban para las consultas nuevas.
-- ---------------------------------------------------------------------------
create index if not exists lista_espera_cola_idx
  on public.lista_espera (categoria_id, estado, created_at);

create index if not exists perfiles_correo_idx on public.perfiles (lower(correo));

-- ---------------------------------------------------------------------------
-- 7) Una empresa no puede quedarse sin ningún administrador activo: nadie
-- podría crear eventos, cobrar ni gestionar el equipo desde dentro.
-- La aplicación ya lo comprueba para dar un mensaje claro; esto es la garantía.
-- ---------------------------------------------------------------------------
create or replace function public.proteger_ultimo_admin_empresa()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_quedan integer;
begin
  -- Solo importa cuando la fila DEJA de ser un admin activo.
  if tg_op = 'UPDATE'
     and old.rol = 'admin_empresa' and old.estado = 'activo'
     and new.rol = 'admin_empresa' and new.estado = 'activo' then
    return new;
  end if;
  if tg_op = 'UPDATE' and not (old.rol = 'admin_empresa' and old.estado = 'activo') then
    return new;
  end if;
  if tg_op = 'DELETE' and not (old.rol = 'admin_empresa' and old.estado = 'activo') then
    return old;
  end if;

  select count(*) into v_quedan
    from public.empresa_miembros
    where empresa_id = old.empresa_id
      and rol = 'admin_empresa'
      and estado = 'activo'
      and usuario_id <> old.usuario_id;

  if v_quedan = 0 then
    raise exception 'Es el único administrador activo de la empresa. Nombra a otro antes de cambiarlo.';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists proteger_ultimo_admin_empresa on public.empresa_miembros;
create trigger proteger_ultimo_admin_empresa
  before update or delete on public.empresa_miembros
  for each row execute function public.proteger_ultimo_admin_empresa();
