import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import toast from "react-hot-toast";
import axiosSecure from "../../../hooks/useAxiosSecure";
import PageMeta from "../../common/PageMeta";
import SearchableSelect from "../../form/SearchableSelect";

import { IoIosPrint } from "react-icons/io";
import { MdCalendarToday, MdChevronLeft, MdClose, MdOutlineFilterAlt } from "react-icons/md";
import { TbBook2 } from "react-icons/tb";
import { LuFileDown } from "react-icons/lu";

// ---------- Types ----------
interface LedgerRow {
  _id: string;
  sl: number;
  date: string;
  action: string;
  reference: string;
  stockIn: number;
  stockOut: number;
  balance: number;
}

interface LedgerItem {
  productId: string | null;
  variantId: string | null;
  productName: string;
  variantName: string;
  barcode: string;
  color: string;
  size: string;
}

interface StoreHeader {
  storeName: string;
  phone: string;
  secondaryPhone?: string;
  email?: string;
  address: string;
  logo?: string;
}

interface ReportData {
  header: StoreHeader | null;
  item: LedgerItem & { openingStock: number };
  rows: LedgerRow[];
  totals: {
    count: number;
    totalStockIn: number;
    totalStockOut: number;
    balance: number;
  };
}

// ---------- Static config ----------
type PageFormat = "a4" | "a5" | "80mm";

const pageFormatOptions: { value: PageFormat; label: string }[] = [
  { value: "a4", label: "A4" },
  { value: "a5", label: "A5" },
  { value: "80mm", label: "80mm Thermal" },
];

const pageSizeMm: Record<PageFormat, { width: number; height?: number }> = {
  a4: { width: 210, height: 297 },
  a5: { width: 148, height: 210 },
  "80mm": { width: 80 },
};

const COLUMN_DEFS = [
  { key: "date", label: "Date" },
  { key: "action", label: "Action Description" },
  { key: "reference", label: "Reference ID" },
  { key: "stockIn", label: "Stock In" },
  { key: "stockOut", label: "Stock Out" },
  { key: "balance", label: "Balance" },
] as const;

type ColumnKey = (typeof COLUMN_DEFS)[number]["key"];

// Text columns read left-aligned; the three quantity columns are right-aligned
// so digits line up by place value.
const TEXT_COLUMNS: ColumnKey[] = ["date", "action", "reference"];

// Stock-in rows read green and stock-out rows red, so the direction of a
// movement is visible without reading the numbers.
const IN_ACTIONS = new Set(["Opening", "Purchase", "Sales Return", "Courier Return", "Adjust Plus (+)"]);

const money = (n: number) => (n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 });

const itemLabel = (i: LedgerItem) =>
  [i.productName, i.barcode, i.color, i.size]
    .filter((v) => v && v !== "-" && v !== "N/A")
    .join(" | ");

// ---------- Component ----------
const ProductLedgerReport = () => {
  const navigate = useNavigate();
  const printRef = useRef<HTMLDivElement>(null);
  const thermalRef = useRef<HTMLDivElement>(null);
  const startDateRef = useRef<HTMLInputElement>(null);
  const endDateRef = useRef<HTMLInputElement>(null);

  const [itemKey, setItemKey] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pageFormat, setPageFormat] = useState<PageFormat>("a4");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Record<ColumnKey, boolean>>(
    Object.fromEntries(COLUMN_DEFS.map((c) => [c.key, true])) as Record<ColumnKey, boolean>,
  );

  // Esc closes the filters drawer.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  useEffect(() => {
    if (!previewOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreviewOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [previewOpen]);

  useEffect(() => {
    document.body.classList.add("printing-report");
    return () => {
      document.body.classList.remove("printing-report");
    };
  }, []);

  const { data: items } = useQuery({
    queryKey: ["ledger-items", itemSearch],
    queryFn: async () => {
      const { data } = await axiosSecure.get(
        `/report/ledger-items${itemSearch ? `?search=${encodeURIComponent(itemSearch)}` : ""}`,
      );
      return (data.data.items || []) as LedgerItem[];
    },
    staleTime: 5 * 60 * 1000,
  });

  // One option key carries both ids, since a ledger is for either a variant or
  // a variant-less product and the request needs to know which.
  const itemOptions = useMemo(
    () => [
      { value: "", label: "Select a product / variant" },
      ...(items ?? []).map((i) => ({
        value: `${i.productId ?? ""}:${i.variantId ?? ""}`,
        label: itemLabel(i) || i.productName,
      })),
    ],
    [items],
  );

  const [productId, variantId] = itemKey.split(":");

  const { data, isLoading, isError } = useQuery<ReportData>({
    queryKey: ["product-ledger", itemKey, startDate, endDate],
    queryFn: async () => {
      const res = await axiosSecure.post("/report/product-ledger", {
        productId: productId || undefined,
        variantId: variantId || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      return res.data.data as ReportData;
    },
    enabled: !!itemKey,
    placeholderData: keepPreviousData,
  });

  const header = data?.header;
  const totals = data?.totals;
  const rows = data?.rows ?? [];
  const item = data?.item;

  const filterLabel = item ? itemLabel(item) : "No item selected";
  const activeFilterCount = [itemKey, startDate, endDate].filter(Boolean).length;

  const visibleCols = COLUMN_DEFS.filter((c) => visibleColumns[c.key]);

  const setAllColumns = (value: boolean) => {
    setVisibleColumns(Object.fromEntries(COLUMN_DEFS.map((c) => [c.key, value])) as Record<ColumnKey, boolean>);
  };

  const isThermal = pageFormat === "80mm";

  useEffect(() => {
    if (!previewOpen || isThermal || !printRef.current) return;
    const html = printRef.current.innerHTML
      .replace(/hidden print:flex/g, "flex")
      .replace(/hidden print:block/g, "block")
      .replace(/hidden print:table-cell/g, "table-cell")
      .replace(/print:hidden/g, "hidden")
      .replace(/overflow-x-auto/g, "overflow-visible")
      .replace(/min-w-\[\d+px\]/g, "min-w-0");
    setPreviewHtml(html);
  }, [previewOpen, isThermal, pageFormat, data, visibleColumns]);

  useEffect(() => {
    const styleEl = document.createElement("style");
    styleEl.id = "report-print-page-size";
    const blankMarginBoxes = `
      @top-left { content: ""; } @top-center { content: ""; } @top-right { content: ""; }
      @bottom-left { content: ""; } @bottom-center { content: ""; } @bottom-right { content: ""; }
    `;
    styleEl.textContent = isThermal
      ? `@page { size: 80mm auto; margin: 3mm; ${blankMarginBoxes} }`
      : `@page { size: ${pageFormat}; margin: 12mm; ${blankMarginBoxes} }`;
    document.head.appendChild(styleEl);
    return () => {
      styleEl.remove();
    };
  }, [pageFormat, isThermal]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    const source = isThermal ? thermalRef.current : printRef.current;
    if (!source) return;
    setPdfBusy(true);
    try {
      const canvas = await html2canvas(source, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
      });

      const size = pageSizeMm[pageFormat];
      const pdf = isThermal
        ? new jsPDF({ unit: "mm", format: [size.width, (canvas.height * size.width) / canvas.width] })
        : new jsPDF({ unit: "mm", format: pageFormat });

      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgH = (canvas.height * pageW) / canvas.width;
      const img = canvas.toDataURL("image/png");

      if (imgH <= pageH) {
        pdf.addImage(img, "PNG", 0, 0, pageW, imgH);
      } else {
        let remaining = imgH;
        let offset = 0;
        while (remaining > 0) {
          pdf.addImage(img, "PNG", 0, -offset, pageW, imgH);
          remaining -= pageH;
          offset += pageH;
          if (remaining > 0) pdf.addPage();
        }
      }

      pdf.save(`product-ledger-${new Date().toISOString().split("T")[0]}.pdf`);
      toast.success("Report PDF downloaded");
    } catch {
      toast.error("Could not generate the PDF.");
    } finally {
      setPdfBusy(false);
    }
  };

  const portalTarget = document.getElementById("app-content-portal-target");
  if (!portalTarget) return null;

  return createPortal(
    <div className="flex h-[calc(100vh-72px)] gap-0 print:block print:h-auto">
      <PageMeta title="Product Ledger - Baig Ecommerce" description="Product stock movement ledger" />

      {/* Toolbar */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-y-2 border-b border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-800 dark:bg-gray-950 print:hidden">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-white/[0.05]"
          >
            <MdChevronLeft className="size-4" /> Back
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-0.5 rounded-full border border-gray-200 bg-white p-1 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              {pageFormatOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setPageFormat(opt.value)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                    opt.value === pageFormat
                      ? "bg-gray-900 text-white dark:bg-gray-700"
                      : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                  }`}
                >
                  {opt.value === "80mm" ? "80mm" : opt.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setPreviewOpen(true)}
              className="flex items-center gap-1.5 rounded-full bg-gray-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-gray-800 dark:bg-gray-800 dark:hover:bg-gray-700"
            >
              <TbBook2 className="size-4" /> Preview
            </button>
            <button
              onClick={handleDownloadPdf}
              disabled={pdfBusy}
              className="flex items-center gap-1.5 rounded-full bg-gray-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-800 dark:hover:bg-gray-700"
            >
              <LuFileDown className="size-4" /> {pdfBusy ? "Generating..." : "PDF"}
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 rounded-full bg-gray-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-gray-800 dark:bg-gray-800 dark:hover:bg-gray-700"
            >
              <IoIosPrint className="size-4" /> Print
            </button>
            <button
              onClick={() => setDrawerOpen((v) => !v)}
              className="flex items-center gap-1.5 rounded-full bg-brand-500 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-brand-600"
            >
              <MdOutlineFilterAlt className="size-4" />
              Filters
              {activeFilterCount > 0 && (
                <span className="flex size-4 items-center justify-center rounded-full bg-white text-[10px] font-bold text-brand-600">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Canvas */}
        <div className="no-scrollbar flex-1 overflow-y-auto bg-gray-100 px-3 py-4 dark:bg-gray-950 sm:px-8 sm:py-6 print:overflow-visible print:bg-white print:p-0 print:dark:bg-white">
          <div
            className="w-full rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6 print:rounded-none print:border-0 print:p-0 print:shadow-none dark:border-gray-800 dark:bg-gray-900 print:dark:bg-white"
            ref={printRef}
          >
            {/* Letterhead */}
            <div className="sheet-header hidden print:flex">
              {header?.logo ? (
                <img src={header.logo} alt={header.storeName} crossOrigin="anonymous" className="sheet-logo" />
              ) : (
                <div className="sheet-logo-fallback">{(header?.storeName ?? "?").charAt(0)}</div>
              )}
              <div className="sheet-header-text">
                <div className="title">{header?.storeName ?? "—"}</div>
                <div className="company">{header?.storeName ?? "—"}</div>
                <div className="subtitle">
                  {[header?.address, header?.phone, header?.email].filter(Boolean).join(" · ")}
                </div>
              </div>
              <div className="sheet-doc-label">Product Ledger</div>
            </div>
            <div className="period-row hidden print:flex">
              <span>
                DATE PERIOD: <strong>{startDate || "—"}</strong> TO <strong>{endDate || "—"}</strong>
              </span>
              <span>FILTER: {filterLabel.toUpperCase()}</span>
            </div>

            <div className="flex items-center gap-4 border-b border-gray-200 pb-4 dark:border-gray-800 print:hidden">
              {header?.logo ? (
                <span className="flex size-24 shrink-0 items-center justify-center rounded-full border border-gray-100 p-3 dark:border-gray-700">
                  <img src={header.logo} alt={header.storeName} className="size-full rounded-full object-contain" />
                </span>
              ) : (
                <span className="flex size-20 shrink-0 items-center justify-center rounded-full border border-gray-100 bg-brand-500 text-white dark:border-gray-700">
                  <TbBook2 className="size-7" />
                </span>
              )}
              <div className="min-w-0 text-left">
                <p className="truncate text-xl font-extrabold tracking-tight text-brand-600 dark:text-brand-400">
                  {header?.storeName ?? "Loading store info..."}
                </p>
                {header?.address && (
                  <p className="mt-1 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">{header.address}</p>
                )}
                {header?.phone && (
                  <p className="text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">{header.phone}</p>
                )}
                {header?.email && (
                  <p className="text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">{header.email}</p>
                )}
              </div>
              <span className="ml-auto shrink-0 self-start text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Product Ledger
              </span>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400 print:hidden">
              <span>
                Period:{" "}
                <strong className="text-gray-700 dark:text-gray-200">{startDate || "All time"}</strong>
                {endDate ? (
                  <>
                    {" "}
                    to <strong className="text-gray-700 dark:text-gray-200">{endDate}</strong>
                  </>
                ) : null}
              </span>
              <span>
                Item: <strong className="text-gray-700 dark:text-gray-200">{filterLabel}</strong>
              </span>
            </div>

            {/* Summary tiles */}
            {totals && itemKey && (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 print:hidden">
                {[
                  { label: "Movements", value: totals.count },
                  { label: "Stock In", value: totals.totalStockIn, tone: "in" },
                  { label: "Stock Out", value: totals.totalStockOut, tone: "out" },
                  { label: "Balance", value: totals.balance },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-center dark:border-gray-700 dark:bg-gray-800"
                  >
                    <p className="text-xs text-gray-500 dark:text-gray-400">{s.label}</p>
                    <p
                      className={`mt-0.5 text-base font-bold ${
                        s.tone === "in"
                          ? "text-emerald-600 dark:text-emerald-400"
                          : s.tone === "out"
                            ? "text-red-600 dark:text-red-400"
                            : "text-gray-800 dark:text-gray-100"
                      }`}
                    >
                      {money(s.value)}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Table */}
            <div className="mt-5 overflow-x-auto rounded-xl print:overflow-visible">
              <div className="overflow-x-auto print:overflow-visible">
                <table className="w-full min-w-[720px] print:min-w-0">
                  <thead>
                    <tr className="bg-brand-50 dark:bg-brand-500/10">
                      <th className="whitespace-nowrap border-b border-gray-200 px-3 py-3 text-left text-xs font-semibold uppercase text-gray-700 dark:border-gray-700 dark:text-gray-300">
                        SL
                      </th>
                      {visibleCols.map((c) => (
                        <th
                          key={c.key}
                          className={`whitespace-nowrap border-b border-gray-200 px-3 py-3 text-xs font-semibold uppercase text-gray-700 dark:border-gray-700 dark:text-gray-300 ${
                            TEXT_COLUMNS.includes(c.key) ? "text-left" : "text-right"
                          }`}
                        >
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {!itemKey ? (
                      <tr>
                        <td colSpan={visibleCols.length + 1} className="py-16 text-center text-sm text-gray-500 dark:text-gray-400">
                          Select a product or variant from Filters to view its ledger.
                        </td>
                      </tr>
                    ) : isLoading ? (
                      <tr>
                        <td colSpan={visibleCols.length + 1} className="py-16 text-center">
                          <div className="mx-auto size-8 animate-spin rounded-full border-4 border-brand-500/20 border-t-brand-500" />
                        </td>
                      </tr>
                    ) : isError ? (
                      <tr>
                        <td colSpan={visibleCols.length + 1} className="py-16 text-center text-sm font-medium text-red-500">
                          Failed to load ledger.
                        </td>
                      </tr>
                    ) : rows.length === 0 ? (
                      <tr>
                        <td colSpan={visibleCols.length + 1} className="py-16 text-center text-gray-500 dark:text-gray-400">
                          No movement found
                        </td>
                      </tr>
                    ) : (
                      rows.map((row, idx) => (
                        <tr
                          key={row._id}
                          className={`border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-white/[0.02] ${idx % 2 === 1 ? "bg-gray-50/50 dark:bg-white/[0.01]" : ""}`}
                        >
                          <td className="px-3 py-2.5 text-left text-xs text-gray-500">{row.sl}</td>
                          {visibleColumns.date && (
                            <td className="whitespace-nowrap px-3 py-2.5 text-left text-xs text-gray-700 dark:text-gray-300">
                              {row.date ? new Date(row.date).toLocaleDateString() : "-"}
                            </td>
                          )}
                          {visibleColumns.action && (
                            <td
                              className={`whitespace-nowrap px-3 py-2.5 text-left text-xs font-medium ${
                                IN_ACTIONS.has(row.action)
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : "text-red-600 dark:text-red-400"
                              }`}
                            >
                              {row.action}
                            </td>
                          )}
                          {visibleColumns.reference && (
                            <td className="whitespace-nowrap px-3 py-2.5 text-left text-xs text-gray-500 dark:text-gray-400">
                              {row.reference || "-"}
                            </td>
                          )}
                          {visibleColumns.stockIn && (
                            <td className="px-3 py-2.5 text-right text-xs text-gray-700 dark:text-gray-300">
                              {row.stockIn}
                            </td>
                          )}
                          {visibleColumns.stockOut && (
                            <td className="px-3 py-2.5 text-right text-xs text-gray-700 dark:text-gray-300">
                              {row.stockOut}
                            </td>
                          )}
                          {visibleColumns.balance && (
                            <td className="px-3 py-2.5 text-right text-xs font-semibold text-gray-800 dark:text-gray-100">
                              {row.balance}
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                  {totals && rows.length > 0 && (
                    <tfoot>
                      <tr className="total-row bg-gray-100 font-semibold dark:bg-gray-800">
                        <td
                          colSpan={
                            1 +
                            COLUMN_DEFS.filter((c) => visibleColumns[c.key] && TEXT_COLUMNS.includes(c.key)).length
                          }
                          className="px-3 py-3 text-right text-xs text-gray-700 dark:text-gray-200"
                        >
                          Total
                        </td>
                        {visibleColumns.stockIn && (
                          <td className="px-3 py-3 text-right text-xs text-gray-800 dark:text-gray-100">
                            {totals.totalStockIn}
                          </td>
                        )}
                        {visibleColumns.stockOut && (
                          <td className="px-3 py-3 text-right text-xs text-gray-800 dark:text-gray-100">
                            {totals.totalStockOut}
                          </td>
                        )}
                        {visibleColumns.balance && (
                          <td className="px-3 py-3 text-right text-xs text-gray-800 dark:text-gray-100">
                            {totals.balance}
                          </td>
                        )}
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>

            <div className="footer-note hidden print:flex">
              <span>Generated: {new Date().toLocaleString()}</span>
              <span>
                {header?.storeName ?? "—"} — {new Date().getFullYear()}
              </span>
              <span className="footer-page-count">Page 1 of 1</span>
            </div>
          </div>
        </div>

        {/* Preview modal */}
        <div
          className={
            previewOpen
              ? "fixed inset-0 z-[100010] flex flex-col items-center bg-black/60 py-6 print:hidden"
              : "contents"
          }
          onClick={() => setPreviewOpen(false)}
        >
          {previewOpen && (
            <div onClick={(e) => e.stopPropagation()} className="mb-3 flex shrink-0 items-center gap-2">
              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-semibold text-gray-800 shadow-lg hover:bg-gray-100"
              >
                <IoIosPrint className="size-4" /> Print
              </button>
              <button
                onClick={handleDownloadPdf}
                disabled={pdfBusy}
                className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-semibold text-gray-800 shadow-lg hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <LuFileDown className="size-4" /> {pdfBusy ? "Generating..." : "PDF"}
              </button>
              <button
                onClick={() => setPreviewOpen(false)}
                className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-semibold text-gray-800 shadow-lg hover:bg-gray-100"
              >
                <MdClose className="size-4" /> Close
              </button>
            </div>
          )}

          {previewOpen && !isThermal && (
            <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div
                className="mx-auto bg-white shadow-lg"
                style={{
                  width: `${pageSizeMm[pageFormat].width}mm`,
                  minHeight: `${pageSizeMm[pageFormat].height}mm`,
                }}
              >
                <div
                  className={`paper-preview-body p-[12mm] text-black ${pageFormat === "a5" ? "paper-a5" : ""}`}
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              </div>
            </div>
          )}

          <div
            className={previewOpen && isThermal ? "no-scrollbar min-h-0 flex-1 overflow-y-auto" : "contents"}
            onClick={(e) => previewOpen && isThermal && e.stopPropagation()}
          >
            {/* Thermal (80mm) receipt layout — off-screen unless previewing. */}
            <div
              ref={thermalRef}
              className={`w-[80mm] bg-white px-3 py-4 text-black ${
                previewOpen && isThermal ? "relative shadow-lg" : "pointer-events-none fixed left-[-9999px] top-0"
              }`}
            >
              <div className="th-header">
                <div className="th-company">{header?.storeName ?? "—"}</div>
                <div className="th-subtitle">{header?.address}</div>
                <div className="th-title">Product Ledger</div>
              </div>
              <div className="th-period">
                {startDate || "All time"}
                {endDate ? ` to ${endDate}` : ""}
                <br />
                {filterLabel}
              </div>

              {rows.map((row) => (
                <div key={row._id} className="th-block">
                  <div className="th-row">
                    <span className="th-label">
                      #{row.sl} {row.action}
                    </span>
                    <span className="th-label">
                      {row.date ? new Date(row.date).toLocaleDateString() : "-"}
                    </span>
                  </div>
                  <div className="th-row">
                    <span className="th-label">Ref</span>
                    <span className="th-label">{row.reference || "-"}</span>
                  </div>
                  <div className="th-row">
                    <span className="th-label">In / Out</span>
                    <span className="th-value">
                      {row.stockIn} / {row.stockOut}
                    </span>
                  </div>
                  <div className="th-row">
                    <span className="th-label">Balance</span>
                    <span className="th-value">{row.balance}</span>
                  </div>
                </div>
              ))}

              {totals && (
                <div className="th-summary">
                  <div className="th-summary-row">
                    <span>Movements</span>
                    <span>{totals.count}</span>
                  </div>
                  <div className="th-summary-row">
                    <span>Stock In</span>
                    <span>{totals.totalStockIn}</span>
                  </div>
                  <div className="th-summary-row">
                    <span>Stock Out</span>
                    <span>{totals.totalStockOut}</span>
                  </div>
                  <div className="th-summary-row th-grand">
                    <span>Balance</span>
                    <span>{totals.balance}</span>
                  </div>
                </div>
              )}

              <p className="th-footer">Generated: {new Date().toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Report Settings drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-[100000] bg-black/30 print:hidden" onClick={() => setDrawerOpen(false)} />
      )}
      <aside
        className={`no-scrollbar fixed inset-y-0 right-0 z-[100001] w-80 max-w-[85vw] overflow-y-auto border-l border-gray-200 bg-brand-50 transition-transform print:hidden dark:border-gray-800 dark:bg-gray-900 shadow-2xl ${
          drawerOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-brand-100 bg-brand-500 px-4 py-3.5 dark:border-gray-800">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <MdOutlineFilterAlt className="size-4" />
            Report Settings
          </div>
          <button onClick={() => setDrawerOpen(false)} className="text-white/70 hover:text-white">
            <MdClose className="size-5" />
          </button>
        </div>

        <div className="space-y-5 p-4">
          {/* Item picker — the ledger needs exactly one item */}
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
              Product / Variant
            </p>
            <input
              type="text"
              value={itemSearch}
              onChange={(e) => setItemSearch(e.target.value)}
              placeholder="Filter list by name or barcode..."
              className="mb-2 w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-700 outline-none focus:border-brand-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            />
            <SearchableSelect
              options={itemOptions}
              value={itemKey}
              onChange={(v) => setItemKey(v)}
              placeholder="Select a product / variant"
              searchPlaceholder="Search name or barcode..."
            />
          </div>

          {/* Date range — optional; leaving it blank shows every movement */}
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
              Date Range (optional)
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-gray-500 dark:text-gray-400">From</label>
                <div className="relative">
                  <input
                    ref={startDateRef}
                    type="date"
                    value={startDate}
                    max={endDate || undefined}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="input-date-icon w-full rounded-lg border border-gray-200 px-2.5 py-1.5 pr-8 text-xs text-gray-700 outline-none focus:border-brand-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                  />
                  <button
                    type="button"
                    onClick={() => startDateRef.current?.showPicker?.()}
                    className="absolute right-1.5 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md bg-brand-500 text-white hover:bg-brand-600"
                    tabIndex={-1}
                  >
                    <MdCalendarToday className="size-3.5" />
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-gray-500 dark:text-gray-400">To</label>
                <div className="relative">
                  <input
                    ref={endDateRef}
                    type="date"
                    value={endDate}
                    min={startDate || undefined}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="input-date-icon w-full rounded-lg border border-gray-200 px-2.5 py-1.5 pr-8 text-xs text-gray-700 outline-none focus:border-brand-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                  />
                  <button
                    type="button"
                    onClick={() => endDateRef.current?.showPicker?.()}
                    className="absolute right-1.5 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md bg-brand-500 text-white hover:bg-brand-600"
                    tabIndex={-1}
                  >
                    <MdCalendarToday className="size-3.5" />
                  </button>
                </div>
              </div>
            </div>
            {(startDate || endDate) && (
              <button
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                }}
                className="mt-2 text-[11px] font-medium text-brand-500 hover:text-brand-600"
              >
                Clear dates
              </button>
            )}
          </div>

          {/* Visible columns */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                Visible Columns
              </p>
              <div className="flex items-center gap-2 text-[11px] font-medium">
                <button onClick={() => setAllColumns(true)} className="text-brand-500 hover:text-brand-600">
                  Show All
                </button>
                <span className="text-gray-300 dark:text-gray-600">|</span>
                <button onClick={() => setAllColumns(false)} className="text-gray-400 hover:text-gray-600">
                  Hide All
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              {COLUMN_DEFS.map((c) => (
                <label
                  key={c.key}
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/[0.03]"
                >
                  <input
                    type="checkbox"
                    checked={visibleColumns[c.key]}
                    onChange={(e) => setVisibleColumns((prev) => ({ ...prev, [c.key]: e.target.checked }))}
                    className="size-3.5 rounded border-gray-300 text-brand-500 focus:ring-brand-400"
                  />
                  {c.label}
                </label>
              ))}
            </div>
          </div>
        </div>
      </aside>
    </div>,
    portalTarget,
  );
};

export default ProductLedgerReport;
