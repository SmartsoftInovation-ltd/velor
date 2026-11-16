import { headers } from "next/headers";
import { CrownIcon } from "@/components/ui/icons-nav";
import { bestSellingProducts, getStoreProducts } from "@/lib/catalog/storefront";
import { storeHostFrom } from "@/lib/store-api";
import { ProductCard } from "./product-card";
import { Section } from "./section";
import { SectionHeading } from "./section-heading";

export async function BestSellers() {
  const products = bestSellingProducts(await getStoreProducts(storeHostFrom(await headers())), 8);
  if (!products.length) return null;

  return (
    <Section>
      <SectionHeading
        eyebrow="Most wanted"
        icon={<CrownIcon />}
        title="Best sellers"
        description="What customers buy most."
        viewAllHref="/shop/best-sellers"
      />

      <ul className="product-grid grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 lg:gap-6">
        {products.map((product) => (
          <li key={product.id}>
            <ProductCard product={product} />
          </li>
        ))}
      </ul>
    </Section>
  );
}
