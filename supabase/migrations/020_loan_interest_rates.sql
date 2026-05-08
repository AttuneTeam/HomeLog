create table public.loan_interest_rates (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  rate numeric(5,3) not null,
  effective_date date not null,
  notes text,
  created_at timestamptz default now() not null
);

alter table public.loan_interest_rates enable row level security;

create policy "Users can manage own loan interest rates"
  on public.loan_interest_rates
  for all
  using (property_id in (select id from public.properties where user_id = auth.uid()))
  with check (property_id in (select id from public.properties where user_id = auth.uid()));

grant select, insert, update, delete on public.loan_interest_rates to authenticated;
