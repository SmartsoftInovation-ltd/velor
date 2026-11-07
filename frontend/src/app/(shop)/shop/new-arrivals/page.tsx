import type { Metadata } from "next";
import { headers } from "next/headers";
import { CollectionPage } from "@/components/shop/collection-page";
import { getStoreProducts, recentProducts } from "@/lib/catalog/storefront";
import { storeHostFrom } from "@/lib/store-api";

// The same rule as the home page section: added in the last 7 days
const DAYS = 7;

export const metadata: Metadata = {
  alternates: { canonical: "/shop/new-arrivals" },
  title: "New arrivals",
  description: "Products added to the shop this week.",
};

export default async function NewArrivalsPage() {
  const all = await getStoreProducts(storeHostFrom(await headers()));
  const products = recentProducts(all, DAYS, all.length);

  return (
    <CollectionPage
      title="New arrivals"
      description="Added to the shop in the last 7 days."
      products={products}
      empty={{ title: "Nothing new this week", text: "New products show up here for their first 7 days in the shop." }}
    />
  );
}
