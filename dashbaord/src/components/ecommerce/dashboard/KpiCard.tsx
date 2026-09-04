import { ReactNode, useState } from "react";

export interface KpiStat {
  label: string;
  value: string;
  color?: "default" | "success" | "error" | "warning";
}

export interface KpiProgressSegment {
  label: string;
  value: number;
  color: "success" | "error" | "warning" | "default";
}

export type KpiIconAccent =
  | "brand"
  | "success"
  | "warning"
  | "error"
  | "purple"
  | "orange"
  | "teal"
  | "pink";

interface KpiCardProps {
  title: string;
  value: string;
  icon: ReactNode;
  iconAccent?: KpiIconAccent;
  stats: KpiStat[];
  progressSegments?: KpiProgressSegment[];
  loading?: boolean;
  // Optional control rendered next to the title — e.g. a date-range filter
  // trigger. Kept generic so any card can opt in without changing this file.
  headerAction?: ReactNode;
}

const STAT_COLOR: Record<NonNullable<KpiStat["color"]>, string> = {
  default: "text-gray-800 dark:text-white/90",
  success: "text-success-600 dark:text-success-400",
  error: "text-error-600 dark:text-error-400",
  warning: "text-warning-600 dark:text-warning-400",
};

const ICON_BG: Record<KpiIconAccent, string> = {
  brand: "bg-brand-500",
  success: "bg-success-500",
  warning: "bg-warning-500",
  error: "bg-error-500",
  purple: "bg-purple-500",
  orange: "bg-orange-500",
  teal: "bg-teal-500",
  pink: "bg-pink-500",
};

const SEGMENT_BG: Record<KpiProgressSegment["color"], string> = {
  success: "bg-success-500",
  error: "bg-error-500",
  warning: "bg-warning-500",
  default: "bg-gray-300 dark:bg-gray-600",
};

const SegmentTooltip = ({
  text,
  widthPercent,
  color,
}: {
  text: string;
  widthPercent: number;
  color: string;
}) => {
  const [visible, setVisible] = useState(false);
  return (
    <div
      className="relative h-full"
      style={{ width: `${widthPercent}%`, flex: `0 0 ${widthPercent}%` }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      <div className={`h-full w-full ${color}`} />
      {visible && (
        <div className="absolute bottom-full left-1/2 z-[9999] mb-2 -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-[10px] font-bold text-white shadow-lg pointer-events-none">
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </div>
      )}
    </div>
  );
};

export default function KpiCard({
  title,
  value,
  icon,
  iconAccent = "brand",
  stats,
  progressSegments,
  loading = false,
  headerAction,
}: KpiCardProps) {
  if (loading) {
    return (
      <div className="h-[168px] animate-pulse rounded-2xl bg-gray-100 dark:bg-white/[0.03]" />
    );
  }

  return (
    <div className="flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="flex items-start gap-3">
        <span className={`flex size-10 shrink-0 items-center justify-center rounded-full text-white ${ICON_BG[iconAccent]}`}>
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {title}
            </p>
            {headerAction}
          </div>
          <h4 className="text-xl font-bold tracking-tight text-gray-800 dark:text-white/90">
            {value.startsWith("৳") ? (
              <>
                <span>৳</span>
                <span className="ml-px">{value.slice(1)}</span>
              </>
            ) : (
              value
            )}
          </h4>
        </div>
      </div>

      {progressSegments && progressSegments.length > 0 ? (() => {
        const total = progressSegments.reduce((sum, seg) => sum + seg.value, 0);
        return (
          <div
            className="mt-3 flex w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/[0.06]"
            style={{ height: 3 }}
          >
            {total > 0 &&
              progressSegments
                .filter((seg) => seg.value > 0)
                .map((seg, i) => (
                  <SegmentTooltip
                    key={i}
                    text={`${seg.label}: ${seg.value}`}
                    widthPercent={(seg.value / total) * 100}
                    color={SEGMENT_BG[seg.color]}
                  />
                ))}
          </div>
        );
      })() : (
        <div className="mt-3 border-t border-gray-100 dark:border-gray-800" />
      )}

      <div className="grid flex-1 items-end pt-2 text-center"
        style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}
      >
        {stats.map((s, i) => (
          <div
            key={s.label}
            className={`px-1 ${i > 0 ? "border-l border-gray-100 dark:border-gray-800" : ""}`}
          >
            <p className="truncate text-[10px] font-medium text-gray-400 dark:text-gray-500">
              {s.label}
            </p>
            <p
              className={`truncate text-sm font-bold tabular-nums ${STAT_COLOR[s.color ?? "default"]}`}
            >
              {s.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
