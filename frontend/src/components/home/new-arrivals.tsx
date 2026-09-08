import { SparkleIcon } from "@/components/ui/icons-nav";
import { NEW_ARRIVALS } from "@/lib/products";
import { ProductCard } from "./product-card";
import { Section } from "./section";
import { SectionHeading } from "./section-heading";

export function NewArrivals() {
  return (
    <Section muted>
      <SectionHeading
        eyebrow="Just landed"
        icon={<SparkleIcon />}
        title="New arrivals"
        description="Fresh in this week — the pieces the season is being built around."
        viewAllHref="/shop"
      />

      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 lg:gap-6">
        {NEW_ARRIVALS.map((product) => (
          <li key={product.id}>
            <ProductCard product={product} />
          </li>
        ))}
      </ul>
    </Section>
  );
}
