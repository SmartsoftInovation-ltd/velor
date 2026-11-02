import { SearchIcon } from "@/components/ui/icons-nav";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";

/**
 * Presentation only — there is no catalogue search endpoint yet, so the field
 * carries no form and no handler. The button is inset inside the pill rather
 * than sitting beside it, so the whole control reads as one object.
 */
export function HeaderSearch({ className }: { className?: string }) {
  return (
    <div className={cn("relative", className)}>
      <Input
        type="search"
        aria-label="Search products"
        placeholder="Search for products, brands…"
        className="h-12 rounded-md bg-bg-sunken pr-16 pl-4 shadow-none hover:border-border-strong focus-visible:bg-bg-surface"
      />
      <button
        type="button"
        aria-label="Search"
        className="absolute top-1/2 right-1.5 flex h-9 w-12 -translate-y-1/2 items-center justify-center rounded-md bg-brand-500 text-on-brand shadow-brand transition-colors duration-150 ease-out hover:bg-brand-600"
      >
        <SearchIcon className="size-[18px]" />
      </button>
    </div>
  );
}
