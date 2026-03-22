-- Add claimable flag to renovations
-- When false, the renovation is excluded from all tax calculations
-- (FY repairs, capital totals, cost base, ROI actualFyRepairs)
alter table public.renovations
  add column claimable boolean not null default true;
