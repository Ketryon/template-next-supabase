/**
 * `@ketryon/db/jobs` — the privileged subpath.
 *
 * Background jobs have no session: nobody is logged in at 07:00 when the cron
 * fires. So they cannot use the session-first DAL, and they legitimately need
 * the service role.
 *
 * Rather than exporting `serviceClient` and hoping nobody imports it from a
 * page, that capability lives behind a separate entry point that only the jobs
 * package consumes. The rule stays intact: application code still cannot reach
 * a raw client.
 *
 * The ESLint config in apps/web bans this import path outright.
 */
import { serviceClient } from "./client";
import { fromPostgrest } from "./errors";
import { toOrderDTO, type OrderDTO } from "./schemas/order";

export async function claimStaleOrders(
  olderThan: Date,
  limit = 100,
): Promise<OrderDTO[]> {
  const { data, error } = await serviceClient()
    .from("orders")
    .update({ status: "cancelled" })
    .eq("status", "pending")
    .lt("created_at", olderThan.toISOString())
    .select("*")
    .limit(limit);

  if (error) throw fromPostgrest(error, "Orders");
  return (data ?? []).map(toOrderDTO);
}

export async function markOrderProcessing(orderId: string): Promise<void> {
  const { error } = await serviceClient()
    .from("orders")
    .update({ status: "processing" })
    .eq("id", orderId)
    .eq("status", "pending");

  if (error) throw fromPostgrest(error, "Order");
}

// ── Run history ──────────────────────────────────────────────────────────────

export interface JobRunHandle {
  id: string;
}

export async function startJobRun(
  taskId: string,
  runId?: string,
): Promise<JobRunHandle | null> {
  const { data, error } = await serviceClient()
    .from("job_run")
    .insert({ task_id: taskId, run_id: runId ?? null, outcome: "running" })
    .select("id")
    .single();

  // Never let bookkeeping failure take down the actual job.
  if (error) {
    console.error("[jobs] failed to open run record", error.message);
    return null;
  }
  return data;
}

export async function finishJobRun(
  handle: JobRunHandle | null,
  outcome: "success" | "failure",
  counts: Record<string, number> = {},
  error?: string,
): Promise<void> {
  if (!handle) return;

  const { error: writeError } = await serviceClient()
    .from("job_run")
    .update({
      finished_at: new Date().toISOString(),
      outcome,
      counts,
      error: error ?? null,
    })
    .eq("id", handle.id);

  if (writeError) console.error("[jobs] failed to close run record", writeError.message);
}
