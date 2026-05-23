-- ============================================================
-- property_passport_links: public, token-based URL for the
-- property history timeline. Accessible without authentication.
-- One link per property; regenerating replaces the old token.
-- ============================================================

create table public.property_passport_links (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  owner_id uuid not null references auth.users(id),
  share_token text not null default gen_random_uuid()::text,
  expires_at timestamptz default null,
  created_at timestamptz not null default now(),
  unique(property_id),
  unique(share_token)
);

alter table public.property_passport_links enable row level security;

-- Owner can create, view, and delete the passport link for their property
create policy "passport_links: owner manages" on public.property_passport_links
  for all using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create index on public.property_passport_links (share_token);
create index on public.property_passport_links (property_id);
