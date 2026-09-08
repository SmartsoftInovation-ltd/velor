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

export const HERO_SLIDES: HeroSlide[] = [
  {
    id: "new-season",
    eyebrow: "New Season",
    title: "Up to 30% Off",
    description: "Free Delivery · 0% EMI on the full autumn edit.",
    ctaLabel: "Shop Now",
    ctaHref: "/shop",
    image:
      "https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=1400&auto=format&fit=crop",
    alt: "Rack of curated clothing on hangers in a modern boutique",
  },
  {
    id: "street-essentials",
    eyebrow: "Street Essentials",
    title: "Everyday, Elevated",
    description: "Minimal silhouettes built for motion, priced to layer up.",
    ctaLabel: "Explore Essentials",
    ctaHref: "/category/fashion",
    image:
      "https://images.unsplash.com/photo-1445205170230-053b83016050?q=80&w=1400&auto=format&fit=crop",
    alt: "Model wearing a modern streetwear outfit against a plain backdrop",
  },
  {
    id: "limited-drop",
    eyebrow: "Limited Drop",
    title: "Own the Look",
    description: "Small batch, big detail — gone once the season ends.",
    ctaLabel: "View the Drop",
    ctaHref: "/shop",
    image:
      "https://images.unsplash.com/photo-1483985988355-763728e1935b?q=80&w=1400&auto=format&fit=crop",
    alt: "Close-up of tailored apparel showcasing fabric and stitch detail",
  },
];
