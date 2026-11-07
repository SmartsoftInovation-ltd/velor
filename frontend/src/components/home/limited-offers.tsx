import { headers } from "next/headers";
import { TagIcon } from "@/components/ui/icons-nav";
import { getLimitedOffers } from "@/lib/catalog/featured";
import { storeHostFrom } from "@/lib/store-api";
import { ProductCard } from "./product-card";
import { Section } from "./section";
import { SectionHeading } from "./section-heading";

// The seller's picks under Website Management → Limited Offer; hidden until there are some
export async function LimitedOffers() {
  const products = await getLimitedOffers(storeHostFrom(await headers()));
  if (!products.length) return null;

  return (
    <Section muted>
      <SectionHeading
        eyebrow="While stock lasts"
        icon={<TagIcon />}
        title="Limited offers"
        description="Picked by the shop, while stock lasts."
        viewAllHref="/shop"
      />

      <ul className="product-grid grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 lg:gap-6">
        {products.map((product) => (
          // Two offers can be variants of one product: only the link tells them apart
          <li key={`${product.id}:${product.href}`}>
            <ProductCard product={product} />
          </li>
        ))}
      </ul>
    </Section>
  );
}
