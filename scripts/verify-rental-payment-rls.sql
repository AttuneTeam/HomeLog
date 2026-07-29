-- Migration 062's policies must cover the new columns from 063. RLS applies per
-- ROW, not per column, so this should hold — but "should" is not evidence, and
-- workflow.md requires proving a non-owner is DENIED, not only that the owner is
-- allowed.
--
-- Exercised as the `authenticated` role with a JWT claim, which is how PostgREST
-- reaches these policies. As superuser RLS is bypassed entirely and every check
-- below would pass vacuously.
\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email, instance_id, aud, role)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'owner@rls.test',
        '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
       ('bbbbbbbb-0000-0000-0000-000000000002', 'stranger@rls.test',
        '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

insert into public.properties (id, user_id, address, property_type)
values ('cccccccc-0000-0000-0000-000000000003',
        'aaaaaaaa-0000-0000-0000-000000000001', '56 Forbes St', 'investment');

insert into public.rental_payments
  (id, property_id, payment_date, amount, statement_path, management_fees,
   letting_fees, lease_fees, sundry_fees, other_outgoings, net_received,
   fees_confirmed_at)
values ('dddddddd-0000-0000-0000-000000000004',
        'cccccccc-0000-0000-0000-000000000003', '2025-11-28', 4400.00,
        'aaaaaaaa-0000-0000-0000-000000000001/statement.pdf',
        242.00, 1210.00, 33.00, 8.80, 2146.00, 760.20, now());

-- ── Non-owner (no share, no membership) ───────────────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}';

\echo ''
\echo '== STRANGER select -- expect 0 rows (DENIED) =='
select count(*) as visible_rows from public.rental_payments;

\echo ''
\echo '== STRANGER select of the new fee columns -- expect 0 rows (DENIED) =='
select count(*) as visible_fee_rows from public.rental_payments
where management_fees is not null or statement_path is not null;

\echo ''
\echo '== STRANGER update of fees -- expect 0 rows affected (DENIED) =='
update public.rental_payments set management_fees = 99999, fees_confirmed_at = now()
where id = 'dddddddd-0000-0000-0000-000000000004';

\echo ''
\echo '== STRANGER insert -- expect RLS violation =='
savepoint before_insert;
do $$
begin
  insert into public.rental_payments (property_id, payment_date, amount, statement_path)
  values ('cccccccc-0000-0000-0000-000000000003', '2026-01-01', 1100, 'x/y.pdf');
  raise notice 'FAIL: stranger insert SUCCEEDED — policy does not hold';
exception when insufficient_privilege or check_violation then
  raise notice 'PASS: stranger insert rejected (%)', sqlerrm;
end $$;
rollback to savepoint before_insert;

-- ── Owner ─────────────────────────────────────────────────────────────────
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';

\echo ''
\echo '== OWNER select -- expect 1 row with all fee columns readable =='
select amount, management_fees, letting_fees, lease_fees, sundry_fees,
       other_outgoings, net_received, statement_path is not null as has_statement,
       fees_confirmed_at is not null as confirmed
from public.rental_payments;

\echo ''
\echo '== OWNER update of a fee column -- expect 1 row affected =='
update public.rental_payments set management_fees = 242.00
where id = 'dddddddd-0000-0000-0000-000000000004';

\echo ''
\echo '== Reconciliation identity: amount - fees - other = net_received =='
select amount,
       coalesce(management_fees,0)+coalesce(letting_fees,0)
         +coalesce(lease_fees,0)+coalesce(sundry_fees,0) as total_fees,
       other_outgoings,
       net_received,
       amount - (coalesce(management_fees,0)+coalesce(letting_fees,0)
         +coalesce(lease_fees,0)+coalesce(sundry_fees,0)) - coalesce(other_outgoings,0)
         as computed_net,
       abs(amount - (coalesce(management_fees,0)+coalesce(letting_fees,0)
         +coalesce(lease_fees,0)+coalesce(sundry_fees,0)) - coalesce(other_outgoings,0)
         - net_received) <= 1.00 as ties
from public.rental_payments;

reset role;
rollback;
