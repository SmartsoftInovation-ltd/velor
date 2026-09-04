import { useRef, useCallback } from "react";
import { useLocation, useNavigate } from "react-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import axiosSecure from "../../../hooks/useAxiosSecure";
import Button from "../../ui/button/Button";
import PageBreadcrumb from "../../common/PageBreadCrumb";
import ComponentCard from "../../common/ComponentCard";

import { IoIosPrint } from "react-icons/io";

interface PurchaseRow {
  _id: string;
  invoiceNumber: string;
  date: string;
  supplierName: string;
  commission: number;
  shipping: number;
  payable: number;
  paid: number;
  dueAmount: number;
  subTotal: number;
}

interface PageData {
  allPurchases: PurchaseRow[];
  totalSubTotal: number;
  totalCommission: number;
  totalShipping: number;
  totalPayable: number;
  totalDueAmount: number;
  totalPaid: number;
  pagination: { total: number; page: number; limit: number; hasNextPage: boolean };
}

const LIMIT = 50;

const PurchaseInvoiceView = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const printRef = useRef<HTMLDivElement>(null);

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
      queryKey: ["purchase-invoice-report", filters],
      queryFn: async ({ pageParam = 1 }) => {
        const res = await axiosSecure.post(
          `/invoice/purchase-invoice?page=${pageParam}&limit=${LIMIT}`,
          filters,
        );
        return res.data.data as PageData;
      },
      getNextPageParam: (last) =>
        last.pagination.hasNextPage ? last.pagination.page + 1 : undefined,
      initialPageParam: 1,
    });

  const allRows = data?.pages.flatMap((p) => p.allPurchases) ?? [];
  const totals = data?.pages[0];

  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: allRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48,
    overscan: 15,
  });

  const handleScroll = useCallback(() => {
    const el = parentRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 200;
    if (nearBottom && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handlePrint = () => {
    if (!printRef.current) return;
    const win = window.open("", "", "height=600,width=1000");
    if (!win) return;
    win.document.write(`<html><head><title>Purchase Invoice Report</title><style>
      body{font-family:Arial,sans-serif;padding:10px}
      .header{text-align:center;margin-bottom:20px}
      .company{font-size:22px;font-weight:bold}
      .subtitle{font-size:13px;color:#666}
      .title{font-size:16px;font-weight:bold;margin-top:12px}
      table{width:100%;border-collapse:collapse}
      th,td{border:1px solid #ddd;padding:7px;text-align:center;font-size:12px}
      th{background:#4ade80;font-weight:bold}
      .total-row{background:#f3f4f6;font-weight:bold}
    </style></head><body>
    <div class="header">
      <div class="company">Baig's Digital</div>
      <div class="subtitle">Mirpur 12, Dhaka, Bangladesh</div>
      <div class="title">Purchase Invoice Report</div>
      <div class="subtitle">${filters.startDate} to ${filters.endDate}${filters.supplierName ? ` | Supplier: ${filters.supplierName}` : ""}</div>
    </div>`);
    win.document.write(printRef.current.innerHTML);
    win.document.write("</body></html>");
    win.document.close();
    win.print();
  };

  const cols = ["SL#", "Invoice#", "Date", "Supplier", "Commission", "Shipping", "Payable", "Paid", "Due"];

  return (
    <div>
      <PageBreadcrumb pageTitle="Purchase Invoice Report" />
      <ComponentCard
        title={
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-sm font-semibold">Purchase Invoice Report</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {filters.startDate} — {filters.endDate}
                {filters.supplierName ? ` · ${filters.supplierName}` : ""}
                {totals ? ` · ${totals.pagination.total} records` : ""}
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
            {totals && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
                {[
                  { label: "Total Payable", value: totals.totalPayable },
                  { label: "Total Paid", value: totals.totalPaid },
                  { label: "Total Due", value: totals.totalDueAmount },
                  { label: "Commission", value: totals.totalCommission },
                  { label: "Shipping", value: totals.totalShipping },
                  { label: "Sub Total", value: totals.totalSubTotal },
                ].map((s) => (
                  <div key={s.label} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 text-center border border-gray-200 dark:border-gray-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400">{s.label}</p>
                    <p className="text-base font-bold text-gray-800 dark:text-gray-100 mt-0.5">
                      ৳{(s.value ?? 0).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Sticky header + virtualized body */}
            <div className="rounded-xl border border-gray-200 dark:border-white/[0.05] overflow-hidden">
              {/* Header */}
              <div className="bg-green-100 dark:bg-green-900/20 grid border-b border-gray-300 dark:border-gray-600"
                style={{ gridTemplateColumns: "50px 120px 100px 1fr 100px 100px 100px 100px 100px" }}>
                {cols.map((c) => (
                  <div key={c} className="px-3 py-3 text-xs font-semibold uppercase text-gray-700 dark:text-gray-300 text-center border-r border-gray-300 dark:border-gray-600 last:border-r-0">
                    {c}
                  </div>
                ))}
              </div>

              {allRows.length === 0 ? (
                <div className="py-16 text-center text-gray-500 dark:text-gray-400">No records found for the selected period.</div>
              ) : (
                <div
                  ref={parentRef}
                  className="overflow-y-auto bg-white dark:bg-white/[0.03]"
                  style={{ height: Math.min(allRows.length * 48 + 20, 600) }}
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
                            gridTemplateColumns: "50px 120px 100px 1fr 100px 100px 100px 100px 100px",
                          }}
                        >
                          {[
                            vRow.index + 1,
                            row.invoiceNumber,
                            row.date,
                            row.supplierName,
                            `৳${(row.commission ?? 0).toLocaleString()}`,
                            `৳${(row.shipping ?? 0).toLocaleString()}`,
                            `৳${(row.payable ?? 0).toLocaleString()}`,
                            `৳${(row.paid ?? 0).toLocaleString()}`,
                            `৳${(row.dueAmount ?? 0).toLocaleString()}`,
                          ].map((cell, ci) => (
                            <div key={ci} className="px-3 py-3 text-xs text-center text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700 last:border-r-0 truncate">
                              {cell}
                            </div>
                          ))}
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

            {/* Totals footer */}
            {totals && allRows.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-4 justify-end text-xs font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-3">
                <span>Payable: ৳{(totals.totalPayable ?? 0).toLocaleString()}</span>
                <span>Paid: ৳{(totals.totalPaid ?? 0).toLocaleString()}</span>
                <span className="text-red-600 dark:text-red-400">Due: ৳{(totals.totalDueAmount ?? 0).toLocaleString()}</span>
              </div>
            )}
          </div>
        )}
      </ComponentCard>
    </div>
  );
};

export default PurchaseInvoiceView;
