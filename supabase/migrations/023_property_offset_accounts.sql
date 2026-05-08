create table public.property_offset_accounts (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  label text not null,
  balance numeric(12,2) not null default 0,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.property_offset_accounts enable row level security;

create policy "Users can manage own offset accounts"
  on public.property_offset_accounts
  for all
  using (property_id in (select id from public.properties where user_id = auth.uid()))
  with check (property_id in (select id from public.properties where user_id = auth.uid()));

grant select, insert, update, delete on public.property_offset_accounts to authenticated;
