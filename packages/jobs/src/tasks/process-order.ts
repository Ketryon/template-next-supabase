import { task } from "@trigger.dev/sdk";
import { markOrderProcessing } from "@ketryon/db/jobs";

import { withRunLog } from "../run-log";

export interface ProcessOrderPayload {
  orderId: string;
}

/**
 * Event-triggered task, fired from app code with `tasks.trigger()`.
 *
 * On idempotency: the SDK offers an `idempotencyKey` option, but it dedupes
 * *runs* with a TTL inside the vendor's infrastructure. That is the wrong tool
 * for "this order was handed to the payment provider exactly once, ever, and I
 * can prove it." Durable, auditable idempotency belongs in your database — here
 * the conditional update (`.eq("status", "pending")`) is what makes a second
 * delivery a no-op.
 *
 * Use the SDK's key for cheap deduplication of noisy triggers; use the database
 * for anything you would have to defend in an audit.
 */
export const processOrder = task({
  id: "process-order",
  maxDuration: 300,
  retry: {
    maxAttempts: 4,
    minTimeoutInMs: 2_000,
    maxTimeoutInMs: 30_000,
    factor: 2,
  },
  queue: {
    name: "order-processing",
    concurrencyLimit: 5,
  },
  run: async (payload: ProcessOrderPayload, { ctx }) =>
    withRunLog("process-order", ctx.run.id, async () => {
      await markOrderProcessing(payload.orderId);
      return { processed: 1 };
    }),
});

/**
 * Exported so callers get a checked payload from `tasks.trigger<ProcessOrderTask>`
 * without importing the task value — a type-only import is fully erased, so the
 * Trigger.dev runtime never reaches the Next.js bundle.
 */
export type ProcessOrderTask = typeof processOrder;
