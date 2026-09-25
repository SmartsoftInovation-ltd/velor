// Same look as the Platform Console seller status pill (see ui-redesign rules)
const StatusPill = ({ isActive }: { isActive: boolean }) => (
  <span
    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
      isActive
        ? "bg-accent-50 text-accent-700 ring-accent-500/20 dark:bg-accent-500/15 dark:text-accent-400"
        : "bg-error-50 text-error-700 ring-error-500/20 dark:bg-error-500/15 dark:text-error-400"
    }`}
  >
    <span className={`size-1.5 rounded-full ${isActive ? "bg-accent-500 animate-pulse" : "bg-error-500"}`} />
    {isActive ? "Active" : "Inactive"}
  </span>
);

export default StatusPill;
