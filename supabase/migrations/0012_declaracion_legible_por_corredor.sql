-- =========================================================================
-- Corrección: el corredor no podía leer la declaración de salud que firma.
--
-- La política anterior solo dejaba leer las declaraciones generales de empresa
-- (evento_id is null) al personal de esa empresa. Un corredor que se inscribe
-- obtenía cero filas, y el código que la busca creaba una duplicada.
--
-- La declaración es un texto legal que el participante DEBE poder leer antes de
-- aceptarlo, así que se vuelve legible para cualquiera mientras la empresa esté
-- operativa —el mismo nivel de exposición que la descripción de un evento.
-- =========================================================================

drop policy if exists declaraciones_salud_select on public.declaraciones_salud;

create policy declaraciones_salud_select on public.declaraciones_salud for select
  using (
    -- Específica de un evento: visible si el evento lo es.
    (evento_id is not null
      and (public.evento_es_visible_publico(evento_id) or public.evento_es_visible_staff(evento_id)))
    -- General de la empresa: la lee quien vaya a firmarla.
    or (evento_id is null
      and exists (
        select 1 from public.empresas e
        where e.id = empresa_id and e.estado in ('activa', 'prueba')
      ))
    or public.es_miembro_de_empresa(empresa_id)
    or public.es_super_admin()
  );
