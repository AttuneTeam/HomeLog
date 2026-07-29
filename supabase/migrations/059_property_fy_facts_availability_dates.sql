-- ============================================================
-- Availability dates on property_fy_facts
--
-- days_available_for_rent is a derived number; the dates are the fact the
-- owner actually holds ("available from 22 November"). Storing only the count
-- loses the evidence and makes the figure impossible to check or re-derive.
--
-- days_available_for_rent is retained as the resolved value that apportionment
-- reads, computed from these dates when they are supplied. Keeping one
-- consumer-facing column means Phase 3 does not have to know whether the
-- number came from dates or was entered directly (e.g. a property with two
-- separate availability windows in one year).
--
-- These are AVAILABILITY dates, not tenancy dates. Under the ATO test a
-- property is available for rent once it is genuinely on the market, which can
-- precede the first tenant moving in.
-- ============================================================

alter table public.property_fy_facts
  add column if not exists available_from date,
  add column if not exists available_to   date;

-- Dates are clamped to the financial year when the day count is derived, so
-- values outside the year are permitted — a property available since 2019 is
-- legitimately recorded as such. Only an inverted range is nonsense.
alter table public.property_fy_facts
  add constraint property_fy_facts_available_range_check
  check (
    available_from is null
    or available_to is null
    or available_to >= available_from
  );

comment on column public.property_fy_facts.available_from is
  'Date the property became genuinely available to rent (on the market), not the date a tenant moved in. Null means available from the start of the financial year.';
comment on column public.property_fy_facts.available_to is
  'Date availability ended. Null means still available at the end of the financial year.';
