import { CheckCircleIcon } from "@/components/ui/icons-filter";
import { buildShopHref, toggleValue } from "@/lib/catalog/query-params";
import type { Availability, ShopQuery } from "@/lib/catalog/types";
import { FilterCheckbox } from "./filter-checkbox";
import { FilterSection } from "./filter-section";

const OPTIONS: { id: Availability; label: string }[] = [
  { id: "in-stock", label: "In stock" },
  { id: "out-of-stock", label: "Out of stock" },
  { id: "offer", label: "On offer" },
];

export function AvailabilityFilter({
  query,
  counts,
}: {
  query: ShopQuery;
  counts: Record<Availability, number>;
}) {
  const selected = query.availability ?? [];

  return (
    <FilterSection title="Availability" icon={<CheckCircleIcon />}>
      <ul className="space-y-1">
        {OPTIONS.map((option) => (
          <li key={option.id}>
            <FilterCheckbox
              href={buildShopHref(query, {
                availability: toggleValue(query.availability, option.id),
              })}
              label={option.label}
              checked={selected.includes(option.id)}
              count={counts[option.id]}
            />
          </li>
        ))}
      </ul>
    </FilterSection>
  );
}
