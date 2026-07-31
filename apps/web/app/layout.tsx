import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "template-next-supabase",
  description: "Next.js + Supabase + Trigger.dev template",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="bg-white text-neutral-900 antialiased">{children}</body>
    </html>
  );
}
