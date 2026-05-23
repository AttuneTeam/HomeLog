-- ============================================================
-- property_shares: property-level restricted sharing
-- Owner shares a specific property with a viewer (e.g. accountant).
-- Viewers get read-only access to that property's data.
-- ============================================================

create table public.property_shares (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  owner_id uuid not null references auth.users(id),
  grantee_email text not null,
  grantee_user_id uuid references auth.users(id) on delete set null,
  role text not null default 'viewer' check (role in ('viewer')),
  status text not null default 'pending'
    check (status in ('pending', 'active', 'declined', 'revoked')),
  invite_token text not null default gen_random_uuid()::text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(property_id, grantee_email)
);

alter table public.property_shares enable row level security;

-- Owner can manage shares for their properties
create policy "property_shares: owner manages" on public.property_shares
  for all using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- Grantee can read their own share invite
create policy "property_shares: grantee reads own" on public.property_shares
  for select using (auth.uid() = grantee_user_id);

create trigger trg_property_shares_updated_at
  before update on public.property_shares
  for each row execute function public.set_updated_at();

create index on public.property_shares (property_id);
create index on public.property_shares (owner_id);
create index on public.property_shares (grantee_user_id);
create index on public.property_shares (invite_token);
