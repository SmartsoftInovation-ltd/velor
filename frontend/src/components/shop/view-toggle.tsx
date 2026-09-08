import Link from "next/link";
import { GridViewIcon, ListViewIcon } from "@/components/ui/icons-section";
import { buildShopHref } from "@/lib/catalog/query-params";
import type { ShopQuery, ViewMode } from "@/lib/catalog/types";
import { cn } from "@/lib/cn";

const VIEWS: { value: ViewMode; label: string; Icon: typeof GridViewIcon }[] = [
  { value: "grid", label: "Grid view", Icon: GridViewIcon },
  { value: "list", label: "List view", Icon: ListViewIcon },
];

/**
 * Two links, not a client toggle: the layout lives in the URL like every other
 * shop control, so it survives a refresh and a shared link.
 */
export function ViewToggle({ query }: { query: ShopQuery }) {
  const current = query.view ?? "grid";

  return (
    <div className="flex items-center gap-1" role="group" aria-label="Layout">
      {VIEWS.map(({ value, label, Icon }) => {
        const active = current === value;
        return (
          <Link
            key={value}
            href={buildShopHref(query, { view: value })}
            aria-label={label}
            aria-current={active ? "true" : undefined}
            className={cn(
              "flex size-9 items-center justify-center rounded-md transition-colors duration-150 ease-[var(--ease-hover)]",
              active
                ? "bg-brand-500 text-white shadow-xs"
                : "border border-border-default bg-bg-surface text-text-tertiary hover:border-border-strong hover:text-text-primary",
            )}
          >
            <Icon className="size-[18px]" />
          </Link>
        );
      })}
    </div>
  );
}
