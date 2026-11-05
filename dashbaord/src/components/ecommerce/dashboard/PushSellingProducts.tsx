import { useState } from "react";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { FiArrowRight } from "react-icons/fi";
import axiosSecure from "../../../hooks/useAxiosSecure";
import { formatNumber, type TopSellingMonths } from "./useDashboard";

interface PushRow {
  productId: string;
  variantId: string | null;
  productName: string | null;
  barcode: string | null;
  color: string | null;
  size: string | null;
  soldQty: number;
  stockQty: number;
}

// The Push Sales Product report's own defaults: the 5 items sold least, unsold
// only, so the box and the report it links to tell the same story.
const TOP = 5;
const MAX_SOLD = 0;

const toISODate = (date: Date) => {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

const usePushSellingProducts = (months: TopSellingMonths) =>
  useQuery<PushRow[]>({
    // "dashboard-" so it refreshes with the rest of the dashboard after a sale
    queryKey: ["dashboard-push-selling-products", months],
    queryFn: async () => {
      const end = new Date();
      const start = new Date(end);
      start.setDate(start.getDate() - (months * 30 - 1));
      const { data } = await axiosSecure.post(`/report/push-sales-product?page=1&limit=${TOP}`, {
        startDate: toISODate(start),
        endDate: toISODate(end),
        maxSold: MAX_SOLD,
        top: TOP,
      });
      return data?.data?.rows ?? [];
    },
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
    retry: false,
  });

const PushSellingProducts = () => {
  const [months, setMonths] = useState<TopSellingMonths>(1);
  const { data: rows = [], isLoading, isError } = usePushSellingProducts(months);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">Push Selling Products</h3>
        <div className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white p-1 dark:border-gray-800 dark:bg-white/[0.03]">
          {([1, 2, 3] as TopSellingMonths[]).map((m) => (
            <button
              key={m}
              onClick={() => setMonths(m)}
              title={`Last ${m * 30} days`}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                months === m
                  ? "bg-brand-500 text-white shadow-sm"
                  : "text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5"
              }`}
            >
              {m} {m === 1 ? "Month" : "Months"}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="h-[300px] animate-pulse rounded-xl bg-gray-50 dark:bg-white/[0.02]" />
      ) : isError ? (
        <p className="py-16 text-center text-sm text-gray-500 dark:text-gray-400">Could not load push selling products.</p>
      ) : rows.length === 0 ? (
        <p className="py-16 text-center text-sm text-gray-500 dark:text-gray-400">
          Every product sold in the last {months * 30} days.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-[1fr_56px_56px] gap-3 border-b border-gray-100 pb-2 text-xs font-medium text-gray-500 dark:border-gray-800 dark:text-gray-400">
            <span>Product</span>
            <span className="text-right">Sold</span>
            <span className="text-right">Stock</span>
          </div>
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {rows.map((row) => {
              // Items with no size or color often store the words "N/A"
              const details = [row.barcode, row.size, row.color]
                .filter((part) => part && part !== "N/A")
                .join(" · ");
              return (
                <li key={row.variantId ?? row.productId} className="grid grid-cols-[1fr_56px_56px] items-center gap-3 py-2.5 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-gray-800 dark:text-white/90">{row.productName ?? "N/A"}</span>
                    {details && <span className="block truncate text-xs text-gray-500 dark:text-gray-400">{details}</span>}
                  </span>
                  <span className="text-right tabular-nums text-gray-600 dark:text-gray-300">{formatNumber(row.soldQty)}</span>
                  <span className="text-right font-semibold tabular-nums text-gray-800 dark:text-white/90">{formatNumber(row.stockQty)}</span>
                </li>
              );
            })}
          </ul>
          <Link
            to="/push-sales-product"
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-accent-600 hover:underline dark:text-accent-400"
          >
            View report <FiArrowRight className="size-3" aria-hidden="true" />
          </Link>
        </>
      )}
    </div>
  );
};

export default PushSellingProducts;
