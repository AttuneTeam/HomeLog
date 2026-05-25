-- Grant service_role full access to all tables so the admin client
-- (used for invite lookups and other server-side operations) can query
-- without hitting PostgreSQL-level permission denied errors.
-- service_role already bypasses RLS; it just also needs table-level grants.

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

alter default privileges for role postgres in schema public
  grant all on tables to service_role;

alter default privileges for role postgres in schema public
  grant all on sequences to service_role;
