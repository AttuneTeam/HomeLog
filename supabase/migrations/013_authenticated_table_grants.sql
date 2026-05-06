-- ============================================================
-- Table privileges for Supabase API roles
--
-- RLS restricts rows; GRANT allows the role to issue statements at all.
-- Without grants, clients using the anon/authenticated JWT roles hit
-- "permission denied for table ...".
--
-- ALTER DEFAULT PRIVILEGES applies to tables/sequences created later by
-- the same role that runs migrations (typically postgres).
-- ============================================================

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;

grant usage, select on all sequences in schema public to authenticated, anon;

alter default privileges for role postgres in schema public
grant select, insert, update, delete on tables to authenticated;

alter default privileges for role postgres in schema public
grant select on tables to anon;

alter default privileges for role postgres in schema public
grant usage, select on sequences to authenticated, anon;
