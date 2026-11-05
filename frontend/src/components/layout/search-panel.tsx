"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRightIcon } from "@/components/ui/icons";
import { SearchIcon } from "@/components/ui/icons-nav";
import type { SearchResult } from "@/lib/catalog/types";
import { cn } from "@/lib/cn";
import { SearchResultRow } from "./search-result-row";

type Props = {
  id: string;
  query: string;
  result: SearchResult | null;
  loading: boolean;
  failed: boolean;
  activeIndex: number;
  allResultsHref: string;
  onHover: (index: number) => void;
  onSelect: () => void;
};

export const searchOptionId = (panelId: string, index: number) => `${panelId}-option-${index}`;

function Skeleton() {
  return (
    <div className="space-y-1 p-2" aria-hidden="true">
      {[0, 1, 2].map((row) => (
        <div key={row} className="flex items-center gap-3 p-2">
          <div className="size-14 shrink-0 animate-pulse rounded-md bg-bg-sunken" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-3/4 animate-pulse rounded-xs bg-bg-sunken" />
            <div className="h-2.5 w-1/3 animate-pulse rounded-xs bg-bg-sunken" />
          </div>
          <div className="h-3 w-12 animate-pulse rounded-xs bg-bg-sunken" />
        </div>
      ))}
    </div>
  );
}

function Message({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div role="status" className="flex flex-col items-center px-6 py-9 text-center">
      <span className="mb-3 flex size-11 items-center justify-center rounded-full bg-bg-sunken text-text-tertiary">
        <SearchIcon className="size-5" />
      </span>
      <p className="max-w-full text-body font-medium break-words text-text-primary">{title}</p>
      <p className="mt-1 text-small text-text-secondary">{children}</p>
    </div>
  );
}

function Hint({ keys, label }: { keys: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <kbd className="rounded-xs border border-border-default bg-bg-surface px-1 font-sans text-micro text-text-secondary">
        {keys}
      </kbd>
      {label}
    </span>
  );
}

function Results({ id, query, result, loading, activeIndex, allResultsHref, onHover, onSelect }: Props & { result: SearchResult }) {
  const { suggestions, total } = result;
  return (
    <>
      <div className="flex items-baseline justify-between px-4 pt-3 pb-1">
        <p className="text-micro font-semibold tracking-wide text-text-tertiary uppercase">Products</p>
        <p role="status" className="text-caption tabular text-text-tertiary">
          {total === 1 ? "1 result" : `${total.toLocaleString()} results`}
        </p>
      </div>

      <ul
        id={id}
        role="listbox"
        aria-label="Search suggestions"
        className={cn("px-2 pb-2 transition-opacity duration-150", loading && "opacity-50")}
      >
        {suggestions.map((product, index) => (
          <SearchResultRow
            key={product.id}
            id={searchOptionId(id, index)}
            product={product}
            query={query}
            active={index === activeIndex}
            onHover={() => onHover(index)}
            onSelect={onSelect}
          />
        ))}
      </ul>

      <div className="flex items-center justify-between gap-4 border-t border-border-subtle bg-bg-sunken px-4 py-2.5">
        <Link
          href={allResultsHref}
          prefetch={false}
          onClick={onSelect}
          className="group inline-flex items-center gap-1.5 rounded-xs text-small font-medium text-text-brand"
        >
          See all {total.toLocaleString()} results
          <ArrowRightIcon className="size-3.5 transition-transform duration-150 ease-out group-hover:translate-x-0.5" />
        </Link>
        <div className="hidden items-center gap-3 text-micro text-text-tertiary md:flex">
          <Hint keys="↑↓" label="move" />
          <Hint keys="↵" label="open" />
          <Hint keys="esc" label="close" />
        </div>
      </div>
    </>
  );
}

/**
 * The results under the search box. It holds a handful of rows and hands the
 * rest to /shop, so there is nothing to scroll. On a phone with the keyboard up
 * the panel can still outgrow the screen, so it scrolls by touch with the bar
 * hidden (`.search-panel` in globals.css).
 *
 * preventDefault on mouse down keeps focus in the input: otherwise the blur
 * closes the panel before the click lands on a row.
 */
export function SearchPanel(props: Props) {
  const { query, result, loading, failed, onSelect } = props;

  return (
    <div
      onMouseDown={(event) => event.preventDefault()}
      className="search-panel absolute inset-x-0 top-full z-40 mt-2 max-h-[calc(100dvh-9rem)] overflow-y-auto rounded-lg border border-border-subtle bg-bg-elevated shadow-xl"
    >
      {failed ? (
        <Message title="Search isn't available right now">Please try again in a moment.</Message>
      ) : !result ? (
        <Skeleton />
      ) : result.total === 0 && !loading ? (
        <Message title={`No results for “${query}”`}>
          Check the spelling, or{" "}
          <Link href="/shop" onClick={onSelect} className="font-medium text-text-brand">
            browse all products
          </Link>
          .
        </Message>
      ) : result.total === 0 ? (
        <Skeleton />
      ) : (
        <Results {...props} result={result} />
      )}
    </div>
  );
}
