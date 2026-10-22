import type { Metadata } from "next";
import { headers } from "next/headers";
import { BestSellers } from "@/components/home/best-sellers";
import { CategoryGrid } from "@/components/home/category-grid";
import { FlashSale } from "@/components/home/flash-sale";
import { HeroCarousel } from "@/components/home/hero-carousel";
import { LimitedOffers } from "@/components/home/limited-offers";
import { NewArrivals } from "@/components/home/new-arrivals";
import { PromoBanner } from "@/components/home/promo-banner";
import { TrustBadges } from "@/components/home/trust-badges";
import { getHeroSlides } from "@/lib/hero-slides";
import { storeHostFrom } from "@/lib/store-api";

export const metadata: Metadata = {
  title: "Home",
  description: "Modern clothing, from everyday staples to limited drops.",
};

// Rendered per request, never prerendered: the banners belong to whichever
// store's domain the visitor is on, so no single build-time page fits them all.
export default async function Home() {
  const slides = await getHeroSlides(storeHostFrom(await headers()));

  return (
    <main>
      {slides.length > 0 && <HeroCarousel slides={slides} />}
      <TrustBadges />
      <CategoryGrid />
      <NewArrivals />
      <BestSellers />
      <PromoBanner />
      <LimitedOffers />
      <FlashSale />
    </main>
  );
}
