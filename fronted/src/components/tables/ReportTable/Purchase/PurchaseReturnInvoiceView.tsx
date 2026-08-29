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

interface ReturnRow {
  _id: string;
  supplierName: string;
  productName: string;
  variantName: string;
  color: string;
  size: string;
  quantity: number;
  retailPrice: number;
  totalRetailPricePerItem: number;
  date: string;
}

interface PageData {
  purchases: ReturnRow[];
  totalQuantity: number;
  totalRetailPrice: number;
  pagination: { total: number; page: number; limit: number; hasNextPage: boolean };
}

const LIMIT = 50;

const PurchaseReturnInvoiceView = () => {
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
      queryKey: ["purchase-return-report", filters],
      queryFn: async ({ pageParam = 1 }) => {
        const res = await axiosSecure.post(
          `/invoice/buyreturn-invoice?page=${pageParam}&limit=${LIMIT}`,
          filters,
        );
        return res.data.data as PageData;
      },
      getNextPageParam: (last) =>
        last.pagination.hasNextPage ? last.pagination.page + 1 : undefined,
      initialPageParam: 1,
    });

  const allRows = data?.pages.flatMap((p) => p.purchases) ?? [];
  const totals = data?.pages[0];

  const rowVirtualizer = useVirtualizer({
    count: allRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48,
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
    const win = window.open("", "", "height=600,width=1000");
    if (!win) return;
    win.document.write(`<html><head><title>Purchase Return Report</title><style>
      body{font-family:Arial,sans-serif;padding:10px}
      .header{text-align:center;margin-bottom:20px}
      .company{font-size:22px;font-weight:bold}
      table{width:100%;border-collapse:collapse}
      th,td{border:1px solid #ddd;padding:7px;text-align:center;font-size:12px}
      th{background:#4ade80;font-weight:bold}
    </style></head><body>
    <div class="header">
      <div class="company">Baig's Digital</div>
      <div>Purchase Return Report · ${filters.startDate} to ${filters.endDate}</div>
    </div>`);
    win.document.write(printRef.current.innerHTML);
    win.document.write("</body></html>");
    win.document.close();
    win.print();
  };

  const cols = ["SL#", "Date", "Supplier", "Product", "Variant", "Color", "Size", "Qty", "Price", "Total"];

  return (
    <div>
      <PageBreadcrumb pageTitle="Purchase Return Report" />
      <ComponentCard
        title={
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-sm font-semibold">Purchase Return Report</h2>
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
            {totals && (
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 text-center border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500">Total Quantity</p>
                  <p className="text-lg font-bold text-gray-800 dark:text-gray-100">{totals.totalQuantity}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 text-center border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500">Total Retail Price</p>
                  <p className="text-lg font-bold text-gray-800 dark:text-gray-100">৳{(totals.totalRetailPrice ?? 0).toLocaleString()}</p>
                </div>
              </div>
            )}

            <div className="rounded-xl border border-gray-200 dark:border-white/[0.05] overflow-hidden">
              <div
                className="bg-green-100 dark:bg-green-900/20 grid border-b border-gray-300 dark:border-gray-600"
                style={{ gridTemplateColumns: "45px 90px 1fr 1fr 1fr 80px 80px 60px 80px 90px" }}
              >
                {cols.map((c) => (
                  <div key={c} className="px-2 py-3 text-xs font-semibold uppercase text-gray-700 dark:text-gray-300 text-center border-r border-gray-300 dark:border-gray-600 last:border-r-0">
                    {c}
                  </div>
                ))}
              </div>

              {allRows.length === 0 ? (
                <div className="py-16 text-center text-gray-500 dark:text-gray-400">No records found.</div>
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
                          className={`grid border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-white/[0.02] ${vRow.index % 2 === 1 ? "bg-gray-50/50" : ""}`}
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "100%",
                            transform: `translateY(${vRow.start}px)`,
                            gridTemplateColumns: "45px 90px 1fr 1fr 1fr 80px 80px 60px 80px 90px",
                          }}
                        >
                          {[
                            vRow.index + 1,
                            moment(row.date).format("DD-MM-YY"),
                            row.supplierName,
                            row.productName || "-",
                            row.variantName || "-",
                            row.color || "-",
                            row.size || "-",
                            row.quantity,
                            `৳${(row.retailPrice ?? 0).toLocaleString()}`,
                            `৳${(row.totalRetailPricePerItem ?? 0).toLocaleString()}`,
                          ].map((cell, ci) => (
                            <div key={ci} className="px-2 py-3 text-xs text-center text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700 last:border-r-0 truncate">
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
          </div>
        )}
      </ComponentCard>
    </div>
  );
};

export default PurchaseReturnInvoiceView;
