import { serviceClient, userClient } from "../client";
import { ForbiddenError, NotFoundError, fromPostgrest } from "../errors";
import {
  buildPage,
  clampLimit,
  cursorFilter,
  type Page,
  type PageParams,
} from "../pagination";
import {
  orderInput,
  orderTotalCents,
  toOrderDTO,
  type OrderDTO,
  type OrderInput,
} from "../schemas/order";
import type { Session } from "../session";

/**
 * The hybrid, made concrete.
 *
 *   READS  → userClient(session). RLS applies. If the filter below were ever
 *            dropped, the policies would still refuse the rows.
 *   WRITES → serviceClient(). RLS is bypassed, so every mutation performs its
 *            own authorisation check FIRST, against the session — never against
 *            a value the caller supplied.
 *
 * As in the MongoDB template, every function takes a `Session` and none takes a
 * `userId`. An identity that arrives as an argument is one the caller chose.
 */

export async function listOrders(
  session: Session,
  { cursor, limit }: PageParams = {},
): Promise<Page<OrderDTO>> {
  const take = clampLimit(limit);

  let query = userClient(session)
    .from("orders")
    .select("*")
    // Belt as well as braces: RLS would scope this anyway.
    .eq("user_id", session.userId);

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

export async function getOrder(
  session: Session,
  orderId: string,
): Promise<OrderDTO> {
  const { data, error } = await userClient(session)
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .eq("user_id", session.userId)
    .maybeSingle();

  if (error) throw fromPostgrest(error, "Order");
  if (!data) throw new NotFoundError("Order");

  return toOrderDTO(data);
}

export async function createOrder(
  session: Session,
  input: OrderInput,
): Promise<OrderDTO> {
  // Validated again here even though callers validate: the DAL is the last
  // line, and it is reachable from several entry points.
  const data = orderInput.parse(input);

  // user_id comes from the session, so there is no argument to tamper with.
  const { data: row, error } = await serviceClient()
    .from("orders")
    .insert({
      user_id: session.userId,
      company: data.company,
      email: data.email,
      items: data.items,
      note: data.note ?? null,
      total_cents: orderTotalCents(data.items),
    })
    .select("*")
    .single();

  if (error) throw fromPostgrest(error, "Order");
  return toOrderDTO(row);
}

export async function cancelOrder(
  session: Session,
  orderId: string,
): Promise<OrderDTO> {
  // Explicit authorisation, because the write below bypasses RLS. This throws
  // NotFoundError for someone else's order — it reads through the RLS client.
  const existing = await getOrder(session, orderId);

  if (existing.status === "done" || existing.status === "cancelled") {
    throw new ForbiddenError(`Cannot cancel an order that is ${existing.status}`);
  }

  const { data, error } = await serviceClient()
    .from("orders")
    .update({ status: "cancelled" })
    .eq("id", orderId)
    // Re-asserted at the write itself: defence against a future refactor that
    // drops the check above.
    .eq("user_id", session.userId)
    .select("*")
    .single();

  if (error) throw fromPostgrest(error, "Order");
  return toOrderDTO(data);
}
