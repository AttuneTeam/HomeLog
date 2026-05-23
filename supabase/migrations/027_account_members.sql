-- ============================================================
-- account_members: household-level account sharing
-- A primary owner invites co-owners by email; co-owners get
-- full read/write access to all of the owner's properties.
-- ============================================================

create table public.account_members (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  grantee_email text not null,
  grantee_user_id uuid references auth.users(id) on delete set null,
  role text not null default 'co_owner' check (role in ('co_owner')),
  status text not null default 'pending'
    check (status in ('pending', 'active', 'declined', 'revoked')),
  invite_token text not null default gen_random_uuid()::text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, grantee_email)
);

alter table public.account_members enable row level security;

-- Owner can manage (view, create, update, revoke) their own invites
create policy "account_members: owner manages" on public.account_members
  for all using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- Grantee can read their own invite (to see pending invites directed at them)
create policy "account_members: grantee reads own" on public.account_members
  for select using (auth.uid() = grantee_user_id);

create trigger trg_account_members_updated_at
  before update on public.account_members
  for each row execute function public.set_updated_at();

create index on public.account_members (owner_id);
create index on public.account_members (grantee_user_id);
create index on public.account_members (invite_token);
