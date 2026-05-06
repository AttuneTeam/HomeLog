-- ============================================================
-- Profiles must exist before inserts into properties (FK).
-- Rows are normally created by handle_new_user on auth.users insert.
-- Backfill any auth users missing a profile (e.g. signed up before
-- migrations/trigger existed, or rare trigger failures).
-- ============================================================

insert into public.profiles (id, display_name)
select
  u.id,
  u.raw_user_meta_data ->> 'display_name'
from auth.users u
on conflict (id) do nothing;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name')
  on conflict (id) do nothing;
  return new;
end;
$$;
