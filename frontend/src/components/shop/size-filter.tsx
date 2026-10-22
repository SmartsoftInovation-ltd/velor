import { RulerIcon } from "@/components/ui/icons-filter";
import Link from "next/link";
import { buildShopHref, toggleValue } from "@/lib/catalog/query-params";
import type { ShopQuery } from "@/lib/catalog/types";
import { cn } from "@/lib/cn";
import { FilterSection } from "./filter-section";

export function SizeFilter({ query, sizes }: { query: ShopQuery; sizes: string[] }) {
  const selected = query.sizes ?? [];

  return (
    <FilterSection title="Size" icon={<RulerIcon />}>
      <ul className="flex flex-wrap gap-2">
        {sizes.map((size) => {
          const checked = selected.includes(size);
          return (
            <li key={size}>
              <Link
                href={buildShopHref(query, { sizes: toggleValue(query.sizes, size) })}
                aria-pressed={checked}
                className={cn(
                  "flex h-9 min-w-11 items-center justify-center rounded-md border px-2 text-small font-medium transition-colors duration-150",
                  checked
                    ? "border-brand-500 bg-brand-500 text-white"
                    : "border-border-default text-text-secondary hover:border-border-strong hover:bg-bg-hover hover:text-text-primary",
                )}
              >
                {size}
              </Link>
            </li>
          );
        })}
      </ul>
    </FilterSection>
  );
}
