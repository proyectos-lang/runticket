create table public.pagos (
  id                     uuid primary key default gen_random_uuid(),
  inscripcion_id         uuid references public.inscripciones(id) on delete cascade,
  grupo_inscripcion_id   uuid references public.grupos_inscripcion(id) on delete cascade,
  empresa_id             uuid not null references public.empresas(id) on delete cascade,
  monto                  numeric(12,2) not null check (monto >= 0),
  moneda                 text not null default 'HNL',
  metodo                 text not null check (metodo in ('whatsapp','pasarela','comprobante_transferencia','efectivo','manual')),
  proveedor              text,
  referencia_externa     text,
  comprobante_url        text,
  estado                 text not null default 'pendiente'
                            check (estado in ('pendiente','en_verificacion','pagado','rechazado','reembolsado','anulado')),
  verificado_por         uuid references auth.users(id),
  verificado_en          timestamptz,
  notas                  text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  created_by             uuid references auth.users(id),
  check (inscripcion_id is not null or grupo_inscripcion_id is not null)
);

create index pagos_inscripcion_idx on public.pagos (inscripcion_id);
create index pagos_grupo_idx on public.pagos (grupo_inscripcion_id);
create index pagos_empresa_idx on public.pagos (empresa_id);
create index pagos_estado_idx on public.pagos (estado);
create trigger set_updated_at before update on public.pagos for each row execute function public.set_updated_at();

create table public.pagos_historial (
  id                uuid primary key default gen_random_uuid(),
  pago_id           uuid not null references public.pagos(id) on delete cascade,
  estado_anterior   text,
  estado_nuevo      text not null,
  usuario_id        uuid references auth.users(id),
  notas             text,
  created_at        timestamptz not null default now()
);
create index pagos_historial_pago_idx on public.pagos_historial (pago_id);

create or replace function public.empresa_de_pago(p_pago_id uuid)
returns uuid
language sql stable security definer set search_path = public, pg_temp
as $$
  select empresa_id from public.pagos where id = p_pago_id;
$$;

create or replace function public.es_dueno_de_pago(p_pago_id uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.pagos p
    left join public.inscripciones i on i.id = p.inscripcion_id
    left join public.grupos_inscripcion g on g.id = p.grupo_inscripcion_id
    where p.id = p_pago_id and (i.corredor_id = auth.uid() or g.pagador_id = auth.uid())
  );
$$;

-- Auditoría automática de cada cambio de estado (defensa en profundidad además de la RPC).
create or replace function public.registrar_historial_pago()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if new.estado is distinct from old.estado then
    insert into public.pagos_historial (pago_id, estado_anterior, estado_nuevo, usuario_id, notas)
    values (new.id, old.estado, new.estado, auth.uid(), new.notas);
  end if;
  return new;
end;
$$;

create trigger registrar_historial_pago
  after update on public.pagos
  for each row execute function public.registrar_historial_pago();

create or replace function public.actualizar_estado_pago(p_pago_id uuid, p_nuevo_estado text, p_notas text default null)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_empresa_id uuid; v_inscripcion_id uuid; v_grupo_id uuid;
begin
  select empresa_id, inscripcion_id, grupo_inscripcion_id
    into v_empresa_id, v_inscripcion_id, v_grupo_id
  from public.pagos where id = p_pago_id for update;
  if not found then raise exception 'Pago % no existe', p_pago_id; end if;

  if not public.es_admin_o_super(v_empresa_id) then
    raise exception 'No autorizado para cambiar el estado de este pago';
  end if;
  if p_nuevo_estado not in ('pendiente','en_verificacion','pagado','rechazado','reembolsado','anulado') then
    raise exception 'Estado de pago inválido: %', p_nuevo_estado;
  end if;

  update public.pagos
    set estado = p_nuevo_estado, notas = coalesce(p_notas, notas),
        verificado_por = auth.uid(), verificado_en = now(), updated_at = now()
    where id = p_pago_id;

  if p_nuevo_estado = 'pagado' then
    if v_inscripcion_id is not null then
      perform public.asignar_dorsal(v_inscripcion_id);
    else
      perform public.asignar_dorsal(i.id)
        from public.inscripciones i
        where i.grupo_inscripcion_id = v_grupo_id and i.estado = 'activa';
    end if;
  end if;
end;
$$;

grant execute on function public.actualizar_estado_pago(uuid, text, text) to authenticated;

alter table public.pagos enable row level security;
alter table public.pagos_historial enable row level security;

-- pagos: solo admin_empresa/super_admin (financiero) + el dueño (corredor/pagador del
-- grupo) ve el suyo. operador NUNCA tiene acceso (es_miembro_de_empresa NO se usa aquí).
-- La propiedad se resuelve por las FK de la propia fila y no con es_dueno_de_pago(id),
-- que al ser `stable` y reconsultar public.pagos no vería la fila recién insertada por
-- la sentencia en curso (rompería el INSERT ... RETURNING del corredor).
create policy pagos_select on public.pagos for select
  using (
    public.es_admin_o_super(empresa_id)
    or (inscripcion_id is not null and public.es_dueno_de_inscripcion(inscripcion_id))
    or (grupo_inscripcion_id is not null and exists (
          select 1 from public.grupos_inscripcion g
          where g.id = grupo_inscripcion_id and g.pagador_id = auth.uid()
        ))
  );

-- El corredor puede subir su propio comprobante, pero solo en estado pendiente/en_verificacion
-- y sin poder tocar los campos de verificación (evita que se auto-marque como "pagado").
create policy pagos_insert on public.pagos for insert
  with check (
    public.es_admin_o_super(empresa_id)
    or (
      (
        (inscripcion_id is not null and public.es_dueno_de_inscripcion(inscripcion_id))
        or (grupo_inscripcion_id is not null and exists (
              select 1 from public.grupos_inscripcion g
              where g.id = grupo_inscripcion_id and g.pagador_id = auth.uid()
            ))
      )
      and estado in ('pendiente','en_verificacion')
      and verificado_por is null
      and verificado_en is null
    )
  );

-- Solo admin_empresa/super_admin actualiza directamente (además de la RPC, que ya valida rol).
create policy pagos_update on public.pagos for update
  using (public.es_admin_o_super(empresa_id)) with check (public.es_admin_o_super(empresa_id));
-- Sin DELETE: los pagos se anulan vía estado, nunca se eliminan.

-- pagos_historial: append-only, solo SELECT por admin_empresa/super_admin. El INSERT lo
-- hace únicamente el trigger registrar_historial_pago (security definer, bypassa RLS).
create policy pagos_historial_select on public.pagos_historial for select
  using (public.es_admin_o_super(public.empresa_de_pago(pago_id)));
