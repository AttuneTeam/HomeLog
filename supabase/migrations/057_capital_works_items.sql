-- ============================================================
-- Division 43 capital works fields on expenses
--
-- A Div 43 deduction runs at a fixed rate from the date the works were
-- COMPLETED, for 40 years. Each improvement is therefore its own item with its
-- own clock: a bathroom finished in 2019 and a deck finished in 2024 are three
-- years apart in their write-down, and a single property-level figure cannot
-- represent both. The register is built per item.
--
-- Added as columns on expenses rather than a separate table: a capital works
-- item IS an expense already classified as capital, and a parallel table would
-- duplicate amount, date, supplier and invoice and then have to be kept in
-- step with reclassification.
--
-- The rate is stored per item rather than hardcoded. 2.5% p.a. is the standard
-- residential rate, but eligibility and the applicable rate depend on when the
-- work was constructed — a determination that belongs to the owner's quantity
-- surveyor, not to this product. See the same reasoning in migration 056.
-- ============================================================

alter table public.expenses
  add column if not exists capital_works_start_date date,
  -- numeric(5,2), not (4,2): the latter caps at 99.99, which makes the <= 100
  -- bound unreachable and turns an out-of-range rate into an opaque "numeric
  -- field overflow" instead of a named check violation.
  add column if not exists capital_works_rate_pct numeric(5,2) not null default 2.5
    check (capital_works_rate_pct > 0 and capital_works_rate_pct <= 100);

comment on column public.expenses.capital_works_start_date is
  'Date the capital works were completed; starts the 40-year Div 43 clock. Null means not yet determined.';
comment on column public.expenses.capital_works_rate_pct is
  'Annual Div 43 rate. Defaults to the standard residential 2.5%; overridable where a QS determines otherwise.';

-- ------------------------------------------------------------
-- Backfill the start date for expenses that are already capital works.
--
-- The effective classification is the per-expense manual override when set,
-- otherwise the renovation's. Note the two enums use different vocabularies —
-- 'capital_improvement' on renovations is 'Capital Works' on expenses. This
-- mirrors resolveTaxClassification in lib/tax/classification.ts; keep the two
-- in step.
--
-- Prefer the renovation's end date, since Div 43 runs from completion rather
-- than from when an invoice was paid. Fall back to the expense date where the
-- renovation has no end date recorded.
-- ------------------------------------------------------------
update public.expenses e
set capital_works_start_date = coalesce(r.end_date, e.expense_date)
from public.renovations r
where r.id = e.renovation_id
  and e.capital_works_start_date is null
  and (
    e.manual_classification = 'Capital Works'
    or (e.manual_classification is null and r.classification = 'capital_improvement')
  );

create index if not exists expenses_capital_works_start_date_idx
  on public.expenses (capital_works_start_date)
  where capital_works_start_date is not null;
