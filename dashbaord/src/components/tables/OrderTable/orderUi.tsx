// Small pills shared by the order screens
import { PILL } from "./orderMeta";

// Cash on delivery, or the online payment and where it stands
export const PaymentPill = ({ method, status }: { method?: string; status?: string }) => {
  if (method !== "sslcommerz") {
    return (
      <span className={`${PILL} bg-gray-100 text-gray-700 ring-gray-500/15 dark:bg-white/5 dark:text-gray-300`}>
        Cash on delivery
      </span>
    );
  }
  const tone =
    status === "success"
      ? { label: "Paid online", cls: "bg-accent-50 text-accent-700 ring-accent-500/20 dark:bg-accent-500/15 dark:text-accent-400", dot: "bg-accent-500" }
      : status === "failed" || status === "cancelled"
        ? { label: status === "failed" ? "Payment failed" : "Payment cancelled", cls: "bg-error-50 text-error-700 ring-error-500/20 dark:bg-error-500/15 dark:text-error-400", dot: "bg-error-500" }
        : { label: "Awaiting payment", cls: "bg-warning-50 text-warning-700 ring-warning-500/20 dark:bg-warning-500/15 dark:text-warning-400", dot: "bg-warning-500 animate-pulse" };
  return (
    <span className={`${PILL} ${tone.cls}`}>
      <span className={`size-1.5 rounded-full ${tone.dot}`} />
      {tone.label}
    </span>
  );
};

// Web storefront or counter, plus the source the staff member picked
export const ChannelTag = ({ channel, source }: { channel?: string; source?: string }) => (
  <div className="flex flex-col items-start gap-1">
    <span
      className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${
        channel === "web"
          ? "bg-accent-500 text-white"
          : "bg-gray-800 text-white dark:bg-white/15"
      }`}
    >
      {channel === "web" ? "Web" : "POS"}
    </span>
    {source ? <span className="text-xs text-gray-500 dark:text-gray-400">{source}</span> : null}
  </div>
);
