import { useLocation, useNavigate } from "react-router";
import Button from "../../../ui/button/Button";
import PageBreadcrumb from "../../../common/PageBreadCrumb";
import ComponentCard from "../../../common/ComponentCard";
import MobileCardList from "../../../common/MobileCardList";
import MobileCardRow from "../../../common/MobileCardRow";
import useIsMobile from "../../../../hooks/useIsMobile";
import { IoIosPrint } from "react-icons/io";
import { MdClose } from "react-icons/md";
import { TbEye } from "react-icons/tb";
import { useEffect, useMemo, useRef, useState } from "react";
import { ROWS_ATTR, printSnapshot, renderPreview, type ReportSnapshot } from "../../../../hooks/useReportPrintAll";

interface StatusRow {
  _id: string;
  totalQty: number;
  totalValue: number;
}

interface OrderStatusData {
  statuses: StatusRow[];
  grandTotal: { qty: number; value: number };
  totalOrderCount: number;
  totalAmount: number;
}

interface ReportData {
  data?: OrderStatusData;
}

const STATUS_COLOR: Record<string, string> = {
  Pending: "text-yellow-600 bg-yellow-50",
  Confirmed: "text-blue-600 bg-blue-50",
  Packaging: "text-purple-600 bg-purple-50",
  Courier: "text-indigo-600 bg-indigo-50",
  Delivered: "text-green-600 bg-green-50",
  Cancelled: "text-red-600 bg-red-50",
  Hold: "text-gray-600 bg-gray-50",
};

const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
const taka = (n: number) => `৳${(n ?? 0).toLocaleString()}`;

// The printed sheet, built from the report data so Preview and Print look the
// same on every screen size (phones show cards instead of the table)
function statusSheet({ statuses, grandTotal, totalOrderCount, totalAmount }: OrderStatusData): ReportSnapshot {
  const shell = `<style>
    .os-sheet{font-family:Arial,sans-serif;color:#111}
    .os-head{text-align:center;margin-bottom:16px}
    .os-company{font-size:20px;font-weight:bold}
    .os-sub{font-size:12px;color:#666;margin-top:2px}
    .os-sheet table{width:100%;border-collapse:collapse}
    .os-sheet th,.os-sheet td{border:1px solid #ddd;padding:8px;font-size:12px;text-align:center}
    .os-sheet th{background:#dcfce7;font-weight:bold;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .os-sheet tfoot td{background:#f3f4f6;font-weight:bold;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  </style><div class="os-sheet">
    <div class="os-head"><div class="os-company">Baig's Digital</div>
    <div class="os-sub">Order Status Report · ${totalOrderCount} total orders · ${taka(totalAmount)}</div></div>
    <table><thead><tr><th>SL#</th><th>Status</th><th>Qty</th><th>Value</th></tr></thead><tbody ${ROWS_ATTR}=""></tbody>
    <tfoot><tr><td></td><td>Total</td><td>${grandTotal?.qty ?? 0}</td><td>${taka(grandTotal?.value)}</td></tr></tfoot></table></div>`;
  return {
    shell,
    rows: statuses.map((row, i) => `<tr><td>${i + 1}</td><td>${esc(row._id)}</td><td>${row.totalQty}</td><td>${taka(row.totalValue)}</td></tr>`),
    className: "",
    width: 0,
    thermalHtml: "",
    thermalClassName: "",
  };
}

const OrderStatusReportView = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const previewElRef = useRef<HTMLDivElement>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const reportData = location.state as ReportData | undefined;
  const sheet = useMemo(() => (reportData?.data ? statusSheet(reportData.data) : null), [reportData]);

  useEffect(() => {
    if (!previewOpen || !sheet || !previewElRef.current) return;
    return renderPreview(previewElRef.current, sheet);
  }, [previewOpen, sheet]);

  useEffect(() => {
    if (!previewOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPreviewOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [previewOpen]);

  if (!reportData?.data) {
    return (
      <div className="text-center mt-20 space-y-4">
        <p className="text-lg text-gray-600 dark:text-gray-400">No report data found.</p>
        <Button onClick={() => navigate(-1)}>Go Back</Button>
      </div>
    );
  }

  const { statuses, grandTotal, totalOrderCount, totalAmount } = reportData.data;

  const handlePrint = () => {
    if (sheet) void printSnapshot(sheet);
  };

  return (
    <div>
      <PageBreadcrumb pageTitle="Order Status Report" />
      <ComponentCard
        title={
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-sm font-semibold">Order Status Report</h2>
              <p className="text-xs text-gray-500 mt-0.5">{totalOrderCount} total orders · ৳{(totalAmount ?? 0).toLocaleString()}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={() => setPreviewOpen(true)} className="bg-brand-500 hover:bg-brand-600 text-white px-3 py-2 rounded text-sm flex items-center gap-1">
                <TbEye /> Preview
              </Button>
              <Button onClick={handlePrint} className="bg-brand-500 hover:bg-brand-600 text-white px-3 py-2 rounded text-sm flex items-center gap-1">
                <IoIosPrint /> Print
              </Button>
            </div>
          </div>
        }
      >
        <div>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 text-center border border-blue-100 dark:border-blue-800">
              <p className="text-xs text-blue-600 dark:text-blue-400">Total Orders</p>
              <p className="text-xl font-bold text-blue-700 dark:text-blue-300">{totalOrderCount}</p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3 text-center border border-green-100 dark:border-green-800">
              <p className="text-xs text-green-600 dark:text-green-400">Total Amount</p>
              <p className="text-xl font-bold text-green-700 dark:text-green-300">৳{(totalAmount ?? 0).toLocaleString()}</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 text-center border border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500">Total Qty</p>
              <p className="text-xl font-bold text-gray-700 dark:text-gray-300">{grandTotal?.qty ?? 0}</p>
            </div>
          </div>

          {isMobile ? (
            <div className="space-y-3">
              <MobileCardList
                items={statuses}
                getKey={(row) => row._id}
                emptyMessage="No status data found"
                renderCard={(row, i) => (
                  <>
                    <MobileCardRow label="SL#">{i + 1}</MobileCardRow>
                    <MobileCardRow label="Status">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_COLOR[row._id] ?? "text-gray-600 bg-gray-50"}`}>
                        {row._id}
                      </span>
                    </MobileCardRow>
                    <MobileCardRow label="Qty">{row.totalQty}</MobileCardRow>
                    <MobileCardRow label="Value">৳{(row.totalValue ?? 0).toLocaleString()}</MobileCardRow>
                  </>
                )}
              />
              <div className="rounded-2xl border border-gray-200 bg-gray-100 p-4 font-bold dark:border-gray-700 dark:bg-gray-800">
                <MobileCardRow label="Total Qty">{grandTotal?.qty ?? 0}</MobileCardRow>
                <MobileCardRow label="Total Value">৳{(grandTotal?.value ?? 0).toLocaleString()}</MobileCardRow>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 dark:border-white/[0.05] overflow-hidden">
              <div className="bg-green-100 dark:bg-green-900/20 grid grid-cols-4 border-b border-gray-300 dark:border-gray-600">
                {["SL#", "Status", "Qty", "Value"].map((c) => (
                  <div key={c} className="px-4 py-3 text-xs font-semibold uppercase text-gray-700 dark:text-gray-300 text-center border-r border-gray-300 dark:border-gray-600 last:border-r-0">
                    {c}
                  </div>
                ))}
              </div>

              <div className="bg-white dark:bg-white/[0.03]">
                {statuses.map((row, i) => (
                  <div
                    key={row._id}
                    className={`grid grid-cols-4 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-white/[0.02] ${i % 2 === 1 ? "bg-gray-50/50" : ""}`}
                  >
                    <div className="px-4 py-3 text-xs text-center text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700">{i + 1}</div>
                    <div className="px-4 py-3 text-xs text-center border-r border-gray-200 dark:border-gray-700">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_COLOR[row._id] ?? "text-gray-600 bg-gray-50"}`}>
                        {row._id}
                      </span>
                    </div>
                    <div className="px-4 py-3 text-xs text-center text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700">{row.totalQty}</div>
                    <div className="px-4 py-3 text-xs text-center text-gray-700 dark:text-gray-300">৳{(row.totalValue ?? 0).toLocaleString()}</div>
                  </div>
                ))}

                <div className="grid grid-cols-4 bg-gray-100 dark:bg-gray-800 font-bold border-t-2 border-gray-300 dark:border-gray-600">
                  <div className="px-4 py-3 text-xs text-center text-gray-700 dark:text-gray-300 border-r border-gray-300 dark:border-gray-600"></div>
                  <div className="px-4 py-3 text-xs text-center text-gray-700 dark:text-gray-300 border-r border-gray-300 dark:border-gray-600">Total</div>
                  <div className="px-4 py-3 text-xs text-center text-gray-700 dark:text-gray-300 border-r border-gray-300 dark:border-gray-600">{grandTotal?.qty ?? 0}</div>
                  <div className="px-4 py-3 text-xs text-center text-gray-700 dark:text-gray-300">৳{(grandTotal?.value ?? 0).toLocaleString()}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </ComponentCard>

      {previewOpen && (
        <div className="fixed inset-0 z-[100010] flex flex-col items-center bg-black/60 py-6" onClick={() => setPreviewOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="mb-3 flex shrink-0 items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-semibold text-gray-800 shadow-lg hover:bg-gray-100"
            >
              <IoIosPrint className="size-4" /> Print
            </button>
            <button
              onClick={() => setPreviewOpen(false)}
              className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-semibold text-gray-800 shadow-lg hover:bg-gray-100"
            >
              <MdClose className="size-4" /> Close
            </button>
          </div>
          <div className="no-scrollbar min-h-0 w-full flex-1 overflow-y-auto px-4" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto w-full max-w-[210mm] bg-white p-[12mm] text-black shadow-lg" ref={previewElRef} />
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderStatusReportView;
