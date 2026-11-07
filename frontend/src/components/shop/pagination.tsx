import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/icons";
import { buildShopHref } from "@/lib/catalog/query-params";
import type { ShopQuery } from "@/lib/catalog/types";
import { cn } from "@/lib/cn";

const STEP =
  "flex h-9 min-w-9 items-center justify-center rounded-md border px-2 text-small font-medium transition-colors duration-150";

export function Pagination({
  query,
  page,
  pageCount,
}: {
  query: ShopQuery;
  page: number;
  pageCount: number;
}) {
  if (pageCount <= 1) return null;

  const pages = Array.from({ length: pageCount }, (_, index) => index + 1);

  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-2">
      <Link
        href={buildShopHref(query, { page: page - 1 })}
        aria-label="Previous page"
        aria-disabled={page === 1}
        className={cn(
          STEP,
          page === 1
            ? "pointer-events-none border-border-subtle text-text-disabled"
            : "border-border-default text-text-secondary hover:border-border-strong hover:bg-bg-hover hover:text-text-primary",
        )}
      >
        <ChevronLeftIcon className="size-4" />
      </Link>

      {pages.map((item) => (
        <Link
          key={item}
          href={buildShopHref(query, { page: item })}
          aria-current={item === page ? "page" : undefined}
          className={cn(
            STEP,
            item === page
              ? "border-brand-500 bg-brand-500 text-on-brand"
              : "border-border-default text-text-secondary hover:border-border-strong hover:bg-bg-hover hover:text-text-primary",
          )}
        >
          {item}
        </Link>
      ))}

      <Link
        href={buildShopHref(query, { page: page + 1 })}
        aria-label="Next page"
        aria-disabled={page === pageCount}
        className={cn(
          STEP,
          page === pageCount
            ? "pointer-events-none border-border-subtle text-text-disabled"
            : "border-border-default text-text-secondary hover:border-border-strong hover:bg-bg-hover hover:text-text-primary",
        )}
      >
        <ChevronRightIcon className="size-4" />
      </Link>
    </nav>
  );
}
