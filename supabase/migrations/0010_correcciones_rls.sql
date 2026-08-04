-- Correcciones encontradas al probar los flujos reales en la aplicación.
-- Si ya ejecutaste 0001-0009, corre SOLO este archivo (es idempotente).
-- Si vas a ejecutar todo desde cero, 0002/0004/0006 ya incluyen estos arreglos
-- y este archivo simplemente los vuelve a aplicar sin efecto.

-- ---------------------------------------------------------------------------
-- 1) Permitir dar de alta al PRIMER super_admin.
--
-- auth.uid() es null cuando la mutación viene de fuera de una sesión de la API
-- (SQL Editor, Supabase CLI, o el cliente service_role sin contexto de usuario).
-- Esa vía ya está protegida por requerir credenciales de la base de datos, y es
-- la única forma de crear el primer super_admin: antes, el trigger la bloqueaba
-- y el sistema quedaba sin forma de arrancar. Si SÍ hay sesión de usuario, se
-- sigue exigiendo que sea super_admin.
-- ---------------------------------------------------------------------------

create or replace function public.proteger_rol_plataforma()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
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

-- ---------------------------------------------------------------------------
-- 2) Arreglar INSERT ... RETURNING en eventos y pagos.
--
-- Las políticas de SELECT llamaban funciones `stable` que vuelven a consultar la
-- MISMA tabla por id. Una función STABLE ve la instantánea del inicio de la
-- sentencia, así que no encuentra la fila que esa misma sentencia está
-- insertando: el RETURNING (lo que hace PostgREST con .select()) era denegado con
-- "new row violates row-level security policy". La corrección resuelve la
-- visibilidad con las columnas de la propia fila.
--
-- Las funciones evento_es_visible_publico/staff siguen siendo correctas para las
-- tablas hijas (categorías, imágenes, tallas…), que referencian un evento que ya
-- existe; por eso no se tocan.
-- ---------------------------------------------------------------------------

drop policy if exists eventos_select on public.eventos;
create policy eventos_select on public.eventos for select
  using (
    estado in ('publicado','inscripciones_cerradas','finalizado')
    or public.es_miembro_de_empresa(empresa_id)
    or public.es_super_admin()
  );

drop policy if exists pagos_select on public.pagos;
create policy pagos_select on public.pagos for select
  using (
    public.es_admin_o_super(empresa_id)
    or (inscripcion_id is not null and public.es_dueno_de_inscripcion(inscripcion_id))
    or (grupo_inscripcion_id is not null and exists (
          select 1 from public.grupos_inscripcion g
          where g.id = grupo_inscripcion_id and g.pagador_id = auth.uid()
        ))
  );
