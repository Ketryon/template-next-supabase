import { createOrder, listOrders, orderInput } from "@ketryon/db";
import { NextResponse, type NextRequest } from "next/server";

import { handler } from "@/lib/http";
import { requireSession } from "@/lib/session";

/**
 * Route handlers stay boring: resolve the session, validate, call the DAL,
 * return. No queries, no ownership checks, no business logic.
 */

export const GET = handler(async (request: NextRequest) => {
  const session = await requireSession();
  const params = request.nextUrl.searchParams;

  const page = await listOrders(session, {
    cursor: params.get("cursor") ?? undefined,
    limit: Number(params.get("limit")) || undefined,
  });

  return NextResponse.json(page);
});

export const POST = handler(async (request: NextRequest) => {
  const session = await requireSession();
  const input = orderInput.parse(await request.json());
  const order = await createOrder(session, input);

  return NextResponse.json(order, { status: 201 });
});
