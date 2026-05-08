create table public.property_loans (
  property_id uuid primary key references public.properties(id) on delete cascade,
  loan_amount numeric(12,2) not null,
  loan_term_years int not null,
  updated_at timestamptz default now() not null
);

alter table public.property_loans enable row level security;

create policy "Users can manage own property loans"
  on public.property_loans
  for all
  using (property_id in (select id from public.properties where user_id = auth.uid()))
  with check (property_id in (select id from public.properties where user_id = auth.uid()));

grant select, insert, update, delete on public.property_loans to authenticated;
