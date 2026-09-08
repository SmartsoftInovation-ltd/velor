import { CurrencyIcon } from "@/components/ui/icons-filter";
import Link from "next/link";
import { buildShopHref } from "@/lib/catalog/query-params";
import type { ShopQuery } from "@/lib/catalog/types";
import { cn } from "@/lib/cn";
import { FilterSection } from "./filter-section";

/* Fixed brackets rather than a two-handle slider: a slider is a client
   component with drag state and a debounce, and it cannot be a link. These
   cover the catalogue's real spread. */
const BRACKETS: { label: string; min?: number; max?: number }[] = [
  { label: "Under ৳1,000", max: 999 },
  { label: "৳1,000 – ৳2,000", min: 1000, max: 2000 },
  { label: "৳2,000 – ৳4,000", min: 2000, max: 4000 },
  { label: "৳4,000 – ৳6,000", min: 4000, max: 6000 },
  { label: "৳6,000 and above", min: 6000 },
];

export function PriceFilter({ query }: { query: ShopQuery }) {
  return (
    <FilterSection title="Price" icon={<CurrencyIcon />}>
      <ul className="space-y-1">
        {BRACKETS.map((bracket) => {
          const active =
            query.minPrice === bracket.min && query.maxPrice === bracket.max;
          return (
            <li key={bracket.label}>
              <Link
                href={buildShopHref(query, {
                  minPrice: active ? undefined : bracket.min,
                  maxPrice: active ? undefined : bracket.max,
                })}
                aria-pressed={active}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-small transition-colors duration-150",
                  active
                    ? "bg-brand-50 font-medium text-text-brand"
                    : "text-text-secondary hover:bg-bg-hover hover:text-text-primary",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors duration-150",
                    active ? "border-brand-500" : "border-border-default",
                  )}
                >
                  {active ? <span className="size-2 rounded-full bg-brand-500" /> : null}
                </span>
                {bracket.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </FilterSection>
  );
}
