import "server-only";
import { createServerClient } from "@supabase/ssr";
import { UnauthorizedError, type Role, type Session } from "@ketryon/db";
import { cookies } from "next/headers";

/**
 * Resolve a trusted Session from the request cookies.
 *
 * This is the ONE place `@supabase/ssr` and `next/headers` appear. Keeping them
 * here is what lets @ketryon/db stay framework-agnostic.
 *
 * `getUser()` — never `getSession()`. getSession reads the cookie and trusts
 * it; cookies are client-controlled and spoofable. getUser revalidates the JWT
 * against the Auth server. It costs a network call, and it is not optional.
 */
export async function getSession(): Promise<Session | null> {
  const jar = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => jar.getAll(),
        setAll: (list) => {
          try {
            for (const { name, value, options } of list) {
              jar.set(name, value, options);
            }
          } catch {
            // Server Components cannot set cookies. Refresh happens in
            // middleware; ignoring here is the documented pattern.
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // The access token is read from the session only AFTER getUser() has proven
  // the user is real. The token is the credential; the user record is the proof.
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) return null;

  return {
    userId: user.id,
    role: (user.app_metadata?.role as Role) ?? "user",
    accessToken: session.access_token,
  };
}

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) throw new UnauthorizedError();
  return session;
}
