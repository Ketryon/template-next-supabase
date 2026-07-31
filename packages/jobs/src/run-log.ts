import { logger } from "@trigger.dev/sdk";
import { finishJobRun, startJobRun } from "@ketryon/db/jobs";

/**
 * Persist every run's outcome to your own database.
 *
 * A job dashboard is an operational surface, not an audit log — hosted run
 * history expires (7 days on the cheaper tiers, 30 on Pro). For anything that
 * moves money or mutates financial state, the domain effects are durable but
 * the *execution narrative* is not: which run touched which rows, what the
 * counts were, which attempt finally succeeded.
 *
 * Six months later, "which run produced these 33 corrections and when" is a
 * question you cannot answer from a dashboard that only remembers 30 days.
 * `job_run` is ~1 row per run — a rounding error next to any real table.
 *
 * `runId` links the durable record back to the live dashboard, so you keep the
 * good part of the vendor UI without depending on it for history.
 *
 * Bookkeeping failures are logged, never thrown: the run record must not be
 * able to fail the run.
 */
export async function withRunLog<T extends Record<string, number>>(
  taskId: string,
  runId: string | undefined,
  run: () => Promise<T>,
): Promise<T> {
  const handle = await startJobRun(taskId, runId);

  try {
    const counts = await run();
    await finishJobRun(handle, "success", counts);
    logger.info(`${taskId} finished`, counts);
    return counts;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await finishJobRun(handle, "failure", {}, message);
    logger.error(`${taskId} failed`, { error: message });
    throw error;
  }
}
