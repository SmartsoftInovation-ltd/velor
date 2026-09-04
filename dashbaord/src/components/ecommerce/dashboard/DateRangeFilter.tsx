import { useEffect, useRef, useState } from "react";
import { FiCalendar, FiX } from "react-icons/fi";
import { CustomDateRange } from "./useDashboard";

// Small popover trigger shown on any KPI box that supports a per-box date
// filter — lets the user pin that one card to its underlying records' own
// `date` field falling in a picked range, independent of the dashboard-wide
// preset selector above it.
export default function DateRangeFilter({
  value,
  onChange,
}: {
  value: CustomDateRange | null;
  onChange: (v: CustomDateRange | null) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [draftStart, setDraftStart] = useState(value?.startDate ?? "");
  const [draftEnd, setDraftEnd] = useState(value?.endDate ?? "");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [isOpen]);

  const apply = () => {
    if (!draftStart) return;
    onChange({ startDate: draftStart, endDate: draftEnd || draftStart });
    setIsOpen(false);
  };

  const clear = () => {
    setDraftStart("");
    setDraftEnd("");
    onChange(null);
    setIsOpen(false);
  };

  return (
    <div className="relative shrink-0" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Filter by sale date"
        className={`flex size-5 items-center justify-center rounded-full transition-colors ${
          value
            ? "bg-brand-500 text-white"
            : "text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/[0.06] dark:hover:text-gray-300"
        }`}
      >
        <FiCalendar className="size-3" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-6 z-20 w-56 rounded-xl border border-gray-200 bg-white p-3 shadow-theme-lg dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">
              Filter by date
            </p>
            {value && (
              <button
                type="button"
                onClick={clear}
                aria-label="Clear date filter"
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <FiX className="size-3.5" />
              </button>
            )}
          </div>

          <div className="mt-2 space-y-2">
            <label className="block">
              <span className="mb-1 block text-[10px] text-gray-400">From</span>
              <input
                type="date"
                value={draftStart}
                onChange={(e) => setDraftStart(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-transparent px-2 py-1 text-xs text-gray-800 dark:border-gray-700 dark:text-white"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] text-gray-400">To</span>
              <input
                type="date"
                value={draftEnd}
                min={draftStart || undefined}
                onChange={(e) => setDraftEnd(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-transparent px-2 py-1 text-xs text-gray-800 dark:border-gray-700 dark:text-white"
              />
            </label>
          </div>

          <button
            type="button"
            onClick={apply}
            disabled={!draftStart}
            className="mt-3 w-full rounded-lg bg-brand-500 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}
