import { CrownIcon } from "@/components/ui/icons-nav";
import { BEST_SELLERS } from "@/lib/best-sellers";
import { ProductCard } from "./product-card";
import { Section } from "./section";
import { SectionHeading } from "./section-heading";

export function BestSellers() {
  return (
    <Section>
      <SectionHeading
        eyebrow="Most wanted"
        icon={<CrownIcon />}
        title="Best sellers"
        description="What keeps selling out, restocked and ready to go."
        viewAllHref="/shop"
      />

      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 lg:gap-6">
        {BEST_SELLERS.map((product) => (
          <li key={product.id}>
            <ProductCard product={product} />
          </li>
        ))}
      </ul>
    </Section>
  );
}
