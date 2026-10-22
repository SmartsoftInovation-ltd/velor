import { apiFetch } from "@/lib/store-api";

export type HeroSlide = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
  image: string;
  alt: string;
};

// GET /shop/banners: the store's active banners, priority 1 first
type ApiBanner = {
  _id: string;
  title: string;
  headLine: string;
  description: string;
  link: string;
  image: string;
};

const toHeroSlide = (banner: ApiBanner): HeroSlide => ({
  id: banner._id,
  eyebrow: banner.headLine,
  title: banner.title,
  description: banner.description,
  ctaLabel: "Shop Now",
  ctaHref: banner.link || "/shop",
  image: banner.image,
  alt: banner.title,
});

/**
 * The banners the seller manages under Website Management → Banner. An
 * unreachable API yields no slides, and the home page leaves the slider out.
 */
export async function getHeroSlides(tenantHost: string): Promise<HeroSlide[]> {
  if (!tenantHost) return [];
  try {
    const data = await apiFetch<{ banners: ApiBanner[] }>(tenantHost, "/shop/banners");
    return data.banners.map(toHeroSlide);
  } catch {
    return [];
  }
}
