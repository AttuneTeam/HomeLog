-- Staging queue for bulk receipt ingestion.
-- Every imported file (bulk upload now; gmail/drive/mobile later) lands here,
-- is AI-extracted asynchronously, then reviewed and committed to expenses.

create table public.staged_receipts (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  -- Target chosen in review (set from a batch default, overridable per row).
  renovation_id        uuid references public.renovations(id) on delete set null,
  source               text not null default 'bulk_upload'
                         check (source in ('bulk_upload', 'gmail', 'drive', 'mobile', 'email_forward')),
  storage_path         text not null,
  original_filename    text,
  content_type         text,
  status               text not null default 'pending'
                         check (status in ('pending', 'extracting', 'needs_review', 'committed', 'dismissed', 'failed')),
  extracted            jsonb,
  confidence           numeric,
  error                text,
  -- External id for channel-level dedup (e.g. Gmail message id); null for bulk uploads.
  source_ref           text,
  committed_expense_id uuid references public.expenses(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- Channel dedup: the same source_ref can only be staged once per user+source.
create unique index staged_receipts_source_ref_unique
  on public.staged_receipts (user_id, source, source_ref)
  where source_ref is not null;

create index staged_receipts_user_status_idx
  on public.staged_receipts (user_id, status);

alter table public.staged_receipts enable row level security;

create policy "staged_receipts: own rows"
  on public.staged_receipts
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.update_staged_receipts_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger staged_receipts_updated_at
  before update on public.staged_receipts
  for each row execute function public.update_staged_receipts_updated_at();

grant select, insert, update, delete on public.staged_receipts to authenticated;
grant all on public.staged_receipts to service_role;
