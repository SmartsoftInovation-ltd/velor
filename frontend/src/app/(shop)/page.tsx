import type { Metadata } from "next";
import { headers } from "next/headers";
import { BestSellers } from "@/components/home/best-sellers";
import { ChatWidget } from "@/components/home/chat-widget";
import { CategoryGrid } from "@/components/home/category-grid";
import { FlashSale } from "@/components/home/flash-sale";
import { HeroCarousel } from "@/components/home/hero-carousel";
import { LimitedOffers } from "@/components/home/limited-offers";
import { NewArrivals } from "@/components/home/new-arrivals";
import { PromoBanner } from "@/components/home/promo-banner";
import { TrustBadges } from "@/components/home/trust-badges";
import { getHeroSlides } from "@/lib/hero-slides";
import { JsonLd } from "@/components/ui/json-ld";
import { storeJsonLd } from "@/lib/seo";
import { getStore, requestOrigin, storeHostFrom } from "@/lib/store-api";

// The store's name and description come from the root layout
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

// Rendered per request, never prerendered: the banners belong to whichever
// store's domain the visitor is on, so no single build-time page fits them all.
export default async function Home() {
  const requestHeaders = await headers();
  const host = storeHostFrom(requestHeaders);
  const [slides, store] = await Promise.all([getHeroSlides(host), getStore(host)]);
  const name = store?.name || "Online shop";

  return (
    <main>
      <JsonLd data={storeJsonLd(name, requestOrigin(requestHeaders) ?? "", store?.logo)} />
      {/* The one h1: the slides are promotions, there may be several or none */}
      <h1 className="sr-only">{name}</h1>
      {slides.length > 0 && <HeroCarousel slides={slides} />}
      <TrustBadges />
      <CategoryGrid />
      <NewArrivals />
      <BestSellers />
      <PromoBanner />
      <LimitedOffers />
      <FlashSale />
      <ChatWidget />
    </main>
  );
}
