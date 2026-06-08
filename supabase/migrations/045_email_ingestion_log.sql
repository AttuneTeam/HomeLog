create table public.email_ingestion_log (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  source_email_id  text not null,
  received_at      timestamptz not null default now(),
  sender_address   text,
  raw_subject      text,
  status           text not null check (status in ('parsed', 'unmatched', 'duplicate', 'error')),
  extracted_type   text check (extracted_type in ('rental_payment', 'expense', 'unknown')),
  target_table     text,
  target_record_id uuid,
  parse_notes      text,
  unique (user_id, source_email_id)
);

alter table public.email_ingestion_log enable row level security;

create policy "email_ingestion_log: own rows"
  on public.email_ingestion_log
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index on public.email_ingestion_log (user_id);
create index on public.email_ingestion_log (received_at desc);

grant select, insert, update, delete on public.email_ingestion_log to authenticated;
grant all on public.email_ingestion_log to service_role;
