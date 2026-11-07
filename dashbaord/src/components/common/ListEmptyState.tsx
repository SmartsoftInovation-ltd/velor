import type { ReactNode } from "react";
import { Link } from "react-router";
import { BsBoxSeam } from "react-icons/bs";
import { FaSearch } from "react-icons/fa";

/**
 * What a list shows when it has no rows: a quiet icon, a title and one line
 * of help. With a search on, it says nothing matched and offers to clear the
 * search; otherwise it can link to the page that creates the first record.
 */
export default function ListEmptyState({
  title,
  hint,
  search,
  onClearSearch,
  createTo,
  createLabel = "Create one",
  icon,
}: {
  title: string;
  hint?: string;
  search?: string;
  onClearSearch?: () => void;
  createTo?: string;
  createLabel?: string;
  icon?: ReactNode;
}) {
  const searching = !!search?.trim();

  return (
    <div className="flex min-h-[260px] flex-col items-center justify-center gap-3 px-4 py-10">
      <div className="relative">
        <span className="absolute inset-0 rounded-full bg-accent-500/10 blur-md" />
        <span className="relative flex size-14 items-center justify-center rounded-full border border-dashed border-accent-300 bg-accent-50 text-accent-600 dark:border-accent-500/40 dark:bg-accent-500/15 dark:text-accent-400 [&>svg]:size-6">
          {searching ? <FaSearch /> : (icon ?? <BsBoxSeam />)}
        </span>
      </div>

      <div className="max-w-xs text-center">
        <p className="text-sm font-bold text-gray-700 dark:text-gray-200">
          {searching ? "No matches" : title}
        </p>
        <p className="mt-0.5 break-words text-xs text-gray-400 dark:text-gray-500">
          {searching ? `Nothing matches "${search!.trim()}".` : hint}
        </p>
      </div>

      {searching && onClearSearch && (
        <button
          type="button"
          onClick={onClearSearch}
          className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
        >
          Clear search
        </button>
      )}
      {!searching && createTo && (
        <Link
          to={createTo}
          className="rounded-full bg-accent-500 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-accent-600"
        >
          {createLabel}
        </Link>
      )}
    </div>
  );
}
