import type { TenantStatus } from "../../platform/types";

const STYLES: Record<TenantStatus, { label: string; pill: string; dot: string }> = {
  active: { label: "Live", pill: "bg-accent-50 text-accent-700 ring-accent-500/20 dark:bg-accent-500/15 dark:text-accent-400", dot: "bg-accent-500" },
  provisioning: { label: "Provisioning", pill: "bg-blue-light-50 text-blue-light-700 ring-blue-light-500/20 dark:bg-blue-light-500/15 dark:text-blue-light-400", dot: "bg-blue-light-500" },
  suspended: { label: "Suspended", pill: "bg-warning-50 text-warning-700 ring-warning-500/20 dark:bg-warning-500/15 dark:text-warning-400", dot: "bg-warning-500" },
  cancelled: { label: "Cancelled", pill: "bg-gray-100 text-gray-600 ring-gray-500/15 dark:bg-white/5 dark:text-gray-400", dot: "bg-gray-400" },
};

const SellerStatusBadge = ({ status }: { status: TenantStatus }) => {
  const style = STYLES[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${style.pill}`}>
      <span className={`size-1.5 rounded-full ${style.dot} ${status === "active" ? "animate-pulse" : ""}`} />
      {style.label}
    </span>
  );
};

export default SellerStatusBadge;
