import { useEffect, useState } from "react";
import axiosSecure from "../../../hooks/useAxiosSecure";
import { showApiError } from "../../../utils/apiError";
import { ORDER_STATUSES, STATUS_LABELS, taka, toneOf } from "./orderMeta";

type Stat = { _id: string; count: number; amount: number };

interface OrderHistoryProps {
  /** null = every status */
  active: string | null;
  onSelect: (status: string | null) => void;
  /** Bump to refetch, e.g. after a status change or a new order */
  refreshKey?: number;
}

/**
 * The order pipeline: one tile per status, in the order an order moves
 * through them. Each tile is also the filter for the list below it.
 */
const OrderHistory = ({ active, onSelect, refreshKey = 0 }: OrderHistoryProps) => {
  const [stats, setStats] = useState<Stat[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    axiosSecure
      .get("/order/getordercountandamount")
      .then((res) => {
        if (!alive) return;
        setStats(res.data.data.orderCountAndAmount ?? []);
        setTotal(res.data.data.totalOrder ?? 0);
      })
      .catch((error) => showApiError(error, "Failed to fetch order stats!"))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [refreshKey]);

  const byStatus = new Map(stats.map((s) => [s._id, s]));
  const totalAmount = stats.reduce((sum, s) => sum + (s.amount || 0), 0);

  const tile = (key: string | null, label: string, count: number, amount: number, dot: string) => {
    const selected = active === key;
    return (
      <button
        key={key ?? "all"}
        type="button"
        onClick={() => onSelect(selected && key !== null ? null : key)}
        aria-pressed={selected}
        className={`shine group relative flex min-w-[150px] flex-1 flex-col items-start gap-1 rounded-xl border px-4 py-3 text-left transition-all active:scale-[0.98] ${
          selected
            ? "border-accent-500 bg-accent-50 shadow-[0_0_0_3px] shadow-accent-500/15 dark:bg-accent-500/10"
            : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 dark:border-white/[0.06] dark:bg-white/[0.02] dark:hover:bg-white/[0.04]"
        }`}
      >
        <span className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400">
          <span className={`size-2 rounded-full ${dot}`} />
          {label}
        </span>
        <span className={`text-2xl font-semibold tabular-nums ${selected ? "text-accent-700 dark:text-accent-400" : "text-gray-900 dark:text-white/90"}`}>
          {loading ? <span className="inline-block h-7 w-10 animate-pulse rounded bg-gray-200 dark:bg-gray-700" /> : count}
        </span>
        <span className="font-mono text-[11px] text-gray-400 dark:text-gray-500">{taka(amount)}</span>
      </button>
    );
  };

  return (
    <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
      {tile(null, "All orders", total, totalAmount, "bg-gray-900 dark:bg-white")}
      {ORDER_STATUSES.map((status) => {
        const stat = byStatus.get(status);
        return tile(status, STATUS_LABELS[status], stat?.count ?? 0, stat?.amount ?? 0, toneOf(status).dot);
      })}
    </div>
  );
};

export default OrderHistory;
