-- ============================================================
-- Allow account members (grantees) to read the profile of the
-- account owner who shared with them. Without this, the existing
-- "profiles: own row" policy hides the owner's display_name, so
-- guests see "Unknown's account" in their sharing settings.
--
-- Additive SELECT policy: ORs in the grantee case without
-- touching the existing own-row rule. Covers pending invites too
-- so the inviter's name shows before the invite is accepted.
-- ============================================================

create policy "profiles: grantee can read owner profile"
  on public.profiles
  for select
  using (
    exists (
      select 1 from public.account_members am
      where am.owner_id = profiles.id
        and am.grantee_user_id = auth.uid()
        and am.status in ('active', 'pending')
    )
  );
