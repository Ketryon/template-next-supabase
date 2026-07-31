import { defineConfig } from "@trigger.dev/sdk";
import { syncVercelEnvVars } from "@trigger.dev/build/extensions/core";

export default defineConfig({
  project: process.env.TRIGGER_PROJECT_REF ?? "proj_replace_me",
  runtime: "node",
  logLevel: "log",
  maxDuration: 300,
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1_000,
      maxTimeoutInMs: 10_000,
      factor: 2,
    },
  },
  dirs: ["./src/tasks"],
  build: {
    // Tasks read the same env as the app (Supabase URL, service role key).
    extensions: [syncVercelEnvVars()],
  },
});
