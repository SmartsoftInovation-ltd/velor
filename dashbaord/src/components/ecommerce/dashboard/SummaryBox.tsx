import { ReactNode } from "react";

type Accent = "brand" | "success" | "orange" | "purple";

const ACCENT: Record<Accent, string> = {
  brand: "from-brand-500 to-brand-600",
  success: "from-success-500 to-success-600",
  orange: "from-orange-500 to-orange-600",
  purple: "from-purple-500 to-purple-600",
};

export interface SummaryRow {
  label: string;
  value: string;
}

export default function SummaryBox({
  title,
  icon,
  accent,
  rows,
  loading = false,
}: {
  title: string;
  icon: ReactNode;
  accent: Accent;
  rows: SummaryRow[];
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="h-[150px] animate-pulse rounded-2xl bg-gray-100 dark:bg-white/[0.03]" />
    );
  }

  return (
    <div
      className={`overflow-hidden rounded-2xl bg-gradient-to-br ${ACCENT[accent]} p-5 text-white shadow-theme-sm`}
    >
      {/* Header — icon left, title right */}
      <div className="mb-4 flex items-center justify-between">
        <span className="flex size-9 items-center justify-center rounded-xl bg-white/20 text-white">
          {icon}
        </span>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-white/90">
          {title}
        </h3>
      </div>

      {/* Rows */}
      <div className="space-y-2">
        {rows.map((r) => (
          <div
            key={r.label}
            className="flex items-center justify-between border-b border-white/15 pb-1.5 text-sm last:border-b-0 last:pb-0"
          >
            <span className="font-medium text-white/80">{r.label}</span>
            <span className="font-bold tabular-nums">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
