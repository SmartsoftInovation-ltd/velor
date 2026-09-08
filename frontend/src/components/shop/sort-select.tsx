"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDownIcon } from "@/components/ui/icons";
import { CheckIcon, SortIcon } from "@/components/ui/icons-filter";
import { buildShopHref } from "@/lib/catalog/query-params";
import type { ShopQuery, SortOption } from "@/lib/catalog/types";
import { cn } from "@/lib/cn";

const OPTIONS: { value: SortOption; label: string; hint: string }[] = [
  { value: "relevance", label: "Default sorting", hint: "Our pick" },
  { value: "newest", label: "Newest first", hint: "Latest drops" },
  { value: "price-asc", label: "Price", hint: "Low to high" },
  { value: "price-desc", label: "Price", hint: "High to low" },
  { value: "rating", label: "Top rated", hint: "Best reviewed" },
];

/**
 * A listbox rather than a native <select>: the option rows carry a hint and a
 * tick, which a native picker cannot style. Keyboard support is hand-rolled to
 * match — arrows move, Enter and Space commit, Escape closes.
 */
export function SortSelect({ query }: { query: ShopQuery }) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const current = query.sort ?? "relevance";
  const currentIndex = Math.max(
    OPTIONS.findIndex((option) => option.value === current),
    0,
  );
  const [activeIndex, setActiveIndex] = useState(currentIndex);
  const selected = OPTIONS[currentIndex];

  // Pointer-down, not click: closing on click would fire after the option's own
  // handler and fight it.
  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const choose = (value: SortOption) => {
    setOpen(false);
    router.push(buildShopHref(query, { sort: value }));
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") return setOpen(false);
    if (!open && (event.key === "Enter" || event.key === " " || event.key === "ArrowDown")) {
      event.preventDefault();
      setActiveIndex(currentIndex);
      return setOpen(true);
    }
    if (!open) return;

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((index) => (index + step + OPTIONS.length) % OPTIONS.length);
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(OPTIONS[activeIndex].value);
    }
  };

  return (
    <div ref={rootRef} className="relative" onKeyDown={onKeyDown}>
      <button
        type="button"
        onClick={() => {
          setActiveIndex(currentIndex);
          setOpen((value) => !value);
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Sort by ${selected.label}, ${selected.hint}`}
        className={cn(
          "flex h-10 items-center gap-2 rounded-md border bg-bg-surface pr-2.5 pl-3 shadow-xs transition-colors duration-150 ease-[var(--ease-hover)]",
          open
            ? "border-border-brand"
            : "border-border-default hover:border-border-strong",
        )}
      >
        <SortIcon className="size-4 shrink-0 text-text-tertiary" />
        <span className="text-small text-text-secondary">Sort by</span>
        <span className="text-small font-medium whitespace-nowrap text-text-primary">
          {selected.label}
        </span>
        <ChevronDownIcon
          className={cn(
            "size-4 shrink-0 text-text-tertiary transition-transform duration-200 ease-[var(--ease-hover)]",
            open && "rotate-180",
          )}
        />
      </button>

      {open ? (
        <ul
          role="listbox"
          aria-label="Sort by"
          className="absolute top-full left-0 z-20 mt-1.5 w-60 overflow-hidden rounded-md border border-border-subtle bg-bg-elevated p-1 shadow-lg"
        >
          {OPTIONS.map((option, index) => {
            const isCurrent = option.value === current;
            return (
              <li key={option.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isCurrent}
                  onClick={() => choose(option.value)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-sm px-2.5 py-2 text-left text-small transition-colors duration-100",
                    index === activeIndex ? "bg-bg-hover" : "bg-transparent",
                    isCurrent ? "font-medium text-text-brand" : "text-text-secondary",
                  )}
                >
                  <span className="flex-1">{option.label}</span>
                  <span className="text-caption text-text-tertiary">{option.hint}</span>
                  <CheckIcon
                    className={cn(
                      "size-4 shrink-0 text-brand-500",
                      isCurrent ? "opacity-100" : "opacity-0",
                    )}
                  />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
