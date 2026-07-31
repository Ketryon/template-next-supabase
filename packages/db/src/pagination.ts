import { ValidationError } from "./errors";

/**
 * Keyset (cursor) pagination, not `.range()` / OFFSET.
 *
 * OFFSET n makes Postgres walk n rows to reach page n, and the usual companion
 * `count: "exact"` is a second scan on every request. Seeking on
 * (created_at, id) is an index range read: page 500 costs the same as page 1.
 *
 * The tuple matters — `created_at` alone is not unique, so rows sharing a
 * timestamp would be skipped or repeated across page boundaries. `id` breaks
 * the tie, and the index carries both.
 */

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export interface PageParams {
  cursor?: string | undefined;
  limit?: number | undefined;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export interface Keyset {
  createdAt: string;
  id: string;
}

/** Hard ceiling — never let `?limit=` decide how much of a table to read. */
export function clampLimit(limit?: number): number {
  if (!limit || !Number.isFinite(limit) || limit < 1) return DEFAULT_PAGE_SIZE;
  return Math.min(Math.floor(limit), MAX_PAGE_SIZE);
}

export function encodeCursor(key: Keyset): string {
  return Buffer.from(`${key.createdAt}|${key.id}`, "utf8").toString("base64url");
}

export function decodeCursor(cursor: string): Keyset {
  const [createdAt, id] = Buffer.from(cursor, "base64url")
    .toString("utf8")
    .split("|");

  if (!createdAt || !id) throw new ValidationError("Invalid cursor");
  return { createdAt, id };
}

/**
 * PostgREST filter for "strictly older than this cursor", descending.
 *
 * Expands to: created_at < ts OR (created_at = ts AND id < id)
 */
export function cursorFilter(cursor: string): string {
  const { createdAt, id } = decodeCursor(cursor);
  return `created_at.lt.${createdAt},and(created_at.eq.${createdAt},id.lt.${id})`;
}

/**
 * Turn `limit + 1` fetched rows into a page.
 *
 * The sentinel row answers "is there more?" without a count query.
 */
export function buildPage<TRow extends Keyset, TDto>(
  rows: TRow[],
  limit: number,
  map: (row: TRow) => TDto,
): Page<TDto> {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items.at(-1);

  return {
    items: items.map(map),
    nextCursor: hasMore && last ? encodeCursor(last) : null,
  };
}
