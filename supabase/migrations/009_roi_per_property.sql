-- Recreate roi_calculator_inputs scoped per investment property
-- (previously one row per user; now one row per property)

drop trigger if exists roi_calculator_inputs_updated_at on public.roi_calculator_inputs;
drop function if exists public.touch_roi_calculator_inputs();
drop table if exists public.roi_calculator_inputs;

create table public.roi_calculator_inputs (
  property_id           uuid primary key references public.properties(id) on delete cascade,
  purchase_price        numeric,
  stamp_duty            numeric,
  legal_fees            numeric,
  capital_growth_rate   numeric default 5,
  weekly_rent           numeric,
  management_fee_rate   numeric default 8,
  council_rates         numeric,
  insurance             numeric,
  maintenance           numeric,
  loan_amount           numeric,
  interest_rate         numeric,
  loan_term             integer default 30,
  div43_depreciation    numeric default 0,
  div40_depreciation    numeric default 0,
  marginal_tax_rate     numeric default 32.5,
  annual_household_income numeric,
  updated_at            timestamptz default now()
);

alter table public.roi_calculator_inputs enable row level security;

-- Access is through property ownership
create policy "roi_calculator_inputs: own property"
  on public.roi_calculator_inputs for all
  using (
    exists (
      select 1 from public.properties
      where id = property_id
        and user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.properties
      where id = property_id
        and user_id = auth.uid()
    )
  );

create or replace function public.touch_roi_calculator_inputs()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger roi_calculator_inputs_updated_at
  before update on public.roi_calculator_inputs
  for each row execute procedure public.touch_roi_calculator_inputs();
