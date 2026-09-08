import { StarIcon } from "@/components/ui/icons-filter";
import Link from "next/link";
import { Stars } from "@/components/ui/stars";
import { buildShopHref } from "@/lib/catalog/query-params";
import { RATING_OPTIONS } from "@/lib/catalog/taxonomy";
import type { ShopQuery } from "@/lib/catalog/types";
import { cn } from "@/lib/cn";
import { FilterSection } from "./filter-section";

export function RatingFilter({ query }: { query: ShopQuery }) {
  return (
    <FilterSection title="Rating" icon={<StarIcon />}>
      <ul className="space-y-1">
        {RATING_OPTIONS.map((rating) => {
          const active = query.minRating === rating;
          return (
            <li key={rating}>
              <Link
                href={buildShopHref(query, {
                  minRating: active ? undefined : rating,
                })}
                aria-pressed={active}
                aria-label={`${rating} stars and up`}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-small transition-colors duration-150",
                  active
                    ? "font-medium text-text-primary"
                    : "text-text-secondary hover:bg-bg-hover hover:text-text-primary",
                )}
              >
                <Stars rating={rating} />
                <span>&amp; up</span>
                {active ? (
                  <span className="ml-auto text-caption text-text-brand">Clear</span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </FilterSection>
  );
}
