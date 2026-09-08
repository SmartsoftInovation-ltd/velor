import { TagIcon } from "@/components/ui/icons-nav";
import { LIMITED_OFFERS } from "@/lib/limited-offers";
import { ProductCard } from "./product-card";
import { Section } from "./section";
import { SectionHeading } from "./section-heading";

export function LimitedOffers() {
  return (
    <Section muted>
      <SectionHeading
        eyebrow="While stock lasts"
        icon={<TagIcon />}
        title="Limited offers"
        description="Marked down while stock lasts — no code needed."
        viewAllHref="/shop"
      />

      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 lg:gap-6">
        {LIMITED_OFFERS.map((product) => (
          <li key={product.id}>
            <ProductCard product={product} />
          </li>
        ))}
      </ul>
    </Section>
  );
}
