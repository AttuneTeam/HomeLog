-- ============================================================
-- Depreciation method election
--
-- A quantity surveyor's schedule states Division 40 twice: once under the
-- diminishing value method and once under prime cost. The two give materially
-- different deductions in early years (on one real schedule, $555 versus $277
-- in year one) and the choice is an election the taxpayer makes, locked in per
-- asset.
--
-- Recording which method the figure came from makes that election explicit. A
-- bare number gives an accountant no way to tell which column of the schedule
-- it was read from.
--
-- Division 43 is unaffected: capital works can only be claimed on prime cost,
-- so it is identical under both methods.
-- ============================================================

alter table public.depreciation_reports
  add column if not exists depreciation_method text
    check (depreciation_method in ('diminishing_value', 'prime_cost'));

comment on column public.depreciation_reports.depreciation_method is
  'Which column of the QS schedule the Division 40 figure was taken from. Division 43 is identical under both methods.';
