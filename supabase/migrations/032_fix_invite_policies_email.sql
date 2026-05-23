-- Fix "permission denied for table users" by replacing the subquery on
-- auth.users with auth.jwt() ->> 'email', which reads the email from the
-- current session JWT without requiring SELECT on auth.users.

-- account_members: drop and recreate the email-based policies
drop policy if exists "account_members: grantee reads by email" on public.account_members;
drop policy if exists "account_members: grantee accepts" on public.account_members;

create policy "account_members: grantee reads by email" on public.account_members
  for select using (
    grantee_email = (auth.jwt() ->> 'email')
  );

create policy "account_members: grantee accepts" on public.account_members
  for update
  using (
    grantee_email = (auth.jwt() ->> 'email')
    and status = 'pending'
  )
  with check (
    grantee_user_id = auth.uid()
    and status = 'active'
  );

-- property_shares: drop and recreate the email-based policies
drop policy if exists "property_shares: grantee reads by email" on public.property_shares;
drop policy if exists "property_shares: grantee accepts" on public.property_shares;

create policy "property_shares: grantee reads by email" on public.property_shares
  for select using (
    grantee_email = (auth.jwt() ->> 'email')
  );

create policy "property_shares: grantee accepts" on public.property_shares
  for update
  using (
    grantee_email = (auth.jwt() ->> 'email')
    and status = 'pending'
  )
  with check (
    grantee_user_id = auth.uid()
    and status = 'active'
  );
