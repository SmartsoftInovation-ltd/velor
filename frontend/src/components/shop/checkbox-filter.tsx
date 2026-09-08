import type { ReactNode } from "react";
import { buildShopHref, toggleValue } from "@/lib/catalog/query-params";
import type { ShopQuery } from "@/lib/catalog/types";
import { FilterCheckbox } from "./filter-checkbox";
import { FilterSection } from "./filter-section";

export function CheckboxFilter({
  title,
  icon,
  facet,
  options,
  query,
  counts,
}: {
  title: string;
  icon: ReactNode;
  facet: "brands" | "colors" | "sizes";
  options: string[];
  query: ShopQuery;
  counts?: Record<string, number>;
}) {
  const selected = query[facet] ?? [];

  return (
    <FilterSection title={title} icon={icon}>
      <ul className="space-y-1">
        {options.map((option) => (
          <li key={option}>
            <FilterCheckbox
              href={buildShopHref(query, {
                [facet]: toggleValue(query[facet], option),
              })}
              label={option}
              checked={selected.includes(option)}
              count={counts?.[option]}
            />
          </li>
        ))}
      </ul>
    </FilterSection>
  );
}
