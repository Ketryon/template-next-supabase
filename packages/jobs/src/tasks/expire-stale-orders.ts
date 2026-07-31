import { schedules } from "@trigger.dev/sdk";
import { claimStaleOrders } from "@ketryon/db/jobs";

import { withRunLog } from "../run-log";

/**
 * Scheduled task: cancel orders left pending for 30 days.
 *
 * Note the `queue` block. Without it every task shares the default concurrency
 * pool, and a scheduled task whose runtime can exceed its interval will happily
 * overlap with itself — two runs claiming the same rows. `concurrencyLimit: 1`
 * on a named queue is the fix, and it doubles as rate-limit protection when the
 * task talks to a third-party API.
 *
 * This is the single cheapest reliability win available in a Trigger.dev
 * codebase, and it is the one most often missing.
 */
export const expireStaleOrders = schedules.task({
  id: "expire-stale-orders",
  cron: { pattern: "0 3 * * *", timezone: "Europe/Stockholm" },
  maxDuration: 600,
  queue: {
    name: "orders-maintenance",
    concurrencyLimit: 1,
  },
  run: async (_payload, { ctx }) =>
    withRunLog("expire-stale-orders", ctx.run.id, async () => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);

      const cancelled = await claimStaleOrders(cutoff);
      return { cancelled: cancelled.length };
    }),
});
