import type { PostgrestError } from "@supabase/supabase-js";
import type { Session } from "./session";

export class DbError extends Error {
  readonly status: number = 500;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundError extends DbError {
  override readonly status = 404;
  constructor(what = "Resource") {
    super(`${what} not found`);
  }
}

export class UnauthorizedError extends DbError {
  override readonly status = 401;
  constructor(message = "Not authenticated") {
    super(message);
  }
}

export class ForbiddenError extends DbError {
  override readonly status = 403;
  constructor(message = "Not allowed") {
    super(message);
  }
}

export class ValidationError extends DbError {
  override readonly status = 400;
  constructor(message = "Invalid input", readonly issues?: unknown) {
    super(message);
  }
}

/** Narrow a session to an admin, or throw. Used by every `dal/admin/*` fn. */
export function requireAdmin(session: Session): Session {
  if (session.role !== "admin") throw new ForbiddenError("Admin role required");
  return session;
}

/**
 * Turn a PostgREST result into data or a typed throw.
 *
 * Raw PostgrestError messages can name columns, constraints and policies, so
 * they are logged but never surfaced. Callers get a typed error instead.
 */
export function unwrap<T>(
  result: { data: T | null; error: PostgrestError | null },
  what = "Resource",
): T {
  if (result.error) throw fromPostgrest(result.error, what);
  if (result.data === null) throw new NotFoundError(what);
  return result.data;
}

export function fromPostgrest(error: PostgrestError, what = "Resource"): DbError {
  switch (error.code) {
    // No rows returned by .single()
    case "PGRST116":
      return new NotFoundError(what);
    // RLS denial and insufficient privilege both surface as 42501.
    case "42501":
      return new ForbiddenError();
    // unique_violation
    case "23505":
      return new ValidationError(`${what} already exists`);
    // foreign_key_violation
    case "23503":
      return new ValidationError(`${what} references something that does not exist`);
    // check_violation
    case "23514":
      return new ValidationError(`${what} failed a constraint`);
    default:
      console.error("[db]", error.code, error.message, error.details);
      return new DbError("Database error");
  }
}
