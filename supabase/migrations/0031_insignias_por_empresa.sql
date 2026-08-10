-- =========================================================================
-- Insignias por empresa organizadora — requisito 9.6.
--
-- Las tablas existen desde la 0008 y nunca sirvieron para nada, por dos motivos
-- que esta migración resuelve:
--
--   1. **El catálogo era global.** Solo el super-admin podía escribirlo, así que
--      un organizador no podía premiar la fidelidad a SU marca, que es el caso
--      de uso que justifica la funcionalidad. Ahora cada insignia pertenece a
--      una empresa y se gana solo con carreras suyas.
--
--   2. **No había motor.** El campo `criterio` estaba vacío y nada concedía
--      nada. Ahora hay un vocabulario cerrado de criterios y una función que los
--      evalúa al dar una carrera por finalizada.
--
-- Sigue sin haber `insert` de `usuario_insignias` para el cliente: las concede
-- el servidor cuando se cumple la condición, como la 0008 dejó dicho.
-- =========================================================================

-- ---------------------------------------------------------------------------
-- 1) La insignia es de una empresa
-- ---------------------------------------------------------------------------
alter table public.insignias
  add column if not exists empresa_id uuid references public.empresas(id) on delete cascade;

-- Las filas sin empresa no pueden existir en la práctica: el catálogo nunca tuvo
-- interfaz y solo un super-admin con acceso directo a la base habría podido
-- crear alguna. Se limpian para poder exigir la pertenencia; si en tu instalación
-- hubiera insignias que conservar, asígnales `empresa_id` ANTES de aplicar esto.
delete from public.usuario_insignias
  where insignia_id in (select id from public.insignias where empresa_id is null);
delete from public.insignias where empresa_id is null;

alter table public.insignias alter column empresa_id set not null;

-- El código identifica la insignia dentro de su empresa, no en toda la
-- plataforma: dos organizadores distintos pueden querer su «maratonista».
alter table public.insignias drop constraint if exists insignias_codigo_key;
create unique index if not exists insignias_codigo_por_empresa
  on public.insignias (empresa_id, codigo);
create index if not exists insignias_empresa_idx on public.insignias (empresa_id);

alter table public.insignias add column if not exists activa boolean not null default true;

-- ---------------------------------------------------------------------------
-- 2) Vocabulario cerrado de criterios
--
-- Cerrado a propósito. Un `criterio` de forma libre parece flexible, pero deja
-- al motor adivinando qué hacer con lo que no entiende, y lo que no entiende se
-- traduce en insignias que no se conceden nunca sin decir por qué. Estos cuatro
-- cubren el programa de fidelidad que pide el requisito; añadir uno es tocar el
-- check y la función, que es exactamente donde uno quiere enterarse.
--
--   {"tipo":"carreras_completadas",    "minimo": 3}   carreras finalizadas contigo
--   {"tipo":"distancia_acumulada",     "minimo": 100} km sumados en tus carreras
--   {"tipo":"distancia_en_una_carrera","minimo": 42}  una sola de al menos N km
--   {"tipo":"anos_distintos",          "minimo": 3}   años naturales distintos
-- ---------------------------------------------------------------------------
-- Se quita el `default '{}'`: un objeto vacío no describe ninguna condición, y
-- con él una insignia mal creada se quedaba esperando un motor que nunca la
-- podría conceder. Ahora el criterio es obligatorio y explícito.
alter table public.insignias alter column criterio drop default;

alter table public.insignias drop constraint if exists insignias_criterio_valido;
alter table public.insignias add constraint insignias_criterio_valido check (
  criterio->>'tipo' in (
    'carreras_completadas',
    'distancia_acumulada',
    'distancia_en_una_carrera',
    'anos_distintos'
  )
  and (criterio->>'minimo') ~ '^[0-9]+(\.[0-9]+)?$'
  and (criterio->>'minimo')::numeric > 0
);

comment on column public.insignias.criterio is
  'Condición para ganarla. Vocabulario cerrado: carreras_completadas, distancia_acumulada, distancia_en_una_carrera, anos_distintos, cada uno con "minimo".';

-- ---------------------------------------------------------------------------
-- 3) Quién ve y quién escribe
-- ---------------------------------------------------------------------------
drop policy if exists insignias_select on public.insignias;
drop policy if exists insignias_write on public.insignias;

-- El catálogo se lee abierto: el portal tiene que poder poner nombre e icono a
-- una insignia ganada, y no hay nada sensible en «Maratonista, 42 km».
create policy insignias_select on public.insignias for select using (true);

create policy insignias_write on public.insignias for all
  using (public.es_admin_o_super(empresa_id))
  with check (public.es_admin_o_super(empresa_id));

-- El corredor ve las suyas; la empresa, las que ha concedido ella. Ninguna
-- empresa ve las que otra concedió al mismo corredor.
drop policy if exists usuario_insignias_select on public.usuario_insignias;
create policy usuario_insignias_select on public.usuario_insignias for select
  using (
    usuario_id = auth.uid()
    or exists (
      select 1 from public.insignias i
      where i.id = insignia_id and public.es_miembro_de_empresa(i.empresa_id)
    )
    or public.es_super_admin()
  );

-- Deja constancia de con qué carrera se ganó: sin esto, el portal solo puede
-- decir «la tienes» y no «la ganaste aquí».
alter table public.usuario_insignias
  add column if not exists evento_id uuid references public.eventos(id) on delete set null;

-- ---------------------------------------------------------------------------
-- 4) El motor
--
-- Se dispara al dar una carrera por finalizada y evalúa **solo a los corredores
-- de esa carrera**, contra las insignias activas de esa empresa. Recorrer todo
-- el padrón histórico en cada cierre sería caro y no cambiaría el resultado:
-- nadie que no haya corrido puede haber cruzado un umbral.
--
-- Idempotente por el `unique (usuario_id, insignia_id)` de la 0008.
-- ---------------------------------------------------------------------------
create or replace function public.otorgar_insignias_de_evento(p_evento_id uuid)
returns integer
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_evento public.eventos%rowtype;
  v_n      integer;
begin
  select * into v_evento from public.eventos where id = p_evento_id;
  if not found then raise exception 'El evento no existe'; end if;

  if not public.es_admin_o_super(v_evento.empresa_id) then
    raise exception 'No autorizado';
  end if;

  if v_evento.estado <> 'finalizado' then
    return 0;
  end if;

  with participantes as (
    select distinct i.corredor_id
    from public.inscripciones i
    where i.evento_id = p_evento_id and i.estado = 'activa'
  ),
  -- Historial de cada participante **con esta empresa**: una fila por carrera
  -- suya ya finalizada. Es la base de los cuatro criterios.
  historial as (
    select
      p.corredor_id,
      count(distinct e.id)::numeric                       as carreras,
      coalesce(sum(c.distancia_km), 0)::numeric           as km_totales,
      coalesce(max(c.distancia_km), 0)::numeric           as km_mayor,
      count(distinct extract(year from e.fecha_inicio))::numeric as anos
    from participantes p
    join public.inscripciones i
      on i.corredor_id = p.corredor_id and i.estado = 'activa'
    join public.eventos e
      on e.id = i.evento_id
     and e.empresa_id = v_evento.empresa_id
     and e.estado = 'finalizado'
    left join public.categorias c on c.id = i.categoria_id
    group by p.corredor_id
  ),
  ganadas as (
    select h.corredor_id, ins.id as insignia_id
    from historial h
    cross join public.insignias ins
    where ins.empresa_id = v_evento.empresa_id
      and ins.activa
      and case ins.criterio->>'tipo'
            when 'carreras_completadas'     then h.carreras   >= (ins.criterio->>'minimo')::numeric
            when 'distancia_acumulada'      then h.km_totales >= (ins.criterio->>'minimo')::numeric
            when 'distancia_en_una_carrera' then h.km_mayor   >= (ins.criterio->>'minimo')::numeric
            when 'anos_distintos'           then h.anos       >= (ins.criterio->>'minimo')::numeric
            else false
          end
  )
  insert into public.usuario_insignias (usuario_id, insignia_id, evento_id)
  select g.corredor_id, g.insignia_id, p_evento_id
  from ganadas g
  on conflict (usuario_id, insignia_id) do nothing;

  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

grant execute on function public.otorgar_insignias_de_evento(uuid) to authenticated;

comment on function public.otorgar_insignias_de_evento(uuid) is
  'Concede las insignias de la empresa a los corredores de una carrera finalizada que cumplan el criterio. Idempotente; solo mira carreras de la propia empresa.';

-- ---------------------------------------------------------------------------
-- 5) Las insignias de un corredor, para su portal
--
-- Por RPC porque son dos tablas y los tipos del esquema están escritos a mano y
-- no declaran las relaciones, así que un select anidado no tendría tipos.
-- ---------------------------------------------------------------------------
create or replace function public.insignias_de_corredor()
returns table (
  codigo      text,
  nombre      text,
  descripcion text,
  icono_url   text,
  empresa     text,
  obtenida_en timestamptz
)
language sql stable security definer set search_path = public, pg_temp
as $$
  select i.codigo, i.nombre, i.descripcion, i.icono_url, em.nombre_comercial, ui.obtenida_en
  from public.usuario_insignias ui
  join public.insignias i on i.id = ui.insignia_id
  join public.empresas em on em.id = i.empresa_id
  where ui.usuario_id = auth.uid()
  order by ui.obtenida_en desc;
$$;

grant execute on function public.insignias_de_corredor() to authenticated;

comment on function public.insignias_de_corredor() is
  'Las insignias del corredor autenticado, con el nombre de la empresa que se las concedió. Nunca las de otro: filtra por auth.uid().';
