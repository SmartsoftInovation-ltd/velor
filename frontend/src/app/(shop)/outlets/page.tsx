import type { Metadata } from "next";
import { headers } from "next/headers";
import { OutletCard } from "@/components/info/outlet-card";
import { Breadcrumb } from "@/components/shop/breadcrumb";
import { getOutlets } from "@/lib/outlets";
import { storeHostFrom } from "@/lib/store-api";

export const metadata: Metadata = {
  alternates: { canonical: "/outlets" },
  title: "Our outlets",
  description: "Visit our branches for in-store deals and services.",
};

// The outlets the seller saved under Settings → Outlet Information
export default async function OutletsPage() {
  const outlets = await getOutlets(storeHostFrom(await headers()));

  return (
    <main className="container py-6">
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Our Outlets" }]} />

      <header className="mx-auto mt-6 mb-10 max-w-xl space-y-3 text-center">
        <h1 className="text-h1 font-semibold tracking-tight text-text-primary">Our Outlets</h1>
        <p className="text-body text-text-secondary">
          Visit our branches across the city for exclusive in-store deals and services.
        </p>
      </header>

      {outlets.length ? (
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {outlets.map((outlet) => (
            <li key={outlet._id}>
              <OutletCard outlet={outlet} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-border-default py-16 text-center text-body text-text-secondary">
          No outlets to show yet.
        </p>
      )}
    </main>
  );
}
