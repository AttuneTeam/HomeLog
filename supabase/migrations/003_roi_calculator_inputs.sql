create table public.roi_calculator_inputs (
  user_id               uuid primary key references public.profiles(id) on delete cascade,
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
  updated_at            timestamptz default now()
);

alter table public.roi_calculator_inputs enable row level security;

create policy "roi_calculator_inputs: own row"
  on public.roi_calculator_inputs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

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
