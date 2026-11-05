import Link from "next/link";
import { CloseIcon } from "@/components/ui/icons";
import { buildShopHref, toggleValue } from "@/lib/catalog/query-params";
import type { ShopQuery, Taxonomy } from "@/lib/catalog/types";

type Chip = { label: string; href: string };

const AVAILABILITY_LABELS = {
  "in-stock": "In stock",
  "out-of-stock": "Out of stock",
  offer: "On offer",
} as const;

function categoryLabel(query: ShopQuery, { categories }: Taxonomy) {
  const category = categories.find((item) => item.id === query.category);
  if (!category) return undefined;
  const sub = category.subcategories.find((item) => item.id === query.subcategory);
  return sub ? `${category.name} · ${sub.name}` : category.name;
}

function buildChips(query: ShopQuery, taxonomy: Taxonomy): Chip[] {
  const chips: Chip[] = [];

  if (query.q) {
    chips.push({ label: `“${query.q}”`, href: buildShopHref(query, { q: undefined }) });
  }

  const category = categoryLabel(query, taxonomy);
  if (category) {
    chips.push({
      label: category,
      href: buildShopHref(query, { category: undefined, subcategory: undefined }),
    });
  }

  for (const brand of query.brands ?? []) {
    chips.push({
      label: brand,
      href: buildShopHref(query, { brands: toggleValue(query.brands, brand) }),
    });
  }

  for (const colorId of query.colors ?? []) {
    chips.push({
      label: taxonomy.colors.find((color) => color.id === colorId)?.name ?? colorId,
      href: buildShopHref(query, { colors: toggleValue(query.colors, colorId) }),
    });
  }

  for (const size of query.sizes ?? []) {
    chips.push({
      label: `Size ${size}`,
      href: buildShopHref(query, { sizes: toggleValue(query.sizes, size) }),
    });
  }

  for (const state of query.availability ?? []) {
    chips.push({
      label: AVAILABILITY_LABELS[state],
      href: buildShopHref(query, {
        availability: toggleValue(query.availability, state),
      }),
    });
  }

  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    const from = query.minPrice ? `৳${query.minPrice.toLocaleString()}` : "৳0";
    const to = query.maxPrice ? `৳${query.maxPrice.toLocaleString()}` : "up";
    chips.push({
      label: `${from} – ${to}`,
      href: buildShopHref(query, { minPrice: undefined, maxPrice: undefined }),
    });
  }

  if (query.minRating !== undefined) {
    chips.push({
      label: `${query.minRating}★ & up`,
      href: buildShopHref(query, { minRating: undefined }),
    });
  }

  return chips;
}

export function ActiveFilters({ query, taxonomy }: { query: ShopQuery; taxonomy: Taxonomy }) {
  const chips = buildChips(query, taxonomy);
  if (!chips.length) return null;

  return (
    <ul className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <li key={chip.label}>
          <Link
            href={chip.href}
            className="flex items-center gap-1.5 rounded-full border border-border-default bg-bg-surface py-1 pl-3 pr-2 text-caption font-medium text-text-secondary transition-colors duration-150 hover:border-border-strong hover:text-text-primary"
          >
            {chip.label}
            <CloseIcon className="size-3.5" />
            <span className="sr-only">Remove filter</span>
          </Link>
        </li>
      ))}
      <li>
        <Link
          href="/shop"
          className="px-2 text-caption font-medium text-text-brand transition-opacity duration-150 hover:opacity-80"
        >
          Clear all
        </Link>
      </li>
    </ul>
  );
}
