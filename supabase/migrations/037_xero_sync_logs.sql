create type public.xero_sync_status as enum ('pending', 'in_progress', 'completed', 'failed');

create table public.xero_sync_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tenant_id text not null,
  property_id uuid references public.properties(id) on delete set null,
  financial_year text not null,
  fy_start date not null,
  fy_end date not null,
  status xero_sync_status not null default 'pending',
  xero_journal_ids text[] not null default '{}',
  records_pushed int not null default 0,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.xero_sync_logs enable row level security;

create policy "xero_sync_logs: own rows"
  on public.xero_sync_logs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index on public.xero_sync_logs (user_id, property_id);

grant select, insert, update, delete on public.xero_sync_logs to authenticated;
grant all on public.xero_sync_logs to service_role;
