import { listOrders } from "@ketryon/db";
import Link from "next/link";

import { getSession } from "@/lib/session";
import { NewOrderForm } from "./new-order-form";

/**
 * A Server Component calls the DAL directly.
 *
 * It does NOT fetch its own `/api/orders` — that adds a network hop and drops
 * the request's auth context. The route handler exists for external callers;
 * the page shares the layer beneath it.
 */
export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const session = await getSession();

  if (!session) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <p className="text-sm text-neutral-600">
          Not signed in. Wire up Supabase Auth, then revisit this page.
        </p>
      </main>
    );
  }

  const { cursor } = await searchParams;
  const page = await listOrders(session, { cursor });

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-xl font-semibold">Orders</h1>

      <NewOrderForm />

      {page.items.length === 0 ? (
        <p className="mt-6 text-sm text-neutral-600">No orders yet.</p>
      ) : (
        <ul className="mt-6 divide-y divide-neutral-200">
          {page.items.map((order) => (
            <li key={order.id} className="flex justify-between py-3 text-sm">
              <span>{order.company}</span>
              <span className="text-neutral-500">
                {order.status} · {(order.totalCents / 100).toFixed(2)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {page.nextCursor && (
        <Link
          href={`/orders?cursor=${page.nextCursor}`}
          className="mt-6 inline-block text-sm underline"
        >
          Next page
        </Link>
      )}
    </main>
  );
}
