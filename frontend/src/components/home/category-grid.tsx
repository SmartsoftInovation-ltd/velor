import { GridIcon } from "@/components/ui/icons-nav";
import { SHOP_CATEGORIES } from "@/lib/shop-categories";
import { CategoryCard } from "./category-card";
import { Section } from "./section";
import { SectionHeading } from "./section-heading";

export function CategoryGrid() {
  return (
    <Section>
      <SectionHeading
        eyebrow="Categories"
        icon={<GridIcon />}
        title="Shop by category"
        description="Six edits, built around how people actually get dressed."
        viewAllHref="/category"
      />

      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {SHOP_CATEGORIES.map((category) => (
          <li key={category.id}>
            <CategoryCard category={category} />
          </li>
        ))}
      </ul>
    </Section>
  );
}
