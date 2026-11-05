"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { ChevronRightIcon } from "@/components/ui/icons";
import { AppImage } from "@/components/ui/app-image";
import { highlightParts } from "@/lib/catalog/product-search";
import type { SearchSuggestion } from "@/lib/catalog/types";
import { cn } from "@/lib/cn";

type Props = {
  id: string;
  product: SearchSuggestion;
  query: string;
  active: boolean;
  onHover: () => void;
  onSelect: () => void;
};

function StockNote({ product }: { product: SearchSuggestion }) {
  if (product.stock === "out") {
    return <p className="text-micro font-medium text-text-tertiary">Out of stock</p>;
  }
  if (product.stock === "low" && product.stockCount) {
    return <p className="text-micro font-medium text-warning-text">Only {product.stockCount} left</p>;
  }
  return null;
}

/**
 * One suggestion. The input keeps focus and moves the highlight with
 * aria-activedescendant, so the link itself stays out of the tab order.
 */
export function SearchResultRow({ id, product, query, active, onHover, onSelect }: Props) {
  const row = useRef<HTMLLIElement>(null);
  const meta = [product.brand, product.categoryName].filter(Boolean).join(" · ");
  const soldOut = product.stock === "out";

  useEffect(() => {
    if (active) row.current?.scrollIntoView({ block: "nearest" });
  }, [active]);

  return (
    <li ref={row} id={id} role="option" aria-selected={active} onMouseMove={onHover}>
      <Link
        href={product.href}
        tabIndex={-1}
        prefetch={false}
        onClick={onSelect}
        className={cn(
          "flex items-center gap-3 rounded-md p-2 transition-colors duration-100",
          active && "bg-bg-hover",
        )}
      >
        <span className="relative size-14 shrink-0 overflow-hidden rounded-md border border-border-subtle bg-bg-sunken">
          <AppImage
            src={product.image}
            alt=""
            fill
            sizes="56px"
            className={cn("object-cover", soldOut && "opacity-50 grayscale")}
          />
        </span>

        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 text-small font-medium text-text-primary">
            {highlightParts(product.name, query).map((part, index) =>
              part.match ? (
                <mark key={index} className="rounded-xs bg-brand-100 text-text-primary">
                  {part.text}
                </mark>
              ) : (
                part.text
              ),
            )}
          </span>
          {meta && <span className="mt-0.5 block truncate text-caption text-text-tertiary">{meta}</span>}
        </span>

        <span className="shrink-0 text-right">
          <span className="block text-small font-semibold tabular text-text-primary">
            {product.fromPrice && <span className="font-normal text-text-tertiary">From </span>}৳
            {product.price.toLocaleString()}
          </span>
          {product.compareAtPrice !== undefined && (
            <span className="block text-caption tabular text-text-tertiary line-through">
              ৳{product.compareAtPrice.toLocaleString()}
            </span>
          )}
          <StockNote product={product} />
        </span>

        <ChevronRightIcon
          className={cn(
            "hidden size-4 shrink-0 text-text-tertiary transition duration-150 ease-out md:block",
            active ? "translate-x-0 opacity-100" : "-translate-x-1 opacity-0",
          )}
        />
      </Link>
    </li>
  );
}
