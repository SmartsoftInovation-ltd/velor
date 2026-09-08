import { PaletteIcon } from "@/components/ui/icons-filter";
import Link from "next/link";
import { buildShopHref, toggleValue } from "@/lib/catalog/query-params";
import { COLORS } from "@/lib/catalog/taxonomy";
import type { ShopQuery } from "@/lib/catalog/types";
import { cn } from "@/lib/cn";
import { FilterSection } from "./filter-section";

export function ColorFilter({ query }: { query: ShopQuery }) {
  const selected = query.colors ?? [];

  return (
    <FilterSection title="Colour" icon={<PaletteIcon />}>
      <ul className="flex flex-wrap gap-2">
        {COLORS.map((color) => {
          const checked = selected.includes(color.id);
          return (
            <li key={color.id}>
              <Link
                href={buildShopHref(query, {
                  colors: toggleValue(query.colors, color.id),
                })}
                title={color.name}
                aria-label={color.name}
                aria-pressed={checked}
                className={cn(
                  "flex size-8 items-center justify-center rounded-full border transition-[border-color,box-shadow] duration-150",
                  checked
                    ? "border-brand-500 shadow-[0_0_0_2px_var(--color-brand-100)]"
                    : "border-border-default hover:border-border-strong",
                )}
              >
                <span
                  aria-hidden="true"
                  className="size-5 rounded-full border border-black/10"
                  style={{ backgroundColor: color.swatch }}
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </FilterSection>
  );
}
