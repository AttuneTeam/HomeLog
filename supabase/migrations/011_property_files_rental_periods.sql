-- ============================================================
-- Property files: property-level document attachments
-- ============================================================

-- Storage bucket (private)
insert into storage.buckets (id, name, public)
values ('property-files', 'property-files', false);

create policy "property-files: upload own folder" on storage.objects
  for insert with check (
    bucket_id = 'property-files'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "property-files: read own folder" on storage.objects
  for select using (
    bucket_id = 'property-files'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "property-files: delete own folder" on storage.objects
  for delete using (
    bucket_id = 'property-files'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Table
create table public.property_files (
  id           uuid primary key default gen_random_uuid(),
  property_id  uuid not null references public.properties(id) on delete cascade,
  storage_path text not null,
  display_name text,
  created_at   timestamptz not null default now()
);

alter table public.property_files enable row level security;

create policy "property_files: via property owner" on public.property_files
  for all using (
    exists (
      select 1 from public.properties p
      where p.id = property_id and p.user_id = auth.uid()
    )
  );

create index on public.property_files (property_id);

-- ============================================================
-- Rental periods: tenancy history with management details
-- ============================================================

create table public.rental_periods (
  id                  uuid primary key default gen_random_uuid(),
  property_id         uuid not null references public.properties(id) on delete cascade,
  start_date          date not null,
  end_date            date,
  weekly_rent         numeric(10, 2) not null check (weekly_rent >= 0),
  management_company  text,
  agent_name          text,
  management_fee_pct  numeric(5, 2),
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.rental_periods enable row level security;

create policy "rental_periods: via property owner" on public.rental_periods
  for all using (
    exists (
      select 1 from public.properties p
      where p.id = property_id and p.user_id = auth.uid()
    )
  );

create index on public.rental_periods (property_id);

create trigger trg_rental_periods_updated_at
  before update on public.rental_periods
  for each row execute function public.set_updated_at();
