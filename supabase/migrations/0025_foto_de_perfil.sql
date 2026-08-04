-- =========================================================================
-- Foto de perfil del corredor.
--
-- La cabecera del portal ya dibujaba un avatar circular con un hueco que decía
-- «Foto» y enlazaba a editar el perfil, pero no había ni columna donde guardar
-- la imagen ni bucket donde subirla: era una maqueta sin nada detrás, y al
-- pulsarla no ocurría nada.
-- =========================================================================

alter table public.perfiles
  add column if not exists foto_url text;

comment on column public.perfiles.foto_url is
  'URL pública del avatar en el bucket `avatares`. Nulo mientras no suba ninguna.';

-- ---------------------------------------------------------------------------
-- Bucket público.
--
-- Público como `logos-empresa` y no privado como `comprobantes`: la foto se
-- pinta en la cabecera del portal en cada carga, y firmar una URL temporal cada
-- vez sería un viaje al servidor por algo que el propio corredor está enseñando.
-- No hay dato sensible en un avatar.
--
-- Convención de ruta:  avatares/{usuario_id}/archivo.ext
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatares', 'avatares', true)
on conflict (id) do nothing;

-- Límite de peso y tipos permitidos, como en el resto de buckets de imagen: el
-- cliente ya comprime, pero el cliente no es una barrera de seguridad.
update storage.buckets
  set file_size_limit = 2097152,
      allowed_mime_types = array['image/webp', 'image/jpeg', 'image/png', 'image/avif']
  where id = 'avatares';

drop policy if exists avatares_lectura_publica on storage.objects;
create policy avatares_lectura_publica on storage.objects for select
  using (bucket_id = 'avatares');

-- Cada quien escribe **solo dentro de su propia carpeta**. Es la misma idea que
-- en el resto de buckets (el primer segmento manda), pero aquí la llave es el
-- usuario y no la empresa: un corredor no pertenece a ninguna.
drop policy if exists avatares_escritura_propia on storage.objects;
create policy avatares_escritura_propia on storage.objects for insert
  with check (bucket_id = 'avatares' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists avatares_actualiza_propia on storage.objects;
create policy avatares_actualiza_propia on storage.objects for update
  using (bucket_id = 'avatares' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists avatares_elimina_propia on storage.objects;
create policy avatares_elimina_propia on storage.objects for delete
  using (bucket_id = 'avatares' and (storage.foldername(name))[1] = auth.uid()::text);

-- `perfiles_update_propio` (0002) ya permite al dueño actualizar su fila, así que
-- no hace falta política nueva para escribir `foto_url`. Y `proteger_rol_plataforma`
-- sigue impidiendo que de paso se cambie el rol.
