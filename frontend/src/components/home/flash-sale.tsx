import { headers } from "next/headers";
import { BoltIcon } from "@/components/ui/icons-section";
import { getFlashSale } from "@/lib/catalog/featured";
import { storeHostFrom } from "@/lib/store-api";
import { CountdownTimer } from "./countdown-timer";
import { ProductCard } from "./product-card";
import { Section } from "./section";
import { SectionHeading } from "./section-heading";

// The sale set under Website Management → Flash Sale; hidden when none is running
export async function FlashSale() {
  const sale = await getFlashSale(storeHostFrom(await headers()));
  if (!sale) return null;

  return (
    <Section>
      <SectionHeading
        eyebrow="Ends soon"
        icon={<BoltIcon />}
        title={sale.title}
        description="Sale prices until the clock runs out."
        action={<CountdownTimer endsAt={sale.endsAt} />}
      />

      <ul className="product-grid grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 lg:gap-6">
        {sale.products.map((product) => (
          <li key={`${product.id}:${product.href}`}>
            <ProductCard product={product} />
          </li>
        ))}
      </ul>
    </Section>
  );
}
