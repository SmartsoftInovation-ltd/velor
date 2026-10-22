import { headers } from "next/headers";
import { GridIcon } from "@/components/ui/icons-nav";
import { getShopCategories } from "@/lib/shop-categories";
import { storeHostFrom } from "@/lib/store-api";
import { CategoryCard } from "./category-card";
import { Section } from "./section";
import { SectionHeading } from "./section-heading";

export async function CategoryGrid() {
  const categories = await getShopCategories(storeHostFrom(await headers()));
  // A store with no active categories (or an unreachable API) shows no section
  if (!categories.length) return null;

  return (
    <Section>
      <SectionHeading
        eyebrow="Categories"
        icon={<GridIcon />}
        title="Shop by category"
        description="Find what you need, one category at a time."
        viewAllHref="/shop"
      />

      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {categories.map((category) => (
          <li key={category.id}>
            <CategoryCard category={category} />
          </li>
        ))}
      </ul>
    </Section>
  );
}
