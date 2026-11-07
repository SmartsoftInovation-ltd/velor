import { BsBoxSeam } from "react-icons/bs";

// Same look as the sales cart's empty state
const OrdersEmptyState = ({
  filtered,
  onClear,
  title = "No orders found",
  hint = "New orders will show up here.",
}: {
  filtered: boolean;
  onClear?: () => void;
  title?: string;
  hint?: string;
}) => (
  <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 px-4 py-10">
    <div className="relative">
      <span className="absolute inset-0 rounded-full bg-accent-500/10 blur-md" />
      <span className="relative flex size-14 items-center justify-center rounded-full border border-dashed border-accent-300 bg-accent-50 text-accent-600 dark:border-accent-500/40 dark:bg-accent-500/15 dark:text-accent-400">
        <BsBoxSeam className="size-6" />
      </span>
    </div>

    <div className="text-center">
      <p className="text-sm font-bold text-gray-700 dark:text-gray-200">{title}</p>
      <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
        {filtered ? "No orders match these filters." : hint}
      </p>
    </div>

    {filtered && onClear && (
      <button
        type="button"
        onClick={onClear}
        className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
      >
        Clear filters
      </button>
    )}
  </div>
);

export default OrdersEmptyState;
