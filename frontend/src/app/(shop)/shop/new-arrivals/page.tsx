import type { Metadata } from "next";
import { headers } from "next/headers";
import { CollectionPage } from "@/components/shop/collection-page";
import { getStoreProducts, recentProducts } from "@/lib/catalog/storefront";
import { storeHostFrom } from "@/lib/store-api";

// The same rule as the home page section: added in the last 7 days, else the latest
const DAYS = 7;
const LATEST = 24;

export const metadata: Metadata = {
  alternates: { canonical: "/shop/new-arrivals" },
  title: "New arrivals",
  description: "The latest products added to the shop.",
};

export default async function NewArrivalsPage() {
  const all = await getStoreProducts(storeHostFrom(await headers()));
  const products = recentProducts(all, DAYS, LATEST);

  return (
    <CollectionPage
      title="New arrivals"
      description="The latest additions to the shop."
      products={products}
      empty={{ title: "No products yet", text: "New products show up here as soon as they are added to the shop." }}
    />
  );
}
