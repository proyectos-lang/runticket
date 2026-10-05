-- =========================================================================
-- El corredor sigue viendo las carreras en las que se inscribió aunque el
-- organizador las devuelva a borrador o las cancele.
--
-- La política de lectura de `eventos` solo abre los publicados, los de
-- inscripciones cerradas y los finalizados (más lo que ve el staff). Una carrera
-- cancelada —o devuelta a borrador para corregirla— desaparecía del historial
-- del corredor: su inscripción seguía ahí, pero sin evento no había tarjeta que
-- pintar, y el portal la descartaba en silencio. Para quien pagó, es como si
-- le hubieran borrado la carrera.
--
-- Se añade una rama: quien tiene una inscripción en el evento (propia o de un
-- acompañante suyo) puede leerlo, esté en el estado que esté. Leerlo, nada más:
-- las políticas de escritura no cambian.
--
-- Va en una función `security definer` para no consultar `inscripciones` desde
-- dentro de la política de `eventos`: sus propias políticas vuelven a mirar
-- `eventos`, y Postgres acabaría en una recursión.
-- =========================================================================

create or replace function public.corre_en_evento(p_evento_id uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.inscripciones i
    where i.evento_id = p_evento_id
      and (
        i.corredor_id = auth.uid()
        or i.corredor_id in (
          select a.usuario_id from public.acompanantes a where a.titular_id = auth.uid()
        )
      )
  );
$$;

grant execute on function public.corre_en_evento(uuid) to authenticated;

drop policy if exists eventos_select on public.eventos;
create policy eventos_select on public.eventos for select
  using (
    estado in ('publicado','inscripciones_cerradas','finalizado')
    or public.es_miembro_de_empresa(empresa_id)
    or public.es_super_admin()
    or public.corre_en_evento(id)
  );
