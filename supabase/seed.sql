-- Seed data for local development. Applied by `supabase db reset`.
--
-- The retrospective advice this template follows: do not mock supabase-js. Run
-- the real local stack with seeded data — mocks do not reproduce RLS, triggers,
-- constraints or planner behaviour, which is where the bugs actually are.

insert into auth.users (id, email, instance_id, aud, role, raw_user_meta_data)
values (
  '00000000-0000-4000-8000-000000000001',
  'dev@example.com',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  '{"full_name": "Dev User"}'::jsonb
)
on conflict (id) do nothing;

insert into public.orders (user_id, company, email, items, total_cents, status)
select
  '00000000-0000-4000-8000-000000000001',
  'Example AB ' || n,
  'orders@example.test',
  '[{"sku":"A-1","qty":2,"unitPriceCents":1500}]'::jsonb,
  3000,
  (array['pending', 'processing', 'done'])[1 + (n % 3)]::public.order_status
from generate_series(1, 25) as n;
