import Link from "next/link";
import { HomeIcon } from "@/components/ui/icons-nav";
import { cn } from "@/lib/cn";

export type Crumb = { label: string; href?: string };

export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1 text-caption">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          const first = index === 0;

          return (
            <li key={item.label} className="flex items-center gap-1">
              {item.href && !last ? (
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-2 py-1 font-medium text-text-secondary transition-colors duration-150 hover:bg-bg-hover hover:text-text-brand",
                    first && "pl-1.5",
                  )}
                >
                  {first ? <HomeIcon className="size-4" /> : null}
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={last ? "page" : undefined}
                  className="rounded-md bg-bg-sunken px-2 py-1 font-medium text-text-primary"
                >
                  {item.label}
                </span>
              )}

              {last ? null : (
                <span aria-hidden="true" className="text-text-disabled">
                  /
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
