import { z } from "zod";
import type { Tables } from "../types.gen";

/**
 * Zod is demoted here compared with the MongoDB template.
 *
 * There, zod WAS the schema — nothing else enforced shape. Here Postgres owns
 * the schema, the constraints and the enums, and `types.gen.ts` derives the
 * types from the real database. Zod's remaining job is validating untrusted
 * input at the HTTP boundary, which types alone cannot do.
 *
 * The bounds below deliberately mirror the CHECK constraints in the migration:
 * zod rejects with a 400 before the round trip, Postgres refuses regardless.
 */

export const orderItem = z.object({
  sku: z.string().min(1).max(64),
  qty: z.number().int().positive().max(9999),
  unitPriceCents: z.number().int().nonnegative(),
});
export type OrderItem = z.infer<typeof orderItem>;

export const orderInput = z.object({
  company: z.string().min(1).max(200),
  email: z.email(),
  items: z.array(orderItem).min(1).max(100),
  note: z.string().max(2000).optional(),
});
export type OrderInput = z.infer<typeof orderInput>;

export const orderStatus = z.enum(["pending", "processing", "done", "cancelled"]);
export type OrderStatus = z.infer<typeof orderStatus>;

export type OrderRow = Tables<"orders">;

/**
 * Explicit whitelist. Adding a column to `orders` must not silently start
 * shipping it to the browser — the DTO is opt-in, not opt-out.
 */
export function toOrderDTO(row: OrderRow) {
  return {
    id: row.id,
    company: row.company,
    email: row.email,
    items: orderItem.array().catch([]).parse(row.items),
    note: row.note,
    status: row.status,
    totalCents: row.total_cents,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
export type OrderDTO = ReturnType<typeof toOrderDTO>;

export function orderTotalCents(items: OrderItem[]): number {
  return items.reduce((sum, i) => sum + i.qty * i.unitPriceCents, 0);
}
