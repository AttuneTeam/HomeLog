create table public.rental_payments (
  id               uuid primary key default gen_random_uuid(),
  property_id      uuid not null references public.properties(id) on delete cascade,
  rental_period_id uuid references public.rental_periods(id) on delete set null,
  payment_date     date not null,
  amount           numeric(10, 2) not null check (amount >= 0),
  period_start     date,
  period_end       date,
  source_email_id  text,
  raw_subject      text,
  notes            text,
  created_at       timestamptz not null default now()
);

alter table public.rental_payments enable row level security;

create policy "rental_payments: via property owner"
  on public.rental_payments
  for all
  using (
    exists (
      select 1 from public.properties p
      where p.id = property_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.properties p
      where p.id = property_id and p.user_id = auth.uid()
    )
  );

create index on public.rental_payments (property_id);
create index on public.rental_payments (source_email_id);

grant select, insert, update, delete on public.rental_payments to authenticated;
grant all on public.rental_payments to service_role;
