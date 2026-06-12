-- Service-role-only function to delete a user from auth.users.
-- Used by the account deletion API route instead of auth.admin.deleteUser(),
-- which fails on local Supabase (ES256 signing rejects GoTrue admin endpoint).
CREATE OR REPLACE FUNCTION public.delete_auth_user(user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM auth.users WHERE id = user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_auth_user(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_auth_user(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.delete_auth_user(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.delete_auth_user(uuid) TO service_role;
