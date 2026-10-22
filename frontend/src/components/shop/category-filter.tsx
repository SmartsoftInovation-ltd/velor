import { GridIcon } from "@/components/ui/icons-nav";
import Link from "next/link";
import type { ReactNode } from "react";
import { buildShopHref } from "@/lib/catalog/query-params";
import type { Category, ShopQuery } from "@/lib/catalog/types";
import { cn } from "@/lib/cn";
import { FilterSection } from "./filter-section";

export function CategoryFilter({
  query,
  counts,
  categories,
}: {
  query: ShopQuery;
  counts: Record<string, number>;
  categories: Category[];
}) {
  return (
    <FilterSection title="Category" icon={<GridIcon />}>
      <ul className="space-y-1">
        <li>
          <Link
            href={buildShopHref(query, { category: undefined, subcategory: undefined })}
            className={rowClass(!query.category)}
          >
            <Radio active={!query.category} />
            <span className="flex-1">All products</span>
            <Count value={counts.all ?? 0} />
          </Link>
        </li>

        {categories.map((category) => {
          const active = query.category === category.id;
          return (
            <li key={category.id}>
              <Link
                href={buildShopHref(query, {
                  category: category.id,
                  subcategory: undefined,
                })}
                className={rowClass(active)}
              >
                <Radio active={active} />
                <span className="flex-1">{category.name}</span>
                <Count value={counts[category.id] ?? 0} />
              </Link>

              {/* Subcategories only unfold for the open category — showing all
                  of them at once turns a five-item list into twenty. */}
              {active ? (
                <ul className="mt-1 ml-2 space-y-0.5 border-l border-border-subtle pl-3">
                  {category.subcategories.map((sub) => {
                    const subActive = query.subcategory === sub.id;
                    return (
                      <li key={sub.id}>
                        <Link
                          href={buildShopHref(query, {
                            category: category.id,
                            subcategory: subActive ? undefined : sub.id,
                          })}
                          className={rowClass(subActive)}
                        >
                          <Radio active={subActive} />
                          <span className="flex-1">{sub.name}</span>
                          <Count value={counts[`${category.id}/${sub.id}`] ?? 0} />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </FilterSection>
  );
}

/** The selected row gets a tinted ground, matching the price brackets. */
function rowClass(active: boolean) {
  return cn(
    "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-small transition-colors duration-150",
    active
      ? "bg-brand-50 font-medium text-text-brand"
      : "text-text-secondary hover:bg-bg-hover hover:text-text-primary",
  );
}

function Radio({ active }: { active: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors duration-150",
        active ? "border-brand-500" : "border-border-default",
      )}
    >
      {active ? <span className="size-2 rounded-full bg-brand-500" /> : null}
    </span>
  );
}

function Count({ value }: { value: number }): ReactNode {
  return <span className="text-caption text-text-tertiary tabular">{value}</span>;
}
