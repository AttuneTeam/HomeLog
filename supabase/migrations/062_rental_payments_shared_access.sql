-- ============================================================
-- Align rental_payments with the shared-access model
--
-- rental_payments was added in migration 044, after 030 introduced
-- has_property_read_access / has_property_write_access, and kept the older
-- owner-only policy. Every other property-scoped table was migrated.
--
-- The consequence was not merely a missing row. An accountant holding an
-- active property_shares viewer grant could read rental_periods but not
-- rental_payments, so resolveRentalIncome saw "no payments recorded", fell
-- back to the tenancy accrual, and reported the year's income as an ESTIMATE.
-- The owner and their accountant saw different gross rent for the same
-- property, and the accountant had no indication that actual figures existed.
--
-- A permissions gap must never silently change a reported figure.
-- ============================================================

drop policy if exists "rental_payments: via property owner" on public.rental_payments;

create policy "rental_payments: select" on public.rental_payments
  for select using (has_property_read_access(property_id));

create policy "rental_payments: write" on public.rental_payments
  for all using (has_property_write_access(property_id))
  with check (has_property_write_access(property_id));
