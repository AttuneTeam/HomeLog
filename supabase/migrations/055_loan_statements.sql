-- ============================================================
-- loan_statements: annual loan statements and the interest they evidence
--
-- Loan interest is usually the largest rental deduction, and the tax report
-- currently omits it entirely. An amount computed from property_loans and
-- loan_interest_rates is an estimate that will not tie to the bank, so the
-- claimable figure has to come from the lender's own statement.
--
-- Not keyed on property_loans: that table holds one row per property, but a
-- property can carry several loan accounts (splits, offsets, refinances), each
-- issuing its own statement. Rows are therefore per statement, identified by
-- account_ref, and summed per financial year.
--
-- Follows the staged-review pattern used by staged_receipts: extraction fills
-- `extracted` and `confidence`, and the figure is only trusted once a human
-- sets confirmed_at.
--
-- FILE-BEARING TABLE: storage_path points into the `property-files` bucket.
-- Per docs/account-deletion.md this column MUST be enumerated in both
-- user_storage_objects() and property_storage_objects(), or deletion leaks
-- storage. Both functions are redefined later in this phase to include it.
-- ============================================================

create table public.loan_statements (
  id                 uuid primary key default gen_random_uuid(),
  property_id        uuid not null references public.properties(id) on delete cascade,
  financial_year_end int  not null check (financial_year_end between 1990 and 2200),

  -- Null until the extraction has been reviewed and confirmed.
  interest_paid      numeric(12,2) check (interest_paid >= 0),
  lender             text,
  -- Distinguishes multiple loan accounts on the same property.
  account_ref        text,
  period_start       date,
  period_end         date,

  -- The statement itself, retained as evidence and shipped in the tax pack.
  storage_path       text,

  -- Raw AI extraction plus its confidence, kept so a confirmed figure can
  -- always be compared against what the model actually read.
  extracted          jsonb,
  confidence         numeric check (confidence >= 0 and confidence <= 1),
  -- Set when a human accepts the figure. Until then it is not claimable.
  confirmed_at       timestamptz,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  check (period_end is null or period_start is null or period_end >= period_start)
);

-- One statement per account per year. account_ref is nullable, so this is a
-- partial index: properties with a single unidentified loan are unconstrained.
create unique index loan_statements_account_year_unique
  on public.loan_statements (property_id, financial_year_end, account_ref)
  where account_ref is not null;

create index on public.loan_statements (property_id, financial_year_end);

alter table public.loan_statements enable row level security;

create policy "loan_statements: select" on public.loan_statements
  for select using (has_property_read_access(property_id));

create policy "loan_statements: write" on public.loan_statements
  for all using (has_property_write_access(property_id))
  with check (has_property_write_access(property_id));

create trigger trg_loan_statements_updated_at
  before update on public.loan_statements
  for each row execute function public.set_updated_at();

grant select, insert, update, delete on public.loan_statements to authenticated;
grant all on public.loan_statements to service_role;
