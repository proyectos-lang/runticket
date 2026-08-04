-- =========================================================================
-- Una empresa no se podía borrar nunca.
--
-- `proteger_ultimo_admin_empresa` (0017) impide que una empresa se quede sin
-- administrador activo, y eso está bien mientras la empresa siga existiendo.
-- El problema es que también se dispara cuando la fila desaparece **porque la
-- empresa entera se está borrando**: `empresa_miembros.empresa_id` es
-- `on delete cascade`, así que al eliminar la empresa Postgres borra sus
-- miembros y el disparador aborta la operación con
-- «Es el único administrador activo de la empresa».
--
-- Resultado: `delete from empresas` fallaba siempre que la empresa tuviera un
-- administrador, que es el caso normal. Lo mismo al borrar la cuenta de ese
-- administrador, porque `empresa_miembros.usuario_id` también va en cascada.
--
-- La corrección es distinguir los dos casos. En un borrado en cascada la fila
-- padre ya no está cuando se ejecuta el disparador de la hija —el FK cascade se
-- resuelve después de eliminar el padre, dentro de la misma transacción—, así
-- que basta con mirar si la empresa sigue existiendo: si no existe, no queda
-- nada que proteger.
-- =========================================================================

create or replace function public.proteger_ultimo_admin_empresa()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_quedan integer;
begin
  -- Borrado en cascada de la empresa: no hay empresa que dejar huérfana.
  if tg_op = 'DELETE' and not exists (
    select 1 from public.empresas where id = old.empresa_id
  ) then
    return old;
  end if;

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

comment on function public.proteger_ultimo_admin_empresa() is
  'Impide dejar una empresa viva sin administrador activo. No se aplica cuando la fila desaparece porque se está borrando la propia empresa o la cuenta del usuario.';
