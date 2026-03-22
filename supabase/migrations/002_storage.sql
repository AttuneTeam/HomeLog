-- ============================================================
-- Storage: invoices bucket
-- ============================================================
insert into storage.buckets (id, name, public)
values ('invoices', 'invoices', false);

-- Users can upload to their own folder: invoices/{user_id}/...
create policy "invoices: upload own folder" on storage.objects
  for insert with check (
    bucket_id = 'invoices'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can read their own invoices
create policy "invoices: read own folder" on storage.objects
  for select using (
    bucket_id = 'invoices'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can delete their own invoices
create policy "invoices: delete own folder" on storage.objects
  for delete using (
    bucket_id = 'invoices'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
