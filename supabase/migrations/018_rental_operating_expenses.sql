create type public.rental_expense_category as enum (
  'water',
  'council_rates',
  'insurance',
  'repairs_maintenance',
  'strata_fees',
  'land_tax',
  'other'
);

create table public.rental_operating_expenses (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  category rental_expense_category not null,
  amount numeric(12, 2) not null,
  gst_amount numeric(12, 2),
  expense_date date not null,
  description text,
  supplier text,
  abn text,
  invoice_path text,
  notes text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.rental_operating_expenses enable row level security;

create policy "Users can manage own rental operating expenses"
  on public.rental_operating_expenses
  using (
    property_id in (
      select id from public.properties where user_id = auth.uid()
    )
  );

grant select, insert, update, delete
  on public.rental_operating_expenses to authenticated;
