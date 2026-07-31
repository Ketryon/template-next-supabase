-- ─────────────────────────────────────────────────────────────────────────────
-- Initial schema.
--
-- Postgres owns the schema, the constraints and the indexes. Zod is demoted to
-- boundary validation; it is no longer the source of truth the way it was with
-- a schemaless database.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Helpers ──────────────────────────────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── Tables ───────────────────────────────────────────────────────────────────

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  full_name   text,
  role        text not null default 'user' check (role in ('user', 'admin')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create type public.order_status as enum ('pending', 'processing', 'done', 'cancelled');

create table public.orders (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  company      text not null check (char_length(company) between 1 and 200),
  email        text not null,
  -- Bounded on purpose: an unbounded array is a bloated row waiting to happen.
  items        jsonb not null check (jsonb_array_length(items) between 1 and 100),
  note         text check (note is null or char_length(note) <= 2000),
  status       public.order_status not null default 'pending',
  total_cents  integer not null default 0 check (total_cents >= 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- Execution record for background jobs. Written by the jobs package with the
-- service role so that the run history lives in YOUR database rather than only
-- in a vendor dashboard with a 7–30 day retention window.
create table public.job_run (
  id           uuid primary key default gen_random_uuid(),
  task_id      text not null,
  run_id       text,
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  outcome      text not null default 'running'
                 check (outcome in ('running', 'success', 'failure')),
  counts       jsonb not null default '{}'::jsonb,
  error        text
);

-- ── Indexes ──────────────────────────────────────────────────────────────────
--
-- Postgres does NOT auto-index foreign keys — the usual surprise. Every column
-- referenced by an RLS policy, a WHERE, a JOIN or an ORDER BY needs one.
--
-- The (created_at desc, id desc) tail matches the keyset pagination in the DAL,
-- so the sort is served by the index rather than an in-memory sort.

create index profiles_role_idx
  on public.profiles (role);

create index orders_user_id_created_at_id_idx
  on public.orders (user_id, created_at desc, id desc);

create index orders_status_created_at_id_idx
  on public.orders (status, created_at desc, id desc);

create index job_run_task_id_started_at_idx
  on public.job_run (task_id, started_at desc);

-- ── Row Level Security ───────────────────────────────────────────────────────
--
-- RLS here is DEFENCE IN DEPTH, not the authorisation mechanism.
--
-- All mutations go through the server DAL using the service role, which bypasses
-- RLS. So these policies are not what protects your writes — the DAL is. What
-- they protect is the OTHER door: the Data API. If a table is ever exposed, or
-- an anon key leaks, deny-by-default is what stands between that and your rows.
--
-- Every policy wraps auth.uid() as (select auth.uid()). Bare auth.uid() inside
-- USING(...) is re-evaluated once PER ROW; the subquery form lets the planner
-- hoist it into an InitPlan that runs once per query. Reported >100x on large
-- tables, and Supabase's own `auth_rls_initplan` advisor lints for it.

alter table public.profiles enable row level security;
alter table public.orders   enable row level security;
alter table public.job_run  enable row level security;

create policy profiles_select_own
  on public.profiles
  for select
  to authenticated
  using (id = (select auth.uid()));

create policy orders_select_own
  on public.orders
  for select
  to authenticated
  using (user_id = (select auth.uid()));

-- No INSERT/UPDATE/DELETE policies anywhere, and none at all on job_run.
-- RLS enabled with no matching policy = deny. Writes are the DAL's job.

-- ── Grants ───────────────────────────────────────────────────────────────────
--
-- From 30 Oct 2026 tables in `public` are no longer auto-exposed to the Data and
-- GraphQL APIs; access requires an explicit GRANT. Being explicit now means the
-- change is a no-op for this template rather than a breakage.
--
-- `anon` gets nothing: there is no publicly readable data.

revoke all on public.profiles from anon, authenticated;
revoke all on public.orders   from anon, authenticated;
revoke all on public.job_run  from anon, authenticated;

grant select on public.profiles to authenticated;
grant select on public.orders   to authenticated;

-- ── Auth wiring ──────────────────────────────────────────────────────────────

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
-- Empty search_path: a SECURITY DEFINER function without one is a privilege
-- escalation vector, and Supabase's security advisor flags it.
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
