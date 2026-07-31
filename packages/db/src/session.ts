/**
 * The contract between your auth layer and the data layer.
 *
 * `accessToken` is the verified JWT, used to build the RLS-scoped client. It
 * must come from `supabase.auth.getUser()`, never `getSession()`: getSession
 * reads cookies, which the client controls and can spoof, while getUser
 * revalidates against the Auth server.
 *
 * That is the same rule as "never take a userId as a function argument" from
 * the MongoDB template — trust the verified thing, not the thing handed to you.
 */
export type Role = "user" | "admin";

export interface Session {
  /** auth.users.id — a uuid. */
  userId: string;
  role: Role;
  /** Verified JWT. Scopes the RLS client; never logged, never sent to a client. */
  accessToken: string;
}
