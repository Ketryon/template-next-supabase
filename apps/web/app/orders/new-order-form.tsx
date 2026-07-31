"use client";

import { useState, useTransition } from "react";

import { createOrderAction } from "./actions";

/**
 * Minimal client component so the Server Action path is actually exercised.
 *
 * Worth knowing: Next.js eliminates Server Actions that nothing references, so
 * an unused `"use server"` export may not appear in the build. Do not read that
 * as a safety guarantee — the moment anything imports the module, every export
 * in it becomes a callable POST endpoint. That is exactly why the DAL is
 * `server-only` and the actions live here instead.
 */
export function NewOrderForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="mt-6 flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);

        startTransition(async () => {
          setError(null);
          try {
            await createOrderAction({
              company: String(data.get("company") ?? ""),
              email: String(data.get("email") ?? ""),
              items: [{ sku: "A-1", qty: 1, unitPriceCents: 1500 }],
            });
            form.reset();
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Something went wrong");
          }
        });
      }}
    >
      <input
        name="company"
        placeholder="Company"
        required
        className="rounded border border-neutral-300 px-3 py-2 text-base"
      />
      <input
        name="email"
        type="email"
        placeholder="Email"
        required
        className="rounded border border-neutral-300 px-3 py-2 text-base"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-neutral-900 px-3 py-2 text-sm text-white disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create order"}
      </button>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
