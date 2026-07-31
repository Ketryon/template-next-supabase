"use server";

import { cancelOrder, createOrder, orderInput } from "@ketryon/db";
import type { ProcessOrderTask } from "@ketryon/jobs";
import { tasks } from "@trigger.dev/sdk";
import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/session";

/**
 * Server Actions live here — thin, beside the route, never on the data layer.
 *
 * Every export of a `"use server"` file is a public POST endpoint callable with
 * arbitrary arguments. Marking a DAL module `"use server"` would publish every
 * query function in it.
 *
 * Jobs are triggered by id rather than by importing the task object, so the
 * Trigger.dev runtime never enters the Next.js bundle. The payload type still
 * comes from @ketryon/jobs, so it stays checked.
 */

export async function createOrderAction(raw: unknown) {
  const session = await requireSession();
  const input = orderInput.parse(raw);
  const order = await createOrder(session, input);

  await tasks.trigger<ProcessOrderTask>("process-order", {
    orderId: order.id,
  });

  revalidatePath("/orders");
  return order;
}

export async function cancelOrderAction(orderId: string) {
  const session = await requireSession();
  const order = await cancelOrder(session, orderId);

  revalidatePath("/orders");
  return order;
}
