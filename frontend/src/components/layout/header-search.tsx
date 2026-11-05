"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, type KeyboardEvent } from "react";
import { CloseIcon } from "@/components/ui/icons";
import { SearchIcon } from "@/components/ui/icons-nav";
import { Input } from "@/components/ui/input";
import { MAX_SEARCH_LENGTH } from "@/lib/catalog/product-search";
import { buildShopHref } from "@/lib/catalog/query-params";
import { cn } from "@/lib/cn";
import { SearchPanel, searchOptionId } from "./search-panel";
import { useProductSearch } from "./use-product-search";

/**
 * The header's product search, a combobox: focus stays in the input and the
 * arrow keys move a highlight through the results. Enter opens the highlighted
 * product, or the full results on /shop when none is highlighted. The form's
 * action does the same search if the script has not loaded yet.
 */
export function HeaderSearch({ className }: { className?: string }) {
  const router = useRouter();
  const panelId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const { query, ready, result, loading, failed } = useProductSearch(term);

  const suggestions = result?.suggestions ?? [];
  const showPanel = open && ready;
  const hasOptions = showPanel && !failed && suggestions.length > 0;
  const activeIndex = hasOptions && active < suggestions.length ? active : -1;
  const allResultsHref = buildShopHref({}, { q: query });

  const close = () => {
    setOpen(false);
    setActive(-1);
  };

  const finish = () => {
    close();
    setTerm("");
    input.current?.blur();
  };

  const submit = () => {
    if (!query) return input.current?.focus();
    const chosen = suggestions[activeIndex];
    if (chosen) {
      finish();
      return router.push(chosen.href);
    }
    close();
    input.current?.blur();
    router.push(allResultsHref);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      // A search input clears itself on Esc; the first press should only close the panel
      event.preventDefault();
      if (showPanel) close();
      else setTerm("");
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    setOpen(true);
    if (!hasOptions) return;
    // Steps through the rows and back to the input (-1) before wrapping round
    const slots = suggestions.length + 1;
    const step = event.key === "ArrowDown" ? 1 : -1;
    setActive(((activeIndex + 1 + step + slots) % slots) - 1);
  };

  return (
    <form
      role="search"
      action="/shop"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) close();
      }}
      className={cn("relative", className)}
    >
      <Input
        ref={input}
        type="search"
        name="q"
        role="combobox"
        value={term}
        maxLength={MAX_SEARCH_LENGTH}
        autoComplete="off"
        enterKeyHint="search"
        aria-label="Search products"
        aria-autocomplete="list"
        aria-expanded={hasOptions}
        aria-controls={hasOptions ? panelId : undefined}
        aria-activedescendant={activeIndex >= 0 ? searchOptionId(panelId, activeIndex) : undefined}
        placeholder="Search for products, brands…"
        onChange={(event) => {
          setTerm(event.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className={cn(
          "h-12 rounded-md bg-bg-sunken pr-[6.5rem] pl-4 shadow-none hover:border-border-strong focus-visible:bg-bg-surface",
          "[&::-webkit-search-cancel-button]:appearance-none",
        )}
      />

      {term && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            setTerm("");
            setActive(-1);
            input.current?.focus();
          }}
          className="absolute top-1/2 right-[3.75rem] flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-text-tertiary transition-colors duration-150 ease-out hover:bg-bg-hover hover:text-text-primary"
        >
          <CloseIcon className="size-4" />
        </button>
      )}

      <button
        type="submit"
        aria-label="Search"
        className="absolute top-1/2 right-1.5 flex h-9 w-12 -translate-y-1/2 items-center justify-center rounded-md bg-brand-500 text-on-brand shadow-brand transition-colors duration-150 ease-out hover:bg-brand-600"
      >
        {showPanel && loading ? (
          <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          <SearchIcon className="size-[18px]" />
        )}
      </button>

      {showPanel && (
        <SearchPanel
          id={panelId}
          query={query}
          result={result}
          loading={loading}
          failed={failed && !loading}
          activeIndex={activeIndex}
          allResultsHref={allResultsHref}
          onHover={setActive}
          onSelect={finish}
        />
      )}
    </form>
  );
}
