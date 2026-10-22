import type { Metadata } from "next";
import { headers } from "next/headers";
import { CountdownTimer } from "@/components/home/countdown-timer";
import { CollectionPage } from "@/components/shop/collection-page";
import { getFlashSale } from "@/lib/catalog/featured";
import { storeHostFrom } from "@/lib/store-api";

export const metadata: Metadata = {
  title: "Offers",
  description: "Products on sale right now.",
};

// The flash sale running now, set in the dashboard under Website Management → Flash Sale
export default async function OffersPage() {
  const sale = await getFlashSale(storeHostFrom(await headers()));

  return (
    <CollectionPage
      title={sale?.title ?? "Offers"}
      description={sale ? "Sale prices until the clock runs out." : "Products on sale right now."}
      action={sale ? <CountdownTimer endsAt={sale.endsAt} /> : undefined}
      products={sale?.products ?? []}
      empty={{ title: "No offers right now", text: "When the shop runs a sale, its products and prices show up here." }}
    />
  );
}
