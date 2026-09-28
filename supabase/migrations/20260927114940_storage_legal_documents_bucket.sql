-- Private bucket for confidential legal documents. Object keys: <office_id>/<uuid>/<file name>.
-- Reading an object requires a visible public.documents row with the same storage_path, so Storage
-- inherits exactly the document permissions (role, office, matter assignment). Nothing is public.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'legal-documents', 'legal-documents', false, 52428800,
  array[
    'application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/webp', 'text/plain',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy legal_documents_read on storage.objects for select to authenticated
  using (
    bucket_id = 'legal-documents'
    and exists (select 1 from public.documents d where d.storage_path = storage.objects.name)
  );

-- Upload into your own office folder only, and only for roles that may manage documents.
create policy legal_documents_upload on storage.objects for insert to authenticated
  with check (
    bucket_id = 'legal-documents'
    and (storage.foldername(name))[1] = (select private.current_office_id())::text
    and (select private.current_app_role()) in ('admin', 'employee', 'lawyer')
  );

-- No update policy: stored legal documents are never overwritten in place.
create policy legal_documents_delete_admin on storage.objects for delete to authenticated
  using (
    bucket_id = 'legal-documents'
    and (storage.foldername(name))[1] = (select private.current_office_id())::text
    and (select private.current_app_role()) = 'admin'
  );

-- The platform's RLS event-trigger helper is not meant to be called through the API.
do $$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'rls_auto_enable') then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;
