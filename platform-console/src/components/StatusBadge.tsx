import type { TenantStatus } from "../api/types";

const COLORS: Record<TenantStatus, string> = {
  active: "bg-emerald-100 text-emerald-700",
  provisioning: "bg-sky-100 text-sky-700",
  suspended: "bg-amber-100 text-amber-800",
  cancelled: "bg-slate-200 text-slate-600",
};

const StatusBadge = ({ status }: { status: TenantStatus }) => (
  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${COLORS[status]}`}>{status}</span>
);

export default StatusBadge;
