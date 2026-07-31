import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-xl font-semibold">template-next-supabase</h1>
      <p className="mt-2 text-sm text-neutral-600">
        The data layer lives in <code>packages/db</code>, the jobs in{" "}
        <code>packages/jobs</code>. This app only calls them.
      </p>
      <Link href="/orders" className="mt-6 inline-block text-sm underline">
        Orders →
      </Link>
    </main>
  );
}
