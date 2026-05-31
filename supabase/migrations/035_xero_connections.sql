create table public.xero_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tenant_id text not null,
  tenant_name text,
  access_token text not null,
  refresh_token text not null,
  token_expires_at timestamptz not null,
  scopes text[] not null default '{}',
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, tenant_id)
);

alter table public.xero_connections enable row level security;

create policy "xero_connections: own rows"
  on public.xero_connections
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index on public.xero_connections (user_id);

create trigger trg_xero_connections_updated_at
  before update on public.xero_connections
  for each row execute function public.set_updated_at();

grant select, insert, update, delete on public.xero_connections to authenticated;
grant all on public.xero_connections to service_role;
