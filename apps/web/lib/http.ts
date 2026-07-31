import { DbError } from "@ketryon/db";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

/**
 * One error mapper for every route handler, so handlers hold no try/catch
 * boilerplate and no route can return a Postgres error message by accident.
 */
export function errorResponse(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "Invalid input", issues: error.issues },
      { status: 400 },
    );
  }

  if (error instanceof DbError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  console.error(error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

export function handler<T extends unknown[]>(
  fn: (...args: T) => Promise<NextResponse>,
) {
  return async (...args: T): Promise<NextResponse> => {
    try {
      return await fn(...args);
    } catch (error) {
      return errorResponse(error);
    }
  };
}
