import { headers } from "next/headers";
import { SparkleIcon } from "@/components/ui/icons-nav";
import { getStoreProducts, recentProducts } from "@/lib/catalog/storefront";
import { storeHostFrom } from "@/lib/store-api";
import { ProductCard } from "./product-card";
import { Section } from "./section";
import { SectionHeading } from "./section-heading";

export async function NewArrivals() {
  // Automatic: whatever was added in the last 7 days. Nothing new, no section.
  const products = recentProducts(await getStoreProducts(storeHostFrom(await headers())), 7, 8);
  if (!products.length) return null;

  return (
    <Section muted>
      <SectionHeading
        eyebrow="Just landed"
        icon={<SparkleIcon />}
        title="New arrivals"
        description="Added to the shop this week."
        viewAllHref="/shop"
      />

      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 lg:gap-6">
        {products.map((product) => (
          <li key={product.id}>
            <ProductCard product={product} />
          </li>
        ))}
      </ul>
    </Section>
  );
}
