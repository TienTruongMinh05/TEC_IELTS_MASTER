insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'ielts-listening',
  'ielts-listening',
  true,
  52428800,
  array['audio/mpeg', 'audio/mp4']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Authenticated users can listen to IELTS audio"
  on storage.objects;
