-- Add property_type to properties
-- 'investment' = rental/investment property (appears in calculator, financial reports)
-- 'primary_residence' = owner-occupied home (tracked for history/value, excluded from tax calcs)
alter table public.properties
  add column property_type text not null default 'investment'
    check (property_type in ('investment', 'primary_residence'));
