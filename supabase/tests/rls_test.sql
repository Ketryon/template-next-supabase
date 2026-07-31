-- pgTAP tests for the RLS policies. Run with `pnpm db:test`.
--
-- RLS policies are code. Untested code that decides who can read what is not a
-- security control, it is a hope. These are the tests the Mongo template wrote
-- in Vitest — here they belong in the database, because that is where the rule
-- lives.

begin;
select plan(7);

-- ── Fixtures ─────────────────────────────────────────────────────────────────

insert into auth.users (id, email, instance_id, aud, role)
values
  ('11111111-1111-1111-1111-111111111111', 'alice@test.dev',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'mallory@test.dev',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

-- profiles rows are created by the on_auth_user_created trigger.

insert into public.orders (id, user_id, company, email, items, total_cents)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   '11111111-1111-1111-1111-111111111111',
   'Acme AB', 'orders@acme.test',
   '[{"sku":"A-1","qty":2,"unitPriceCents":1500}]'::jsonb, 3000),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   '22222222-2222-2222-2222-222222222222',
   'Mallory Ltd', 'orders@mallory.test',
   '[{"sku":"B-1","qty":1,"unitPriceCents":500}]'::jsonb, 500);

-- ── RLS is actually on ───────────────────────────────────────────────────────

select ok(
  (select relrowsecurity from pg_class where oid = 'public.orders'::regclass),
  'RLS is enabled on orders'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.job_run'::regclass),
  'RLS is enabled on job_run'
);

-- ── Reads are scoped to the acting user ──────────────────────────────────────

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select is(
  (select count(*) from public.orders)::int, 1,
  'alice sees only her own order'
);

select is(
  (select count(*) from public.orders
    where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')::int, 0,
  'alice cannot read mallory''s order'
);

-- ── Writes are denied to the authenticated role ──────────────────────────────
-- Deny-by-default: RLS is enabled and no INSERT/UPDATE policy exists.

select throws_ok(
  $$ update public.orders set status = 'done'
       where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' $$,
  '42501',
  null,
  'authenticated cannot UPDATE even its own order'
);

select throws_ok(
  $$ insert into public.orders (user_id, company, email, items)
     values ('11111111-1111-1111-1111-111111111111', 'X', 'x@test.dev',
             '[{"sku":"C","qty":1,"unitPriceCents":1}]'::jsonb) $$,
  '42501',
  null,
  'authenticated cannot INSERT orders directly'
);

-- ── The jobs table is invisible to end users entirely ────────────────────────

select throws_ok(
  $$ select count(*) from public.job_run $$,
  '42501',
  null,
  'authenticated has no grant on job_run'
);

select * from finish();
rollback;
