-- storage.buckets es una tabla normal: se puede crear por SQL. La subida/descarga real
-- de archivos siempre pasa por la API de Storage, pero las políticas de RLS sobre
-- storage.objects sí se definen aquí igual que cualquier tabla.

insert into storage.buckets (id, name, public)
values
  ('logos-empresa', 'logos-empresa', true),
  ('eventos', 'eventos', true),
  ('comprobantes', 'comprobantes', false),
  ('declaraciones', 'declaraciones', false),
  ('certificados', 'certificados', false),
  ('fotos-evento', 'fotos-evento', true)
on conflict (id) do nothing;

-- Convención de rutas (storage.foldername(name) devuelve un text[] con los segmentos):
--   logos-empresa/{empresa_id}/archivo.ext
--   eventos/{empresa_id}/{evento_id}/archivo.ext
--   fotos-evento/{empresa_id}/{evento_id}/archivo.ext
--   comprobantes/{empresa_id}/{inscripcion_id}/archivo.ext
--   declaraciones/{empresa_id}/{inscripcion_id}/archivo.ext
--   certificados/{empresa_id}/{inscripcion_id}/archivo.ext

create policy logos_empresa_lectura_publica on storage.objects for select
  using (bucket_id = 'logos-empresa');
create policy logos_empresa_escritura_staff on storage.objects for insert
  with check (bucket_id = 'logos-empresa' and public.es_admin_o_super((storage.foldername(name))[1]::uuid));
create policy logos_empresa_actualiza_staff on storage.objects for update
  using (bucket_id = 'logos-empresa' and public.es_admin_o_super((storage.foldername(name))[1]::uuid));
create policy logos_empresa_elimina_staff on storage.objects for delete
  using (bucket_id = 'logos-empresa' and public.es_admin_o_super((storage.foldername(name))[1]::uuid));

create policy eventos_bucket_lectura_publica on storage.objects for select
  using (bucket_id = 'eventos');
create policy eventos_bucket_escritura_staff on storage.objects for insert
  with check (bucket_id = 'eventos' and public.es_miembro_de_empresa((storage.foldername(name))[1]::uuid));
create policy eventos_bucket_actualiza_staff on storage.objects for update
  using (bucket_id = 'eventos' and public.es_miembro_de_empresa((storage.foldername(name))[1]::uuid));
create policy eventos_bucket_elimina_staff on storage.objects for delete
  using (bucket_id = 'eventos' and public.es_miembro_de_empresa((storage.foldername(name))[1]::uuid));

create policy fotos_evento_bucket_lectura_publica on storage.objects for select
  using (bucket_id = 'fotos-evento');
create policy fotos_evento_bucket_escritura_staff on storage.objects for insert
  with check (bucket_id = 'fotos-evento' and public.es_miembro_de_empresa((storage.foldername(name))[1]::uuid));
create policy fotos_evento_bucket_elimina_staff on storage.objects for delete
  using (bucket_id = 'fotos-evento' and public.es_miembro_de_empresa((storage.foldername(name))[1]::uuid));

-- comprobantes: privado, dueño de la inscripción + admin_empresa/super_admin. NUNCA operador.
create policy comprobantes_lectura on storage.objects for select
  using (
    bucket_id = 'comprobantes' and (
      public.es_admin_o_super((storage.foldername(name))[1]::uuid)
      or public.es_dueno_de_inscripcion((storage.foldername(name))[2]::uuid)
    )
  );
create policy comprobantes_escritura on storage.objects for insert
  with check (
    bucket_id = 'comprobantes' and (
      public.es_admin_o_super((storage.foldername(name))[1]::uuid)
      or public.es_dueno_de_inscripcion((storage.foldername(name))[2]::uuid)
    )
  );
create policy comprobantes_elimina on storage.objects for delete
  using (bucket_id = 'comprobantes' and public.es_admin_o_super((storage.foldername(name))[1]::uuid));

-- declaraciones: privado, dueño + admin_empresa + operador + super_admin.
create policy declaraciones_lectura on storage.objects for select
  using (
    bucket_id = 'declaraciones' and (
      public.es_miembro_de_empresa((storage.foldername(name))[1]::uuid)
      or public.es_dueno_de_inscripcion((storage.foldername(name))[2]::uuid)
    )
  );
create policy declaraciones_escritura on storage.objects for insert
  with check (
    bucket_id = 'declaraciones' and (
      public.es_miembro_de_empresa((storage.foldername(name))[1]::uuid)
      or public.es_dueno_de_inscripcion((storage.foldername(name))[2]::uuid)
    )
  );
-- Sin update/delete: documento legal inmutable (excepción vía service_role si hiciera falta).

-- certificados: privado, dueño + admin_empresa + super_admin.
create policy certificados_bucket_lectura on storage.objects for select
  using (
    bucket_id = 'certificados' and (
      public.es_admin_o_super((storage.foldername(name))[1]::uuid)
      or public.es_dueno_de_inscripcion((storage.foldername(name))[2]::uuid)
    )
  );
-- Sin insert/update/delete: los sube el servidor (service_role), que bypassa RLS.
