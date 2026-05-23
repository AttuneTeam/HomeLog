-- ============================================================
-- Invite acceptance policies
--
-- Allows an authenticated user to read and accept invite
-- records where grantee_email matches their own auth email.
-- This removes the need for a service-role key in the invite
-- flow: any logged-in user can claim their own pending invite.
-- ============================================================

-- account_members: grantee can read any invite addressed to their email
create policy "account_members: grantee reads by email" on public.account_members
  for select using (
    grantee_email = (
      select email from auth.users where id = auth.uid()
    )
  );

-- account_members: grantee can accept (update) a pending invite for their email
create policy "account_members: grantee accepts" on public.account_members
  for update
  using (
    grantee_email = (select email from auth.users where id = auth.uid())
    and status = 'pending'
  )
  with check (
    grantee_user_id = auth.uid()
    and status = 'active'
  );

-- property_shares: grantee can read any share invite addressed to their email
create policy "property_shares: grantee reads by email" on public.property_shares
  for select using (
    grantee_email = (
      select email from auth.users where id = auth.uid()
    )
  );

-- property_shares: grantee can accept a pending share invite for their email
create policy "property_shares: grantee accepts" on public.property_shares
  for update
  using (
    grantee_email = (select email from auth.users where id = auth.uid())
    and status = 'pending'
  )
  with check (
    grantee_user_id = auth.uid()
    and status = 'active'
  );
