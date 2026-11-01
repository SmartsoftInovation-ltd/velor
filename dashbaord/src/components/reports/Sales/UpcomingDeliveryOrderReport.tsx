import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import toast from "react-hot-toast";
import axiosSecure from "../../../hooks/useAxiosSecure";
import PageMeta from "../../common/PageMeta";
import NiceSelect from "../../form/NiceSelect";

import { IoIosPrint } from "react-icons/io";
import { MdChevronLeft, MdChevronRight, MdClose, MdOutlineFilterAlt } from "react-icons/md";
import { TbReceipt2 } from "react-icons/tb";
import { LuFileDown } from "react-icons/lu";
import ReportDateField from "../../form/ReportDateField";
import { useReportPrintAll, useRunWhenAllRowsReady } from "../../../hooks/useReportPrintAll";
import { sheetToPdf } from "../../../utils/sheetPdf";

// ---------- Types ----------
interface ProductLine {
  // null when the detail is missing on the sale line and in the catalogue
  productName: string | null;
  barcode: string | null;
  color: string | null;
  size: string | null;
  qty: number;
}

interface OrderRow {
  _id: string;
  invoiceNumber: string;
  salesType: string;
  date: string;
  deliveryDate: string;
  customerName: string | null;
  customerPhone: string | null;
  remark: string | null;
  products: ProductLine[];
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
  rows: OrderRow[];
  totals: { count: number; totalQty: number };
  pagination: { total: number; page: number; limit: number; totalPages: number; hasNextPage: boolean };
  generatedAt?: string;
}

// ---------- Static config ----------
const LIMIT = 25;

const salesTypeLabel: Record<string, string> = {
  retailsale: "Retail Sale",
  wholesale: "Wholesale",
  retailsaleorder: "Retail Sale Order",
  wholesaleorder: "Wholesale Order",
};

const salesTypeOptions = [
  { value: "", label: "All Types" },
  { value: "retailsale", label: "Retail Sale" },
  { value: "wholesale", label: "Wholesale" },
  { value: "retailsaleorder", label: "Retail Sale Order" },
  { value: "wholesaleorder", label: "Wholesale Order" },
];

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

// Deliveries lie ahead, so the presets look forward from today.
type DatePreset = "today" | "next7" | "next30" | "thisMonth" | "custom";

const datePresets: { value: DatePreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "next7", label: "Next 7 Days" },
  { value: "next30", label: "Next 30 Days" },
  { value: "thisMonth", label: "This Month" },
  { value: "custom", label: "Custom Range" },
];

const toISODate = (d: Date) => d.toISOString().split("T")[0];

const rangeForPreset = (preset: DatePreset): { start: string; end: string } => {
  const today = new Date();
  const start = toISODate(today);
  switch (preset) {
    case "today":
      return { start, end: start };
    case "next30": {
      const e = new Date(today);
      e.setDate(e.getDate() + 29);
      return { start, end: toISODate(e) };
    }
    case "thisMonth":
      return {
        start: toISODate(new Date(today.getFullYear(), today.getMonth(), 1, 12)),
        end: toISODate(new Date(today.getFullYear(), today.getMonth() + 1, 0, 12)),
      };
    case "next7":
    default: {
      const e = new Date(today);
      e.setDate(e.getDate() + 6);
      return { start, end: toISODate(e) };
    }
  }
};

const COLUMN_DEFS = [
  { key: "invoice", label: "Invoice No" },
  { key: "invoiceDate", label: "Invoice Date" },
  { key: "deliveryDate", label: "Delivery Date" },
  { key: "customer", label: "Customer Info" },
  { key: "products", label: "Product Description" },
  { key: "remarks", label: "Remarks" },
] as const;

type ColumnKey = (typeof COLUMN_DEFS)[number]["key"];

const NA = "N/A";

// One product of an order, as the lines of its description cell.
const productLines = (p: ProductLine) => [
  `Product Name: ${p.productName || NA}`,
  `Barcode: ${p.barcode || NA}`,
  `Color: ${p.color || NA}`,
  `Size: ${p.size || NA}`,
  `Qty: ${p.qty ?? 0}`,
];

const formatDate = (dateStr?: string): string => {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

// ---------- Component ----------
const UpcomingDeliveryOrderReport = () => {
  const navigate = useNavigate();
  const printRef = useRef<HTMLDivElement>(null);
  const thermalRef = useRef<HTMLDivElement>(null);

  const initialRange = rangeForPreset("next7");
  const [datePreset, setDatePreset] = useState<DatePreset>("next7");
  const [startDate, setStartDate] = useState(initialRange.start);
  const [endDate, setEndDate] = useState(initialRange.end);
  // Free-text customer name / phone / invoice number search.
  const [customerNameInput, setCustomerNameInput] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [salesType, setSalesType] = useState("");
  const [page, setPage] = useState(1);
  // The drawer overlays the report at every width, so it starts closed —
  // opening it on load would cover the sheet before it has been read.
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pageFormat, setPageFormat] = useState<PageFormat>("a4");
  const [previewOpen, setPreviewOpen] = useState(false);
  // Preview, Print and PDF cover every row, not just this page
  const printAllCtl = useReportPrintAll(previewOpen);
  const { printAll } = printAllCtl;
  const [previewHtml, setPreviewHtml] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Record<ColumnKey, boolean>>(
    Object.fromEntries(COLUMN_DEFS.map((c) => [c.key, true])) as Record<ColumnKey, boolean>,
  );

  const applyPreset = (preset: DatePreset) => {
    setDatePreset(preset);
    if (preset === "custom") return;
    const r = rangeForPreset(preset);
    setStartDate(r.start);
    setEndDate(r.end);
    setPage(1);
  };

  // Printing happens straight from the live page (native browser preview),
  // so the sidebar/header outside this component's own DOM must be hidden
  // too. Scoped to a body class instead of a global print rule so it only
  // applies while this report is mounted.
  // Esc closes the filters drawer.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  // Esc closes the preview. Bound only while it is open so it cannot swallow
  // Esc from the filters drawer.
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


  // Debounce the typed name so each keystroke does not fire its own request.
  useEffect(() => {
    const t = setTimeout(() => {
      setCustomerName(customerNameInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [customerNameInput]);

  const filters = { startDate, endDate, salesType, search: customerName };

  const { data, isLoading, isError, isFetching } = useQuery<ReportData>({
    queryKey: ["upcoming-delivery-order-report", filters, page, printAll],
    queryFn: async () => {
      const res = await axiosSecure.post(
        `/report/upcoming-delivery-order${printAll ? "?all=1" : `?page=${page}&limit=${LIMIT}`}`,
        filters,
      );
      return res.data.data as ReportData;
    },
    placeholderData: keepPreviousData,
  });

  const header = data?.header;
  const generatedOn = new Date(data?.generatedAt ?? Date.now()).toLocaleString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const totals = data?.totals;
  const pagination = data?.pagination;
  const rows = data?.rows ?? [];
  useRunWhenAllRowsReady(printAllCtl, printAll && !isFetching && !!data);

  const filterChips: string[] = [];
  if (customerName) filterChips.push(`"${customerName}"`);
  if (salesType) filterChips.push(salesTypeLabel[salesType] ?? salesType);
  const filterLabel = filterChips.length > 0 ? filterChips.join(", ") : "All";

  const activeFilterCount = [customerName, salesType].filter(Boolean).length;

  const visibleCols = COLUMN_DEFS.filter((c) => visibleColumns[c.key]);

  const setAllColumns = (value: boolean) => {
    setVisibleColumns(Object.fromEntries(COLUMN_DEFS.map((c) => [c.key, value])) as Record<ColumnKey, boolean>);
  };

  const isThermal = pageFormat === "80mm";

  // Snapshot the live A4/A5 sheet whenever the preview opens or the data
  // behind it changes. The sheet's print-only pieces (letterhead, period row)
  // are `hidden print:flex`, which would stay hidden inside the modal, so the
  // copy strips those Tailwind gates to show the sheet as it will print.
  useEffect(() => {
    if (!previewOpen || isThermal || !printRef.current) return;
    const html = printRef.current.innerHTML
      .replace(/hidden print:flex/g, "flex")
      .replace(/hidden print:block/g, "block")
      .replace(/hidden print:table-cell/g, "table-cell")
      .replace(/hidden print:table-row/g, "table-row")
      .replace(/hidden preview-only/g, "flex")
      .replace(/print:hidden/g, "hidden")
      .replace(/overflow-x-auto/g, "overflow-visible")
      .replace(/min-w-\[\d+px\]/g, "min-w-0");
    setPreviewHtml(html);
  }, [previewOpen, isThermal, pageFormat, data, visibleColumns]);

  // Reactive @page size — printing straight from the live page (Ctrl+P / the
  // Print button) uses the browser's own native print preview, so the sheet
  // must already be styled correctly in this document rather than copied into
  // a popup. Only one of .report-print-a4 / .report-print-80mm is present in
  // the DOM at a time (see the two source blocks below), so this purely picks
  // the page geometry.
  useEffect(() => {
    const styleEl = document.createElement("style");
    styleEl.id = "report-print-page-size";
    // Empty margin boxes suppress the browser's own injected header/footer
    // (date, document title, URL, page numbers) in Chromium-based browsers.
    const blankMarginBoxes = `
      @top-left { content: ""; } @top-center { content: ""; } @top-right { content: ""; }
      @bottom-left { content: ""; } @bottom-right { content: ""; }
    `;
    // A4/A5 put "generated on | page X of Y" in the bottom margin of every
    // printed page; counter(pages) is the real sheet count, not the API page.
    const footerBox = `@bottom-center {
        content: "GENERATED ON : ${generatedOn.replace(/"/g, "")}   |   PAGE " counter(page) " OF " counter(pages);
        font-size: 8px; font-weight: 600; color: #4b5563;
      }`;
    styleEl.textContent = isThermal
      ? `@page { size: 80mm auto; margin: 3mm; ${blankMarginBoxes} @bottom-center { content: ""; } }`
      : `@page { size: ${pageFormat}; margin: 12mm 12mm 14mm; ${blankMarginBoxes} ${footerBox} }`;
    document.head.appendChild(styleEl);
    return () => {
      styleEl.remove();
    };
  }, [pageFormat, isThermal, generatedOn]);

  const handlePrint = () => printAllCtl.run(() => window.print());

  const downloadPdfNow = async () => {
    const source = isThermal ? thermalRef.current : printRef.current;
    if (!source) return;
    setPdfBusy(true);
    try {
      // Page by page, so a report of any length fits (see utils/sheetPdf)
      const pdf = await sheetToPdf(source, pageFormat);

      pdf.save(`upcoming-delivery-order-report-${startDate}-to-${endDate}.pdf`);
      toast.success("Report PDF downloaded");
    } catch {
      toast.error("Could not generate the PDF.");
    } finally {
      setPdfBusy(false);
    }
  };

  const handleDownloadPdf = () => printAllCtl.run(downloadPdfNow);


  const portalTarget = document.getElementById("app-content-portal-target");
  if (!portalTarget) return null;

  return createPortal(
    <div className="flex h-[calc(100vh-72px)] gap-0 print:block print:h-auto">
      <PageMeta title="Upcoming Delivery Order Report - Baig Ecommerce" description="Pending sales due for delivery in the period, with customer and product details" />

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
              <TbReceipt2 className="size-4" /> Preview
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
            className="mx-auto max-w-[1600px] rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6 print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none dark:border-gray-800 dark:bg-gray-900 print:dark:bg-white"
            ref={printRef}
          >
            <div className="flex items-center gap-4 border-b border-gray-200 pb-4 dark:border-gray-800 print:hidden">
              {header?.logo ? (
                <span className="flex size-24 shrink-0 items-center justify-center rounded-full border border-gray-100 p-3 dark:border-gray-700">
                  <img
                    src={header.logo}
                    alt={header.storeName}
                    className="size-full rounded-full object-contain"
                  />
                </span>
              ) : (
                <span className="flex size-20 shrink-0 items-center justify-center rounded-full border border-gray-100 bg-brand-500 text-white dark:border-gray-700">
                  <TbReceipt2 className="size-7" />
                </span>
              )}
              <div className="min-w-0 text-left">
                <p className="truncate text-xl font-extrabold tracking-tight text-brand-600 dark:text-brand-400">
                  {header?.storeName ?? "Loading store info..."}
                </p>
                {header?.address && (
                  <p className="mt-1 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
                    {header.address}
                  </p>
                )}
                {header?.phone && (
                  <p className="text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
                    {header.phone}
                  </p>
                )}
                {header?.email && (
                  <p className="text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
                    {header.email}
                  </p>
                )}
              </div>
            </div>

            <h1 className="mt-4 text-center text-base font-bold uppercase tracking-wide text-gray-800 dark:text-gray-100 print:hidden">
              Upcoming Delivery Order
            </h1>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400 print:hidden">
              <span>
                Period: <strong className="text-gray-700 dark:text-gray-200">{startDate}</strong> to{" "}
                <strong className="text-gray-700 dark:text-gray-200">{endDate}</strong>
              </span>
              <span>
                Filter: <strong className="text-gray-700 dark:text-gray-200">{filterLabel}</strong>
              </span>
            </div>

            {/* Summary tiles */}
            {totals && (
              <div className="mt-4 grid grid-cols-2 gap-3 print:hidden">
                {([
                  { label: "Orders", value: totals.count },
                  { label: "Total Qty", value: totals.totalQty },
                ] as { label: string; value: number }[]).map((s) => (
                  <div key={s.label} className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-center dark:border-gray-700 dark:bg-gray-800">
                    <p className="text-xs text-gray-500 dark:text-gray-400">{s.label}</p>
                    <p className="mt-0.5 text-base font-bold text-gray-800 dark:text-gray-100">
                      {s.value}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Table */}
            <div className="mt-5 overflow-x-auto rounded-xl print:overflow-visible">
              <div className="overflow-x-auto print:overflow-visible">
                <table className="w-full min-w-[900px] print:min-w-0">
                  <thead>
                    {/* Letterhead lives inside <thead> so the browser repeats
                        it at the top of every printed page with the column
                        headings. Print-only; the screen shows its own header. */}
                    <tr className="hidden print:table-row">
                      <th colSpan={visibleCols.length + 1} className="sheet-head-cell">
                        <div className="sheet-header">
                          {header?.logo ? (
                            <img src={header.logo} alt={header.storeName} crossOrigin="anonymous" className="sheet-logo" />
                          ) : (
                            <div className="sheet-logo-fallback">{(header?.storeName ?? "?").charAt(0)}</div>
                          )}
                          <div className="sheet-header-text">
                            <div className="title">{header?.storeName ?? "—"}</div>
                            <div className="subtitle">
                              {[header?.phone, header?.secondaryPhone, header?.email, header?.address].filter(Boolean).join(" · ")}
                            </div>
                          </div>
                          <div className="sheet-doc-label">Upcoming Delivery Order</div>
                        </div>
                        <div className="period-row">
                          <span>
                            DATE PERIOD: <strong>{startDate}</strong> TO <strong>{endDate}</strong>
                          </span>
                          <span>
                            FILTER: <strong>{filterLabel.toUpperCase()}</strong>
                          </span>
                        </div>
                      </th>
                    </tr>
                    <tr className="bg-brand-50 dark:bg-brand-500/10">
                      <th className="whitespace-nowrap border-b border-gray-200 px-3 py-3 text-left text-xs font-semibold uppercase text-gray-700 dark:border-gray-700 dark:text-gray-300">
                        SL
                      </th>
                      {visibleCols.map((c) => (
                        <th
                          key={c.key}
                          className="whitespace-nowrap border-b border-gray-200 px-3 py-3 text-left text-xs font-semibold uppercase text-gray-700 dark:border-gray-700 dark:text-gray-300"
                        >
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr>
                        <td colSpan={visibleCols.length + 1} className="py-16 text-center">
                          <div className="mx-auto size-8 animate-spin rounded-full border-4 border-brand-500/20 border-t-brand-500" />
                        </td>
                      </tr>
                    ) : isError ? (
                      <tr>
                        <td colSpan={visibleCols.length + 1} className="py-16 text-center text-sm font-medium text-red-500">
                          Failed to load report.
                        </td>
                      </tr>
                    ) : rows.length === 0 ? (
                      <tr>
                        <td colSpan={visibleCols.length + 1} className="py-16 text-center text-gray-500 dark:text-gray-400">
                          No data found
                        </td>
                      </tr>
                    ) : (
                      rows.map((row, idx) => (
                        <tr
                          key={row._id}
                          className={`border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-white/[0.02] ${idx % 2 === 1 ? "bg-gray-50/50 dark:bg-white/[0.01]" : ""}`}
                        >
                          <td className="px-3 py-2.5 text-left text-xs text-gray-500">
                            {(pagination ? (pagination.page - 1) * pagination.limit : 0) + idx + 1}
                          </td>
                          {visibleColumns.invoice && (
                            <td className="whitespace-nowrap px-3 py-2.5 text-left align-top text-xs font-medium text-brand-600 dark:text-brand-400">
                              <div>{row.invoiceNumber || NA}</div>
                              <div className="text-[11px] font-normal text-gray-400 dark:text-gray-500">
                                {salesTypeLabel[row.salesType] ?? row.salesType ?? NA}
                              </div>
                            </td>
                          )}
                          {visibleColumns.invoiceDate && (
                            <td className="whitespace-nowrap px-3 py-2.5 text-left align-top text-xs text-gray-600 dark:text-gray-300">
                              {formatDate(row.date)}
                            </td>
                          )}
                          {visibleColumns.deliveryDate && (
                            <td className="whitespace-nowrap px-3 py-2.5 text-left align-top text-xs font-semibold text-gray-700 dark:text-gray-200">
                              {formatDate(row.deliveryDate)}
                            </td>
                          )}
                          {visibleColumns.customer && (
                            <td className="px-3 py-2.5 text-left align-top text-xs text-gray-700 dark:text-gray-300">
                              <div>{row.customerName || NA}</div>
                              <div className="text-gray-400 dark:text-gray-500">{row.customerPhone || NA}</div>
                            </td>
                          )}
                          {visibleColumns.products && (
                            <td className="px-3 py-2.5 text-left align-top text-xs text-gray-700 dark:text-gray-300">
                              {row.products.length === 0
                                ? NA
                                : row.products.map((p, i) => (
                                    <div key={i} className={i > 0 ? "mt-2 border-t border-dashed border-gray-200 pt-2 dark:border-gray-700" : ""}>
                                      {productLines(p).map((line) => (
                                        <div key={line}>{line}</div>
                                      ))}
                                    </div>
                                  ))}
                            </td>
                          )}
                          {visibleColumns.remarks && (
                            <td className="px-3 py-2.5 text-left align-top text-xs text-gray-700 dark:text-gray-300">
                              {row.remark || NA}
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                  {totals && rows.length > 0 && (
                    <tfoot>
                      <tr className="total-row bg-gray-100 font-semibold dark:bg-gray-800">
                        <td colSpan={visibleCols.length + 1} className="px-3 py-3 text-right text-xs text-gray-700 dark:text-gray-200">
                          Total {totals.count} orders · {totals.totalQty} pcs
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>

            {/* Pagination — always shown */}
            {pagination && (
              <div className="mt-4 flex items-center justify-between print:hidden">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Page {pagination.page} of {pagination.totalPages} · {pagination.total} records
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={pagination.page <= 1 || isFetching}
                    className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
                  >
                    <MdChevronLeft className="size-4" /> Prev
                  </button>
                  <span className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold tabular-nums text-white">
                    {pagination.page}
                  </span>
                  <button
                    onClick={() => setPage((p) => (pagination.hasNextPage ? p + 1 : p))}
                    disabled={!pagination.hasNextPage || isFetching}
                    className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
                  >
                    Next <MdChevronRight className="size-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Preview-only: on paper the same line prints in the page's
                bottom margin box (see the @page effect) so it lands on every
                page with a live page count. */}
            <div className="footer-note hidden preview-only">
              <span>GENERATED ON : {generatedOn}</span>
              <span className="footer-page-count">PAGE 1 OF 1</span>
            </div>
          </div>
        </div>

        {/* Preview modal — an overlay showing either a live copy of the A4/A5
            sheet (see the previewHtml effect above) or the thermal receipt
            below, scaled to the selected page format. Print and PDF inside it
            both act on the real sheet/receipt nodes, so what is previewed is
            exactly what comes out. */}
        <div
          className={
            previewOpen
              ? "fixed inset-0 z-[100010] flex flex-col items-center bg-black/60 py-6 print:hidden"
              : "contents"
          }
          onClick={() => setPreviewOpen(false)}
        >
          {previewOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="mb-3 flex shrink-0 items-center gap-2"
            >
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
            <div
              className="no-scrollbar min-h-0 flex-1 overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="mx-auto bg-white shadow-lg"
                style={{ width: `${pageSizeMm[pageFormat].width}mm`, minHeight: `${pageSizeMm[pageFormat].height}mm` }}
              >
                <div
                  className={`paper-preview-body p-[12mm] text-black ${pageFormat === "a5" ? "paper-a5" : ""}`}
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              </div>
            </div>
          )}

          <div
            className={
              previewOpen && isThermal
                ? "no-scrollbar min-h-0 flex-1 overflow-y-auto"
                : "contents"
            }
            onClick={(e) => previewOpen && isThermal && e.stopPropagation()}
          >
        {/* Thermal (80mm) receipt-style layout — off-screen, used only as the
            html2canvas/print source when Format is set to 80mm Thermal. A wide
            data table can't fit 80mm no matter the font size, so this renders
            each order as a stacked block instead of columns. */}
        <div
          ref={thermalRef}
          className={`w-[80mm] bg-white px-3 py-4 text-black ${
            previewOpen && isThermal ? "relative shadow-lg" : "pointer-events-none fixed left-[-9999px] top-0"
          }`}
        >
          <div className="th-header">
            <div className="th-company">{header?.storeName ?? "—"}</div>
            <div className="th-subtitle">{header?.address}</div>
            <div className="th-title">Upcoming Delivery Order</div>
          </div>
          <div className="th-period">
            {startDate} to {endDate}
            <br />
            Filter: {filterLabel}
          </div>

          {rows.map((row, idx) => (
            <div key={row._id} className="th-block">
              <div className="th-row">
                <span className="th-label">#{idx + 1} {row.invoiceNumber || NA}</span>
                <span className="th-label">{formatDate(row.date)}</span>
              </div>
              <div className="th-row">
                <span className="th-label">Delivery</span>
                <span className="th-value">{formatDate(row.deliveryDate)}</span>
              </div>
              <div className="th-row">
                <span className="th-label">{row.customerName || NA} · {row.customerPhone || NA}</span>
              </div>
              {row.products.map((p, i) => (
                <div key={i} className="th-row">
                  <span className="th-label">{productLines(p).join(" · ")}</span>
                </div>
              ))}
              {row.remark && (
                <div className="th-row">
                  <span className="th-label">Remarks: {row.remark}</span>
                </div>
              )}
            </div>
          ))}

          {totals && (
            <div className="th-summary">
              <div className="th-summary-row">
                <span>Orders</span>
                <span>{totals.count}</span>
              </div>
              <div className="th-summary-row">
                <span>Total Qty</span>
                <span>{totals.totalQty}</span>
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
        <div
          className="fixed inset-0 z-[100000] bg-black/30 print:hidden"
          onClick={() => setDrawerOpen(false)}
        />
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
          {/* Date range */}
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
              Delivery Date
            </p>
            <div className="grid grid-cols-2 gap-2">
              <ReportDateField
                label="From"
                value={startDate}
                max={endDate}
                onChange={(v) => {
                  setStartDate(v);
                  setDatePreset("custom");
                  setPage(1);
                }}
              />
              <ReportDateField
                label="To"
                value={endDate}
                min={startDate}
                onChange={(v) => {
                  setEndDate(v);
                  setDatePreset("custom");
                  setPage(1);
                }}
              />
            </div>
            <div className="mt-2">
              <NiceSelect
                options={datePresets}
                value={datePreset}
                onChange={(v) => applyPreset(v as DatePreset)}
              />
            </div>
          </div>

          {/* Customer / invoice search */}
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
              Search
            </p>
            <input
              type="text"
              value={customerNameInput}
              onChange={(e) => setCustomerNameInput(e.target.value)}
              placeholder="Customer name, mobile or invoice#..."
              className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-700 outline-none focus:border-brand-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            />
          </div>

          {/* Sales Type */}
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
              Sales Type
            </p>
            <NiceSelect
              options={salesTypeOptions}
              value={salesType}
              onChange={(v) => {
                setSalesType(v);
                setPage(1);
              }}
            />
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
                    onChange={(e) =>
                      setVisibleColumns((prev) => ({ ...prev, [c.key]: e.target.checked }))
                    }
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

export default UpcomingDeliveryOrderReport;
