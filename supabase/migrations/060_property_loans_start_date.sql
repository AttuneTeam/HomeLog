-- ============================================================
-- Loan start date
--
-- The interest estimate previously applied a full year of interest to the
-- recorded balance regardless of when the loan actually began. A loan drawn
-- down on 27 October leaves 247 days of a 1 July financial year, not 365, so
-- the estimate overstated interest by roughly a third in its first year.
--
-- Only the start is recorded: a loan that has been discharged stops appearing
-- in the balance, and modelling an end date would imply a repayment history
-- this table does not hold.
-- ============================================================

alter table public.property_loans
  add column if not exists start_date date;

comment on column public.property_loans.start_date is
  'Date the loan was drawn down. Interest is only estimated from this date onward within a financial year. Null means the loan is assumed to have run for the whole year.';
