import { serviceClient } from "../../client";
import { fromPostgrest, requireAdmin } from "../../errors";
import {
  buildPage,
  clampLimit,
  cursorFilter,
  type Page,
  type PageParams,
} from "../../pagination";
import {
  orderStatus,
  toOrderDTO,
  type OrderDTO,
  type OrderStatus,
} from "../../schemas/order";
import type { Session } from "../../session";

/**
 * Admin needs cross-tenant access, which is precisely why it gets its own DAL
 * functions rather than a raw client.
 *
 * These use the service role, so `requireAdmin` is the ONLY thing standing
 * between a caller and every row in the table. It is the first statement in
 * every function here, and that is not stylistic.
 *
 * Note what this replaces: an "admin exception" inside an RLS policy (`or
 * auth.jwt() ->> 'email' like '%@company.com'`). Those are hard to audit and
 * they mask RLS performance problems. An explicit, checked, server-side path is
 * easier to reason about and easier to log.
 */

export async function listAllOrders(
  session: Session,
  { cursor, limit, status }: PageParams & { status?: OrderStatus } = {},
): Promise<Page<OrderDTO>> {
  requireAdmin(session);
  const take = clampLimit(limit);

  let query = serviceClient().from("orders").select("*");

  if (status) query = query.eq("status", orderStatus.parse(status));
  if (cursor) query = query.or(cursorFilter(cursor));

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(take + 1);

  if (error) throw fromPostgrest(error, "Orders");

  return buildPage(
    (data ?? []).map((row) => ({ ...row, createdAt: row.created_at })),
    take,
    toOrderDTO,
  );
}

export async function setOrderStatus(
  session: Session,
  orderId: string,
  status: OrderStatus,
): Promise<OrderDTO> {
  requireAdmin(session);

  const { data, error } = await serviceClient()
    .from("orders")
    .update({ status: orderStatus.parse(status) })
    .eq("id", orderId)
    .select("*")
    .single();

  if (error) throw fromPostgrest(error, "Order");
  return toOrderDTO(data);
}
