# template-next-supabase

Next.js + Supabase + Trigger.dev, where **the data layer is the product**. Apps and jobs are consumers of it.

```
supabase/          migrations, seed, pgTAP RLS tests — Postgres owns the schema
packages/db/       @ketryon/db  — both Supabase clients, the DTOs, every query
packages/jobs/     @ketryon/jobs — Trigger.dev tasks
apps/web/          Next.js 16 — calls the DAL, owns no database code
```

## Getting started

```bash
pnpm install
cp .env.example .env
pnpm db:start          # local Supabase stack (needs Docker)
pnpm db:reset          # apply migrations + seed
pnpm db:types          # regenerate packages/db/src/types.gen.ts
pnpm dev
pnpm jobs:dev          # separate terminal, for Trigger.dev tasks
```

## The authorization model: hybrid

This is the one real fork on Supabase, and the template takes a position.

|  | Client | RLS |
|---|---|---|
| **Reads** | `userClient(session)` — carries the user's JWT | **applies** |
| **Writes** | `serviceClient()` | **bypassed** |
| **Admin** | `serviceClient()` after `requireAdmin(session)` | bypassed |

RLS is deny-by-default on every table, but it is **not** what protects your writes — the DAL is. What RLS protects is *the other door*: the Data API. If a table is ever exposed or an anon key leaks, deny-by-default is what stands between that and your rows.

Why not RLS for everything? Because complex authorization (multi-step workflows, impersonation, date-dependent state, conditional access) does not map cleanly onto SQL policies, and RLS is evaluated per row — an O(n) authorization check with a long fuse. Reads stay under RLS precisely because they *do* map cleanly, and because it means a DAL function that forgets its filter still returns nothing.

**To close the second door entirely:** set `schemas = []` in `supabase/config.toml` and drop the `grant select` lines from the migration. Then nothing is reachable except through the server DAL, and RLS becomes pure defence in depth.

## The rules

1. **`index.ts` exports no client.** Not `userClient`, not `serviceClient`. An app that needs a new query adds it to the DAL — where it lands in review, takes a `Session`, picks a client deliberately, and gets an index.
2. **Every DAL function takes a `Session`, never a `userId`.** An identity that arrives as an argument is one the caller chose.
3. **`getUser()`, never `getSession()`,** for anything security-relevant. Cookies are spoofable; only `getUser()` revalidates against the Auth server. Same lesson as rule 2.
4. **Middleware is for redirects and token refresh, not authorization.** Assume it can be bypassed (CVE-2025-29927). Deleting `middleware.ts` should log people out more often, not leak data.
5. **Every `auth.uid()` in a policy is wrapped as `(select auth.uid())`.** Bare, it re-evaluates once per row; wrapped, the planner hoists it into a single InitPlan. Reported >100x on large tables, and `supabase db lint` catches violations via the `auth_rls_initplan` advisor.
6. **Index every column used by a policy, WHERE, JOIN or ORDER BY.** Postgres does not auto-index foreign keys.
7. **Explicit `GRANT`s.** From 30 Oct 2026 tables in `public` are no longer auto-exposed to the Data API. Being explicit now makes that a no-op.
8. **Keyset pagination, hard-capped.** No `OFFSET`, no `count: "exact"` per request.
9. **Every job persists its run outcome to `job_run`.** A vendor dashboard retains 7–30 days; that is an operational surface, not an audit log.
10. **Named queues with `concurrencyLimit` on every task.** Without one, a scheduled task whose runtime exceeds its interval overlaps with itself.

## Where things go

| Layer | Contains | Never contains |
|---|---|---|
| `app/**/page.tsx` | calls the DAL directly | `fetch()` of its own API |
| `app/**/actions.ts` | thin `"use server"` wrappers | data-access code |
| `app/api/**/route.ts` | session → validate → DAL → return | queries, ownership checks |
| `lib/session.ts` | resolve a trusted `Session` | authorization decisions |
| `packages/db/dal/**` | queries **and** authorization | HTTP concerns |
| `packages/db/jobs.ts` | service-role helpers for jobs | anything an app imports |
| `middleware.ts` | redirects, token refresh | authentication |

`@ketryon/db/jobs` is the privileged subpath — background jobs have no session at 03:00, so they legitimately need the service role. Rather than exporting `serviceClient` and hoping, that capability sits behind a separate entry point that only the jobs package consumes, and the app's ESLint config bans the import outright.

## What Postgres took over from the Mongo template

| MongoDB version | Here |
|---|---|
| zod as the only source of truth | Postgres owns the schema; `pnpm db:types` generates the types |
| `indexes.ts` + `syncIndexes()` | migrations |
| hand-rolled migration runner | Supabase CLI |
| an IXSCAN regression test | `supabase db lint` advisors + `pg_stat_statements` |
| constraints enforced only by zod | CHECK / FK / UNIQUE / enums in the database |
| `mongodb-memory-server` | `supabase start` — the real stack, seeded |

Zod survives, demoted: boundary validation for untrusted input, not the schema of record. Its bounds deliberately mirror the CHECK constraints, so bad input gets a 400 before the round trip and Postgres refuses it regardless.

Also gone: all connection-pool management. `supabase-js` speaks HTTP to PostgREST, so there is no pool, no idle timeout, and nothing to leak on suspend. That returns the moment you swap in a direct Postgres connection — which also costs you RLS, since a direct connection authenticates as `postgres` and bypasses it.

## Commands

| Command | Description |
|---|---|
| `pnpm dev` | run the web app |
| `pnpm jobs:dev` | run Trigger.dev tasks locally |
| `pnpm typecheck` | tsc across the workspace |
| `pnpm db:start` / `db:stop` | local Supabase stack |
| `pnpm db:reset` | re-apply migrations and seed |
| `pnpm db:types` | regenerate `types.gen.ts` — run after every migration |
| `pnpm db:lint` | Supabase advisors (RLS init-plan, missing indexes, unsafe definers) |
| `pnpm db:test` | pgTAP tests for the RLS policies |

## Deployment notes

- Pin the Vercel function region to the Supabase region. Cross-region turns every query into 70–100ms and Server Components make several per render.
- `SUPABASE_SERVICE_ROLE_KEY` is server-only. Never `NEXT_PUBLIC_`, never reachable from a Client Component. The build asserts it does not appear in `.next/static`.
- Run `pnpm db:lint` in CI. The `auth_rls_initplan` and unindexed-FK advisors catch the two most expensive RLS mistakes before they reach production.
- If you add a direct Postgres connection later, use the transaction-mode pooler (port 6543) for serverless and the direct URL (5432) for migrations. Transaction mode silently disables prepared statements and `LISTEN/NOTIFY`.

## Verified

`pnpm install`, `pnpm typecheck` (3 packages), `pnpm --filter web build` and `pnpm lint` all pass on Node 20.19+ with Next 16.2.12, supabase-js 2.111, @supabase/ssr 0.12, Trigger.dev SDK 4.5, Zod 4.4.

Build-boundary assertions checked against the emitted bundle: task definitions do not reach the Next.js build, and `SUPABASE_SERVICE_ROLE_KEY` does not appear in any client chunk.

**Not yet executed:** the SQL. `supabase/migrations/*`, `seed.sql` and the pgTAP tests have not been applied — this machine has no Docker and no Postgres server binary. Run `pnpm db:start && pnpm db:reset && pnpm db:test && pnpm db:lint` before trusting them.
