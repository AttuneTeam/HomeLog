create table public.xero_account_mappings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tenant_id text not null,
  home_base_category text not null,
  xero_account_code text not null,
  xero_account_name text,
  xero_tracking_category_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, tenant_id, home_base_category)
);

alter table public.xero_account_mappings enable row level security;

create policy "xero_account_mappings: own rows"
  on public.xero_account_mappings
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger trg_xero_account_mappings_updated_at
  before update on public.xero_account_mappings
  for each row execute function public.set_updated_at();

grant select, insert, update, delete on public.xero_account_mappings to authenticated;
grant all on public.xero_account_mappings to service_role;
