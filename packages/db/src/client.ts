import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types.gen";
import type { Session } from "./session";

/**
 * Two clients, two trust levels. Neither is exported from `index.ts`.
 *
 * Note what is absent compared with the MongoDB equivalent: no pool, no pool
 * sizing, no idle timeout, no cleanup on suspend. supabase-js speaks HTTP to
 * PostgREST, so a client is a config object — constructing one per request is
 * free and there are no sockets to leak. The entire class of serverless
 * connection problems does not exist on this path.
 *
 * It comes straight back if you swap in a direct Postgres connection: then you
 * are on Supavisor transaction mode, with pooling caveats AND you lose RLS,
 * because a direct connection authenticates as `postgres` and bypasses it.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
if (!anonKey) throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is not set");

export type Db = SupabaseClient<Database>;

const noPersist = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
} as const;

/**
 * Acts AS the user: requests carry their access token, so RLS applies.
 *
 * Used for reads. If a DAL function ever forgets its ownership filter, the
 * policies still refuse the rows — that is the whole point of keeping RLS on.
 */
export function userClient(session: Session): Db {
  return createClient<Database>(url!, anonKey!, {
    ...noPersist,
    global: { headers: { Authorization: `Bearer ${session.accessToken}` } },
  });
}

/**
 * Bypasses RLS completely.
 *
 * Used for mutations, because complex write rules (multi-step workflows,
 * conditional access, impersonation, date-dependent state) do not map cleanly
 * onto SQL policies. The trade is explicit: every function that reaches for this
 * MUST perform its own authorisation check first, and the check must not depend
 * on anything the caller supplied.
 */
export function serviceClient(): Db {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");

  return createClient<Database>(url!, serviceKey, noPersist);
}
