-- ============================================================
-- Update all property-scoped RLS policies to respect shared
-- access granted via account_members (co-owners) and
-- property_shares (read-only viewers).
--
-- Two helper functions encapsulate the access logic so each
-- per-table policy stays a single line. Both are SECURITY
-- DEFINER so they bypass RLS when querying the access tables,
-- avoiding circular policy evaluation.
-- ============================================================

-- ============================================================
-- Helper: read access (owner, co-owner, or property viewer)
-- ============================================================
create or replace function public.has_property_read_access(prop_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.properties p
    where p.id = prop_id
      and (
        p.user_id = auth.uid()
        or exists (
          select 1 from public.account_members am
          where am.owner_id = p.user_id
            and am.grantee_user_id = auth.uid()
            and am.status = 'active'
        )
        or exists (
          select 1 from public.property_shares ps
          where ps.property_id = p.id
            and ps.grantee_user_id = auth.uid()
            and ps.status = 'active'
        )
      )
  );
$$;

-- ============================================================
-- Helper: write access (owner or active co-owner only)
-- ============================================================
create or replace function public.has_property_write_access(prop_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.properties p
    where p.id = prop_id
      and (
        p.user_id = auth.uid()
        or exists (
          select 1 from public.account_members am
          where am.owner_id = p.user_id
            and am.grantee_user_id = auth.uid()
            and am.status = 'active'
            and am.role = 'co_owner'
        )
      )
  );
$$;

-- ============================================================
-- Helper: read access resolved via a renovation's property
-- ============================================================
create or replace function public.has_renovation_read_access(reno_id uuid)
returns boolean language sql security definer stable as $$
  select has_property_read_access(
    (select property_id from public.renovations where id = reno_id)
  );
$$;

-- ============================================================
-- Helper: write access resolved via a renovation's property
-- ============================================================
create or replace function public.has_renovation_write_access(reno_id uuid)
returns boolean language sql security definer stable as $$
  select has_property_write_access(
    (select property_id from public.renovations where id = reno_id)
  );
$$;

-- ============================================================
-- properties
-- SELECT: owner + co-owners + property viewers
-- INSERT: only self (new properties always belong to creator)
-- UPDATE: owner + co-owners
-- DELETE: owner only
-- ============================================================
drop policy "properties: own rows" on public.properties;

create policy "properties: select" on public.properties
  for select using (
    auth.uid() = user_id
    or exists (
      select 1 from public.account_members am
      where am.owner_id = user_id
        and am.grantee_user_id = auth.uid()
        and am.status = 'active'
    )
    or exists (
      select 1 from public.property_shares ps
      where ps.property_id = id
        and ps.grantee_user_id = auth.uid()
        and ps.status = 'active'
    )
  );

create policy "properties: insert" on public.properties
  for insert with check (auth.uid() = user_id);

create policy "properties: update" on public.properties
  for update using (
    auth.uid() = user_id
    or exists (
      select 1 from public.account_members am
      where am.owner_id = user_id
        and am.grantee_user_id = auth.uid()
        and am.status = 'active'
        and am.role = 'co_owner'
    )
  )
  with check (
    auth.uid() = user_id
    or exists (
      select 1 from public.account_members am
      where am.owner_id = user_id
        and am.grantee_user_id = auth.uid()
        and am.status = 'active'
        and am.role = 'co_owner'
    )
  );

create policy "properties: delete" on public.properties
  for delete using (auth.uid() = user_id);

-- ============================================================
-- renovations
-- ============================================================
drop policy "renovations: via property owner" on public.renovations;

create policy "renovations: select" on public.renovations
  for select using (has_property_read_access(property_id));

create policy "renovations: write" on public.renovations
  for all using (has_property_write_access(property_id))
  with check (has_property_write_access(property_id));

-- ============================================================
-- expenses
-- ============================================================
drop policy "expenses: via property owner" on public.expenses;

create policy "expenses: select" on public.expenses
  for select using (has_renovation_read_access(renovation_id));

create policy "expenses: write" on public.expenses
  for all using (has_renovation_write_access(renovation_id))
  with check (has_renovation_write_access(renovation_id));

-- ============================================================
-- property_files
-- ============================================================
drop policy "property_files: via property owner" on public.property_files;

create policy "property_files: select" on public.property_files
  for select using (has_property_read_access(property_id));

create policy "property_files: write" on public.property_files
  for all using (has_property_write_access(property_id))
  with check (has_property_write_access(property_id));

-- ============================================================
-- rental_periods
-- ============================================================
drop policy "rental_periods: via property owner" on public.rental_periods;

create policy "rental_periods: select" on public.rental_periods
  for select using (has_property_read_access(property_id));

create policy "rental_periods: write" on public.rental_periods
  for all using (has_property_write_access(property_id))
  with check (has_property_write_access(property_id));

-- ============================================================
-- rental_operating_expenses
-- ============================================================
drop policy "Users can manage own rental operating expenses"
  on public.rental_operating_expenses;

create policy "rental_operating_expenses: select" on public.rental_operating_expenses
  for select using (has_property_read_access(property_id));

create policy "rental_operating_expenses: write" on public.rental_operating_expenses
  for all using (has_property_write_access(property_id))
  with check (has_property_write_access(property_id));

-- ============================================================
-- loan_interest_rates
-- ============================================================
drop policy "Users can manage own loan interest rates"
  on public.loan_interest_rates;

create policy "loan_interest_rates: select" on public.loan_interest_rates
  for select using (has_property_read_access(property_id));

create policy "loan_interest_rates: write" on public.loan_interest_rates
  for all using (has_property_write_access(property_id))
  with check (has_property_write_access(property_id));

-- ============================================================
-- property_loans
-- ============================================================
drop policy "Users can manage own property loans" on public.property_loans;

create policy "property_loans: select" on public.property_loans
  for select using (has_property_read_access(property_id));

create policy "property_loans: write" on public.property_loans
  for all using (has_property_write_access(property_id))
  with check (has_property_write_access(property_id));

-- ============================================================
-- property_offset_accounts
-- ============================================================
drop policy "Users can manage own offset accounts" on public.property_offset_accounts;

create policy "property_offset_accounts: select" on public.property_offset_accounts
  for select using (has_property_read_access(property_id));

create policy "property_offset_accounts: write" on public.property_offset_accounts
  for all using (has_property_write_access(property_id))
  with check (has_property_write_access(property_id));

-- ============================================================
-- property_enrichment
-- ============================================================
drop policy "Users can manage own property enrichment" on public.property_enrichment;

create policy "property_enrichment: select" on public.property_enrichment
  for select using (has_property_read_access(property_id));

create policy "property_enrichment: write" on public.property_enrichment
  for all using (has_property_write_access(property_id))
  with check (has_property_write_access(property_id));

-- ============================================================
-- roi_calculator_inputs
-- ============================================================
drop policy "roi_calculator_inputs: own property" on public.roi_calculator_inputs;

create policy "roi_calculator_inputs: select" on public.roi_calculator_inputs
  for select using (has_property_read_access(property_id));

create policy "roi_calculator_inputs: write" on public.roi_calculator_inputs
  for all using (has_property_write_access(property_id))
  with check (has_property_write_access(property_id));

-- ============================================================
-- renovation_quotes
-- ============================================================
drop policy "Users manage own quotes" on public.renovation_quotes;

create policy "renovation_quotes: select" on public.renovation_quotes
  for select using (has_renovation_read_access(renovation_id));

create policy "renovation_quotes: write" on public.renovation_quotes
  for all using (has_renovation_write_access(renovation_id))
  with check (has_renovation_write_access(renovation_id));

-- ============================================================
-- quote_ai_classifications
-- Resolved through renovation_quotes → renovations → properties
-- ============================================================
drop policy "Users view own quote classifications" on public.quote_ai_classifications;

create policy "quote_ai_classifications: select" on public.quote_ai_classifications
  for select using (
    has_renovation_read_access(
      (select renovation_id from public.renovation_quotes where id = quote_id)
    )
  );

create policy "quote_ai_classifications: write" on public.quote_ai_classifications
  for all using (
    has_renovation_write_access(
      (select renovation_id from public.renovation_quotes where id = quote_id)
    )
  )
  with check (
    has_renovation_write_access(
      (select renovation_id from public.renovation_quotes where id = quote_id)
    )
  );
