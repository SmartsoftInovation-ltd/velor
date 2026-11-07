import { DashboardRange } from "./useDashboard";

const OPTIONS: { value: DashboardRange; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7 Days" },
  { value: "30d", label: "30 Days" },
  { value: "90d", label: "90 Days" },
  { value: "12m", label: "12 Months" },
  { value: "all", label: "All" },
];

export default function RangeSelector({
  value,
  onChange,
}: {
  value: DashboardRange;
  onChange: (v: DashboardRange) => void;
}) {
  return (
    <div className="grid min-w-0 flex-1 grid-cols-3 gap-1 rounded-xl sm:inline-flex sm:flex-none sm:flex-wrap sm:items-center border border-gray-200/80 bg-white/80 p-1 shadow-theme-xs backdrop-blur dark:border-gray-800 dark:bg-white/[0.03]">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`whitespace-nowrap rounded-lg px-1.5 py-1.5 text-xs font-semibold transition-colors sm:px-3 ${
            value === o.value
              ? "bg-accent-500 text-white shadow-[0_4px_10px_-4px_rgba(15,157,99,0.7)]"
              : "text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/[0.06]"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
