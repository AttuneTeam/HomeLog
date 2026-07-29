-- ============================================================
-- rental_payments: the managing agent's statement, and the fees it charged
--
-- rental_payments was the only financial-evidence table in the app with
-- nowhere to store the document behind its figure. expenses.invoice_path,
-- rental_operating_expenses.invoice_path, loan_statements.storage_path and
-- depreciation_reports.storage_path all exist; migration 044 had no
-- equivalent. Rent was therefore the one figure reaching the tax pack with no
-- evidence attached.
--
-- The larger defect was the agent-fee deduction. It was computed as
-- weeks * weekly_rent * management_fee_pct (rental_periods), which can only
-- ever reproduce a recurring percentage charge. On a real statement
-- (Rich & Oliva OWN10905, Nov 2025) that recovered the $242 management fee
-- exactly and missed a $1,210 letting fee, a $33 lease fee and $8.80 of bank
-- charges -- $1,251.80 of genuine deductions -- while being presented with no
-- indication that it was an estimate at all.
--
-- EXTENDED, NOT REPLACED. A rental_statements table would have been the
-- tidier shape, but rows already exist in production and one statement maps to
-- one payment row in practice. Every column here is nullable so existing rows
-- stay valid; there is no data migration.
--
-- INVARIANT -- `amount` IS GROSS RENT. It is the assessable figure and the
-- agent's outgoings do not reduce it. A row holding the amount that reached
-- the bank instead would understate assessable income. net_received below is
-- where that figure belongs.
--
-- INVARIANT -- other_outgoings IS NEVER A DEDUCTION. Costs the agent paid to
-- a third party (the $2,146 of blinds on the statement above) are recorded
-- here for one purpose only: so the statement reconciles to the bank. They
-- deduct via their own invoice on the renovation/expense path, which is the
-- only path that classifies them correctly -- blinds are a Division 40
-- depreciating asset, not an immediate deduction. Adding a deduction path
-- from this column would double-count every such cost.
--
-- FILE-BEARING TABLE: statement_path points into the `property-files` bucket.
-- Per docs/account-deletion.md this column MUST be enumerated in both
-- user_storage_objects() and property_storage_objects(), or deletion leaks
-- storage. Migration 064 redefines both to include it.
-- ============================================================

alter table public.rental_payments
  -- The statement itself, retained as evidence and shipped in the tax pack.
  add column statement_path   text,

  -- Fees itemised rather than lumped into one total. The management fee is a
  -- percentage of rent and the letting and lease fees are one-off, so keeping
  -- them apart is what lets a recorded management fee be compared against the
  -- management_fee_pct estimate specifically rather than against a total that
  -- legitimately exceeds it.
  add column management_fees  numeric(10,2) check (management_fees  >= 0),
  add column letting_fees     numeric(10,2) check (letting_fees     >= 0),
  add column lease_fees       numeric(10,2) check (lease_fees       >= 0),

  -- Bank and administrative charges. Feeds the ATO's "Sundry rental expenses"
  -- line, not "Property agent fees and commission" -- they are not commission,
  -- and keeping them out of that line preserves the comparison above.
  add column sundry_fees      numeric(10,2) check (sundry_fees      >= 0),

  -- Reconciliation only. See the invariant above.
  add column other_outgoings  numeric(10,2) check (other_outgoings  >= 0),

  -- What the agent actually disbursed, for the reconciliation
  -- amount - fees - other_outgoings = net_received.
  add column net_received     numeric(10,2) check (net_received     >= 0),

  -- Raw AI extraction plus its confidence, kept so a confirmed figure can
  -- always be compared against what the model actually read.
  add column extracted        jsonb,
  add column confidence       numeric check (confidence >= 0 and confidence <= 1),

  -- Set when a human accepts the extracted fees. Until then they are a
  -- model's proposal and are NOT claimable -- the same staged-review gate
  -- loan_statements.confirmed_at applies to interest. Fees typed by hand are
  -- confirmed on save, because a human entered them.
  add column fees_confirmed_at timestamptz;

-- Resolving a financial year's fees reads the confirmed rows for a property.
-- Partial, because the rows that matter are the minority: most payments are
-- ingested from an agent email with no statement attached.
create index rental_payments_fees_confirmed_idx
  on public.rental_payments (property_id, payment_date)
  where fees_confirmed_at is not null;
