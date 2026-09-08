import { BoltIcon } from "@/components/ui/icons-section";
import { FLASH_SALE_PRODUCTS } from "@/lib/flash-sale";
import { CountdownTimer } from "./countdown-timer";
import { ProductCard } from "./product-card";
import { Section } from "./section";
import { SectionHeading } from "./section-heading";

const SALE_DURATION_MS = 2 * 24 * 60 * 60 * 1000 + 6 * 60 * 60 * 1000;

export function FlashSale() {
  return (
    <Section>
      <SectionHeading
        eyebrow="Ends soon"
        icon={<BoltIcon />}
        title="Flash sale"
        description="Deepest cuts of the season. When the clock stops, so do the prices."
        action={<CountdownTimer durationMs={SALE_DURATION_MS} />}
      />

      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 lg:gap-6">
        {FLASH_SALE_PRODUCTS.map((product) => (
          <li key={product.id}>
            <ProductCard product={product} />
          </li>
        ))}
      </ul>
    </Section>
  );
}
