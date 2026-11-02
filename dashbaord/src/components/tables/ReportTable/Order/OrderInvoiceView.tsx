import { useRef, useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useVirtualizer } from "@tanstack/react-virtual";
import axiosSecure from "../../../../hooks/useAxiosSecure";
import Button from "../../../ui/button/Button";
import PageBreadcrumb from "../../../common/PageBreadCrumb";
import ComponentCard from "../../../common/ComponentCard";
import { IoIosPrint } from "react-icons/io";
import { MdClose } from "react-icons/md";
import { TbEye } from "react-icons/tb";
import moment from "moment";
import { ROWS_ATTR, printSnapshot, renderPreview, type ReportSnapshot } from "../../../../hooks/useReportPrintAll";

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

const COLS = ["SL#", "Order ID", "Date", "Customer", "Phone", "Total", "Discount", "Sub Total", "Delivery", "Follow Up", "Status"];

const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
const taka = (n: number) => `৳${(n ?? 0).toLocaleString()}`;

// The printed sheet, built from the data rather than the screen list (which
// only draws the rows in view). Rows are kept separate so the preview can add
// them as it scrolls (see useReportPrintAll).
function orderSheet(rows: OrderRow[], summary: OrderSummary | undefined, filters: Record<string, string>): ReportSnapshot {
  const shell = `<style>
    .oi-sheet{font-family:Arial,sans-serif;color:#111}
    .oi-head{text-align:center;margin-bottom:16px}
    .oi-company{font-size:20px;font-weight:bold}
    .oi-sub{font-size:12px;color:#666;margin-top:2px}
    .oi-sheet table{width:100%;border-collapse:collapse}
    .oi-sheet th,.oi-sheet td{border:1px solid #ddd;padding:6px;font-size:11px;text-align:center}
    .oi-sheet td.oi-left{text-align:left}
    .oi-sheet th{background:#dcfce7;font-weight:bold;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .oi-sheet thead{display:table-header-group}
    .oi-sheet tr{break-inside:avoid}
    .oi-totals{margin-top:10px;display:flex;flex-wrap:wrap;gap:16px;justify-content:flex-end;font-size:11px;font-weight:bold}
  </style><div class="oi-sheet">
    <div class="oi-head"><div class="oi-company">Baig's Digital</div>
    <div class="oi-sub">Order Invoice Report · ${esc(filters.startDate)} to ${esc(filters.endDate)} · ${rows.length} orders</div></div>
    <table><thead><tr>${COLS.map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody ${ROWS_ATTR}=""></tbody></table>
    ${
      summary
        ? `<div class="oi-totals"><span>Orders: ${summary.totalOrders}</span><span>Value: ${taka(summary.totalOrderValue)}</span><span>Discount: ${taka(summary.totalDiscountValue)}</span><span>Delivery: ${taka(summary.totalDeliveryValue)}</span></div>`
        : ""
    }</div>`;
  const cells = (row: OrderRow, i: number) =>
    [
      i + 1,
      esc(row.orderId),
      moment(row.date).format("DD-MM-YY"),
      `<td class="oi-left">${esc(row.customerInfo?.name)}</td>`,
      esc(row.customerInfo?.phone),
      taka(row.total),
      taka(row.discount),
      taka(row.subTotal),
      taka(row.delivery),
      esc(row.followUpBy),
      esc(row.status),
    ]
      .map((c) => (String(c).startsWith("<td") ? c : `<td>${c}</td>`))
      .join("");
  return {
    shell,
    rows: rows.map((row, i) => `<tr>${cells(row, i)}</tr>`),
    className: "",
    width: 0,
    thermalHtml: "",
    thermalClassName: "",
  };
}

const OrderInvoiceView = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const parentRef = useRef<HTMLDivElement>(null);

  const queryClient = useQueryClient();
  const previewElRef = useRef<HTMLDivElement>(null);
  const [preview, setPreview] = useState<ReportSnapshot | null>(null);
  const [loadingAll, setLoadingAll] = useState(false);

  const filters = (location.state as { filters?: Record<string, string> })?.filters;

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
      enabled: !!filters?.startDate,
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

  // Preview and Print: every order in one request (?all=1); the list on
  // screen keeps loading 50 at a time as you scroll
  const loadSheet = async () => {
    if (!filters) return null;
    setLoadingAll(true);
    toast.loading("Loading every order of the report…", { id: "order-invoice-all" });
    try {
      const all = await queryClient.fetchQuery({
        queryKey: ["order-invoice-report-all", filters],
        queryFn: async () => (await axiosSecure.post(`/invoice/order-invoice?all=1`, filters)).data.data as PageData,
        staleTime: 30_000,
      });
      toast.dismiss("order-invoice-all");
      return orderSheet(all.orderList, all.summary, filters);
    } catch {
      toast.error("Could not load every order of the report.", { id: "order-invoice-all" });
      return null;
    } finally {
      setLoadingAll(false);
    }
  };

  const openPreview = async () => {
    const sheet = await loadSheet();
    if (sheet) setPreview(sheet);
  };

  const handlePrint = async () => {
    const sheet = preview ?? (await loadSheet());
    if (sheet) await printSnapshot(sheet);
  };

  useEffect(() => {
    if (!preview || !previewElRef.current) return;
    return renderPreview(previewElRef.current, preview);
  }, [preview]);

  useEffect(() => {
    if (!preview) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPreview(null);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [preview]);

  if (!filters?.startDate) {
    return (
      <div className="text-center mt-20 space-y-4">
        <p className="text-lg text-gray-600 dark:text-gray-400">No report filters found.</p>
        <Button onClick={() => navigate(-1)}>Go Back</Button>
      </div>
    );
  }

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
            <div className="flex items-center gap-2">
              <Button onClick={openPreview} disabled={loadingAll || totalCount === 0} className="bg-brand-500 hover:bg-brand-600 text-white px-3 py-2 rounded text-sm flex items-center gap-1">
                <TbEye /> Preview
              </Button>
              <Button onClick={handlePrint} disabled={loadingAll || totalCount === 0} className="bg-brand-500 hover:bg-brand-600 text-white px-3 py-2 rounded text-sm flex items-center gap-1">
                <IoIosPrint /> Print
              </Button>
            </div>
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
          <div>
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
                {COLS.map((c) => (
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

      {/* Preview: every order, added as you scroll */}
      {preview && (
        <div className="fixed inset-0 z-[100010] flex flex-col items-center bg-black/60 py-6" onClick={() => setPreview(null)}>
          <div onClick={(e) => e.stopPropagation()} className="mb-3 flex shrink-0 items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-semibold text-gray-800 shadow-lg hover:bg-gray-100"
            >
              <IoIosPrint className="size-4" /> Print
            </button>
            <button
              onClick={() => setPreview(null)}
              className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-semibold text-gray-800 shadow-lg hover:bg-gray-100"
            >
              <MdClose className="size-4" /> Close
            </button>
          </div>
          <div className="no-scrollbar min-h-0 w-full flex-1 overflow-y-auto px-4" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto w-full max-w-[297mm] bg-white p-[10mm] text-black shadow-lg" ref={previewElRef} />
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderInvoiceView;
