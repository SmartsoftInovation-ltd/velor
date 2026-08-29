import { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: string;
  icon: ReactNode;
  accent: "brand" | "success" | "warning" | "error" | "orange" | "purple";
  sub?: string;
  loading?: boolean;
}

const accentMap: Record<
  StatCardProps["accent"],
  { bg: string; text: string; ring: string }
> = {
  brand: {
    bg: "bg-brand-50 dark:bg-brand-500/10",
    text: "text-brand-500 dark:text-brand-400",
    ring: "group-hover:ring-brand-400/40",
  },
  success: {
    bg: "bg-success-50 dark:bg-success-500/10",
    text: "text-success-600 dark:text-success-400",
    ring: "group-hover:ring-success-400/40",
  },
  warning: {
    bg: "bg-warning-50 dark:bg-warning-500/10",
    text: "text-warning-600 dark:text-warning-400",
    ring: "group-hover:ring-warning-400/40",
  },
  error: {
    bg: "bg-error-50 dark:bg-error-500/10",
    text: "text-error-600 dark:text-error-400",
    ring: "group-hover:ring-error-400/40",
  },
  orange: {
    bg: "bg-orange-50 dark:bg-orange-500/10",
    text: "text-orange-500 dark:text-orange-400",
    ring: "group-hover:ring-orange-400/40",
  },
  purple: {
    bg: "bg-purple-50 dark:bg-purple-500/10",
    text: "text-purple-600 dark:text-purple-400",
    ring: "group-hover:ring-purple-400/40",
  },
};

export default function StatCard({
  label,
  value,
  icon,
  accent,
  sub,
  loading,
}: StatCardProps) {
  const c = accentMap[accent];
  return (
    <div className="group rounded-2xl border border-gray-200 bg-white p-5 transition-all hover:shadow-md dark:border-gray-800 dark:bg-white/[0.03]">
      <div
        className={`flex size-11 items-center justify-center rounded-xl ring-2 ring-transparent transition-all ${c.bg} ${c.text} ${c.ring}`}
      >
        {icon}
      </div>
      <div className="mt-4">
        <p className="text-[13px] font-medium text-gray-500 dark:text-gray-400">
          {label}
        </p>
        {loading ? (
          <div className="mt-2 h-7 w-24 animate-pulse rounded-md bg-gray-100 dark:bg-gray-800" />
        ) : (
          <h4 className="mt-1 text-2xl font-bold tracking-tight text-gray-800 dark:text-white/90">
            {value}
          </h4>
        )}
        {sub && !loading && (
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{sub}</p>
        )}
      </div>
    </div>
  );
}
