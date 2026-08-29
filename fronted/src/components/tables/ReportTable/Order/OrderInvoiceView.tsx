import { useRef, useCallback } from "react";
import { useLocation, useNavigate } from "react-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import axiosSecure from "../../../../hooks/useAxiosSecure";
import Button from "../../../ui/button/Button";
import PageBreadcrumb from "../../../common/PageBreadCrumb";
import ComponentCard from "../../../common/ComponentCard";
import { IoIosPrint } from "react-icons/io";
import moment from "moment";

interface OrderRow {
  orderId: string;
  date: string;
  customerInfo: { name: string; phone: string; address: string };
  total: number;
  discount: number;
  subTotal: number;
  delivery: number;
  followUpBy: string;
  status: string;
}

interface OrderSummary {
  totalOrders: number;
  totalOrderValue: number;
  totalDiscountValue: number;
  totalDeliveryValue: number;
  totalPendingQty: number;
  totalConfirmedQty: number;
  totalDeliveredQty: number;
  totalCancelledQty: number;
}

interface PageData {
  orderList: OrderRow[];
  summary: OrderSummary;
  pagination: { total: number; page: number; limit: number; hasNextPage: boolean };
}

const STATUS_COLOR: Record<string, string> = {
  Pending: "bg-yellow-100 text-yellow-700",
  Confirmed: "bg-blue-100 text-blue-700",
  Packaging: "bg-purple-100 text-purple-700",
  Courier: "bg-indigo-100 text-indigo-700",
  Delivered: "bg-green-100 text-green-700",
  Cancelled: "bg-red-100 text-red-700",
  Hold: "bg-gray-100 text-gray-700",
};

const LIMIT = 50;

const OrderInvoiceView = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const printRef = useRef<HTMLDivElement>(null);
  const parentRef = useRef<HTMLDivElement>(null);

  const filters = (location.state as { filters?: Record<string, string> })?.filters;

  if (!filters?.startDate) {
    return (
      <div className="text-center mt-20 space-y-4">
        <p className="text-lg text-gray-600 dark:text-gray-400">No report filters found.</p>
        <Button onClick={() => navigate(-1)}>Go Back</Button>
      </div>
    );
  }

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError } =
    useInfiniteQuery<PageData>({
      queryKey: ["order-invoice-report", filters],
      queryFn: async ({ pageParam = 1 }) => {
        const res = await axiosSecure.post(
          `/invoice/order-invoice?page=${pageParam}&limit=${LIMIT}`,
          filters,
        );
        return res.data.data as PageData;
      },
      getNextPageParam: (last) =>
        last.pagination.hasNextPage ? last.pagination.page + 1 : undefined,
      initialPageParam: 1,
    });

  const allRows = data?.pages.flatMap((p) => p.orderList) ?? [];
  const summary = data?.pages[0]?.summary;
  const totalCount = data?.pages[0]?.pagination.total ?? 0;

  const rowVirtualizer = useVirtualizer({
    count: allRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 52,
    overscan: 15,
  });

  const handleScroll = useCallback(() => {
    const el = parentRef.current;
    if (!el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 200 && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handlePrint = () => {
    if (!printRef.current) return;
    const win = window.open("", "", "height=600,width=1100");
    if (!win) return;
    win.document.write(`<html><head><title>Order Invoice Report</title><style>
      body{font-family:Arial,sans-serif;padding:10px}
      .header{text-align:center;margin-bottom:20px}
      .company{font-size:22px;font-weight:bold}
      .subtitle{font-size:13px;color:#666}
      table{width:100%;border-collapse:collapse}
      th,td{border:1px solid #ddd;padding:7px;text-align:center;font-size:11px}
      th{background:#4ade80;font-weight:bold}
    </style></head><body>
    <div class="header">
      <div class="company">Baig's Digital</div>
      <div class="subtitle">Order Invoice Report · ${filters.startDate} to ${filters.endDate}</div>
    </div>`);
    win.document.write(printRef.current.innerHTML);
    win.document.write("</body></html>");
    win.document.close();
    win.print();
  };

  const cols = ["SL#", "Order ID", "Date", "Customer", "Phone", "Total", "Discount", "Sub Total", "Delivery", "Follow Up", "Status"];

  return (
    <div>
      <PageBreadcrumb pageTitle="Order Invoice Report" />
      <ComponentCard
        title={
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-sm font-semibold">Order Invoice Report</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {filters.startDate} — {filters.endDate} · {totalCount} orders
              </p>
            </div>
            <Button onClick={handlePrint} className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded text-sm flex items-center gap-1">
              <IoIosPrint /> Print
            </Button>
          </div>
        }
      >
        {isLoading && (
          <div className="flex justify-center py-20">
            <div className="size-10 border-4 border-brand-500/20 border-t-brand-500 rounded-full animate-spin" />
          </div>
        )}

        {isError && (
          <div className="text-center py-16 text-red-500 font-medium">
            Failed to load report. <button onClick={() => navigate(-1)} className="underline ml-1">Go Back</button>
          </div>
        )}

        {!isLoading && !isError && (
          <div ref={printRef}>
            {/* Summary cards */}
            {summary && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                {[
                  { label: "Total Orders", value: summary.totalOrders, isMoney: false },
                  { label: "Total Value", value: summary.totalOrderValue, isMoney: true },
                  { label: "Delivered", value: summary.totalDeliveredQty, isMoney: false },
                  { label: "Pending", value: summary.totalPendingQty, isMoney: false },
                ].map((s) => (
                  <div key={s.label} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 text-center border border-gray-200 dark:border-gray-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400">{s.label}</p>
                    <p className="text-base font-bold text-gray-800 dark:text-gray-100 mt-0.5">
                      {s.isMoney ? `৳${(s.value ?? 0).toLocaleString()}` : s.value}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Table */}
            <div className="rounded-xl border border-gray-200 dark:border-white/[0.05] overflow-hidden">
              <div
                className="bg-green-100 dark:bg-green-900/20 grid border-b border-gray-300 dark:border-gray-600"
                style={{ gridTemplateColumns: "45px 100px 90px 1fr 100px 90px 80px 90px 80px 90px 90px" }}
              >
                {cols.map((c) => (
                  <div key={c} className="px-2 py-3 text-xs font-semibold uppercase text-gray-700 dark:text-gray-300 text-center border-r border-gray-300 dark:border-gray-600 last:border-r-0">
                    {c}
                  </div>
                ))}
              </div>

              {allRows.length === 0 ? (
                <div className="py-16 text-center text-gray-500 dark:text-gray-400">No orders found for the selected period.</div>
              ) : (
                <div
                  ref={parentRef}
                  className="overflow-y-auto bg-white dark:bg-white/[0.03]"
                  style={{ height: Math.min(allRows.length * 52 + 20, 600) }}
                  onScroll={handleScroll}
                >
                  <div style={{ height: rowVirtualizer.getTotalSize(), position: "relative" }}>
                    {rowVirtualizer.getVirtualItems().map((vRow) => {
                      const row = allRows[vRow.index];
                      return (
                        <div
                          key={vRow.key}
                          data-index={vRow.index}
                          ref={rowVirtualizer.measureElement}
                          className={`grid border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-white/[0.02] ${vRow.index % 2 === 1 ? "bg-gray-50/50 dark:bg-white/[0.01]" : ""}`}
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "100%",
                            transform: `translateY(${vRow.start}px)`,
                            gridTemplateColumns: "45px 100px 90px 1fr 100px 90px 80px 90px 80px 90px 90px",
                          }}
                        >
                          <div className="px-2 py-3 text-xs text-center text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700">{vRow.index + 1}</div>
                          <div className="px-2 py-3 text-xs text-center text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700 truncate">{row.orderId}</div>
                          <div className="px-2 py-3 text-xs text-center text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700">{moment(row.date).format("DD-MM-YY")}</div>
                          <div className="px-2 py-3 text-xs text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700 truncate">{row.customerInfo?.name}</div>
                          <div className="px-2 py-3 text-xs text-center text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700">{row.customerInfo?.phone}</div>
                          <div className="px-2 py-3 text-xs text-center text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700">৳{(row.total ?? 0).toLocaleString()}</div>
                          <div className="px-2 py-3 text-xs text-center text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700">৳{(row.discount ?? 0).toLocaleString()}</div>
                          <div className="px-2 py-3 text-xs text-center text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700">৳{(row.subTotal ?? 0).toLocaleString()}</div>
                          <div className="px-2 py-3 text-xs text-center text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700">৳{(row.delivery ?? 0).toLocaleString()}</div>
                          <div className="px-2 py-3 text-xs text-center text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700 truncate">{row.followUpBy}</div>
                          <div className="px-2 py-3 text-xs text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_COLOR[row.status] ?? "bg-gray-100 text-gray-700"}`}>
                              {row.status}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {isFetchingNextPage && (
                    <div className="flex justify-center py-4">
                      <div className="size-6 border-2 border-brand-500/20 border-t-brand-500 rounded-full animate-spin" />
                    </div>
                  )}
                </div>
              )}
            </div>

            {summary && allRows.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-4 justify-end text-xs font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-3">
                <span>Orders: {summary.totalOrders}</span>
                <span>Value: ৳{(summary.totalOrderValue ?? 0).toLocaleString()}</span>
                <span>Discount: ৳{(summary.totalDiscountValue ?? 0).toLocaleString()}</span>
                <span>Delivery: ৳{(summary.totalDeliveryValue ?? 0).toLocaleString()}</span>
              </div>
            )}
          </div>
        )}
      </ComponentCard>
    </div>
  );
};

export default OrderInvoiceView;
