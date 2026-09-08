import type { Metadata } from "next";
import { BestSellers } from "@/components/home/best-sellers";
import { CategoryGrid } from "@/components/home/category-grid";
import { FlashSale } from "@/components/home/flash-sale";
import { HeroCarousel } from "@/components/home/hero-carousel";
import { LimitedOffers } from "@/components/home/limited-offers";
import { NewArrivals } from "@/components/home/new-arrivals";
import { PromoBanner } from "@/components/home/promo-banner";
import { TrustBadges } from "@/components/home/trust-badges";
import { HERO_SLIDES } from "@/lib/hero-slides";

export const metadata: Metadata = {
  title: "Home",
  description: "Modern clothing, from everyday staples to limited drops.",
};

export default function Home() {
  return (
    <main>
      <HeroCarousel slides={HERO_SLIDES} />
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
