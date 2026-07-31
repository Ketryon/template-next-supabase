/**
 * Types only — this module emits no JavaScript.
 *
 * The app triggers tasks by id via `tasks.trigger()` rather than importing the
 * task object, so the Trigger.dev runtime never gets bundled into the Next.js
 * build. Passing the task *type* as a generic keeps the payload checked.
 */
export type {
  ProcessOrderPayload,
  ProcessOrderTask,
} from "./tasks/process-order";
