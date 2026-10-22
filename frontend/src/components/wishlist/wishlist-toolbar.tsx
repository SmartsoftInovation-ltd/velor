import { CartIcon, TrashIcon } from "@/components/ui/icons";

/** Bulk actions across the whole list; the wishlist view passes the handlers in. */
export function WishlistToolbar({
  count,
  onClear,
  onMoveAll,
}: {
  count: number;
  onClear: () => void;
  onMoveAll: () => void;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-subtle bg-bg-surface px-4 py-3 shadow-xs">
      <p className="text-small text-text-secondary">
        <span className="font-semibold tabular text-text-primary">{count}</span>{" "}
        {count === 1 ? "item" : "items"} saved
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onClear}
          className="flex h-9 items-center gap-1.5 rounded-md px-3 text-small font-medium text-text-secondary transition-colors duration-150 hover:bg-bg-hover hover:text-text-primary"
        >
          <TrashIcon className="size-4" />
          Clear all
        </button>

        <button
          type="button"
          onClick={onMoveAll}
          className="shine relative flex h-9 items-center gap-1.5 rounded-md bg-brand-500 px-4 text-small font-medium text-white shadow-brand transition-[background-color,transform] duration-200 ease-[var(--ease-hover)] hover:bg-brand-600 active:scale-[0.98]"
        >
          <span className="relative z-2 flex shrink-0 [&>svg]:size-4" aria-hidden="true">
            <CartIcon />
          </span>
          Move all to bag
        </button>
      </div>
    </div>
  );
}
