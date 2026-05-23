-- ============================================================
-- Allow active co-owners to read the account owner's
-- household_income_sources and tax_prepayments rows.
--
-- The existing "for all" policies already cover the owner via
-- user_id = auth.uid(). These additive SELECT policies OR in
-- the co-owner case without touching existing write rules.
-- ============================================================

create policy "household_income_sources: co-owner select"
  on public.household_income_sources
  for select
  using (
    exists (
      select 1 from public.account_members am
      where am.owner_id = household_income_sources.user_id
        and am.grantee_user_id = auth.uid()
        and am.status = 'active'
    )
  );

create policy "tax_prepayments: co-owner select"
  on public.tax_prepayments
  for select
  using (
    exists (
      select 1 from public.account_members am
      where am.owner_id = tax_prepayments.user_id
        and am.grantee_user_id = auth.uid()
        and am.status = 'active'
    )
  );
