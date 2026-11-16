import type { Metadata } from "next";
import { headers } from "next/headers";
import { CollectionPage } from "@/components/shop/collection-page";
import { bestSellingProducts, getStoreProducts } from "@/lib/catalog/storefront";
import { storeHostFrom } from "@/lib/store-api";

const TOP = 120;

export const metadata: Metadata = {
  alternates: { canonical: "/shop/best-sellers" },
  title: "Best sellers",
  description: "The products customers buy most.",
};

// Top selling, most sold first; the same rule as the home page section
export default async function BestSellersPage() {
  const all = await getStoreProducts(storeHostFrom(await headers()));

  return (
    <CollectionPage
      title="Best sellers"
      description="What customers buy most."
      products={bestSellingProducts(all, TOP)}
      empty={{ title: "No best sellers yet", text: "The most sold products show up here once orders come in." }}
    />
  );
}
