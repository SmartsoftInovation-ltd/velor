import Link from "next/link";
import { TagIcon } from "@/components/ui/icons-nav";
import { SlidersIcon } from "@/components/ui/icons-section";
import type { FacetCounts } from "@/lib/catalog/shop";
import { BRANDS } from "@/lib/catalog/taxonomy";
import type { ShopQuery } from "@/lib/catalog/types";
import { AvailabilityFilter } from "./availability-filter";
import { CategoryFilter } from "./category-filter";
import { CheckboxFilter } from "./checkbox-filter";
import { ColorFilter } from "./color-filter";
import { PriceFilter } from "./price-filter";
import { RatingFilter } from "./rating-filter";
import { SizeFilter } from "./size-filter";

export function FilterSidebar({
  query,
  counts,
  bare = false,
}: {
  query: ShopQuery;
  counts: FacetCounts;
  /** Inside the mobile drawer, which draws its own frame and title. */
  bare?: boolean;
}) {
  const hasFilters =
    Boolean(query.category) ||
    Boolean(query.brands?.length) ||
    Boolean(query.colors?.length) ||
    Boolean(query.sizes?.length) ||
    Boolean(query.availability?.length) ||
    query.minPrice !== undefined ||
    query.maxPrice !== undefined ||
    query.minRating !== undefined;

  return (
    <aside
      className={
        bare ? undefined : "rounded-lg border border-border-subtle bg-bg-surface p-5"
      }
    >
      {bare ? null : (
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-body font-semibold text-text-primary">
            <SlidersIcon className="size-5 text-text-secondary" />
            Filters
          </h2>
          {hasFilters ? (
            <Link
              href="/shop"
              className="text-caption font-medium text-text-brand transition-opacity duration-150 hover:opacity-80"
            >
              Clear all
            </Link>
          ) : null}
        </div>
      )}

      <CategoryFilter query={query} counts={counts.categories} />
      <CheckboxFilter
        title="Brand"
        icon={<TagIcon />}
        facet="brands"
        options={BRANDS}
        query={query}
        counts={counts.brands}
      />
      <PriceFilter query={query} />
      <RatingFilter query={query} />
      <ColorFilter query={query} />
      <SizeFilter query={query} />
      <AvailabilityFilter query={query} counts={counts.availability} />
    </aside>
  );
}
