import type { Metadata } from "next";
import { headers } from "next/headers";
import { CollectionPage } from "@/components/shop/collection-page";
import { getLimitedOffers } from "@/lib/catalog/featured";
import { storeHostFrom } from "@/lib/store-api";

export const metadata: Metadata = {
  alternates: { canonical: "/shop/limited-offers" },
  title: "Limited offers",
  description: "Picked by the shop, while stock lasts.",
};

// The seller's picks under Website Management → Limited Offer, in their order
export default async function LimitedOffersPage() {
  const products = await getLimitedOffers(storeHostFrom(await headers()));

  return (
    <CollectionPage
      title="Limited offers"
      description="Picked by the shop, while stock lasts."
      products={products}
      empty={{ title: "No limited offers right now", text: "When the shop picks products for an offer, they show up here." }}
    />
  );
}
