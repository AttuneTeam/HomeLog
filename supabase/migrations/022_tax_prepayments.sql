create table public.tax_prepayments (
  user_id uuid not null references auth.users(id) on delete cascade,
  financial_year_end int not null, -- e.g. 2026 for FY2025-26
  amount numeric(12,2) not null default 0,
  updated_at timestamptz default now() not null,
  primary key (user_id, financial_year_end)
);

alter table public.tax_prepayments enable row level security;

create policy "Users can manage own tax prepayments"
  on public.tax_prepayments
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update, delete on public.tax_prepayments to authenticated;
