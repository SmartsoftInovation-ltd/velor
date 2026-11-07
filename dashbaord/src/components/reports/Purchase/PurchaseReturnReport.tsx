import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import toast from "react-hot-toast";
import axiosSecure from "../../../hooks/useAxiosSecure";
import useRemoteLookup from "../../../hooks/useRemoteLookup";
import PageMeta from "../../common/PageMeta";
import SearchableSelect from "../../form/SearchableSelect";
import NiceSelect from "../../form/NiceSelect";

import { IoIosPrint } from "react-icons/io";
import { MdChevronLeft, MdChevronRight, MdClose, MdOutlineFilterAlt } from "react-icons/md";
import { TbTruckDelivery } from "react-icons/tb";
import { LuFileDown } from "react-icons/lu";
import ReportDateField from "../../form/ReportDateField";
import { useReportPrintAll, useRunWhenAllRowsReady } from "../../../hooks/useReportPrintAll";
import { sheetToPdf } from "../../../utils/sheetPdf";

// ---------- Types ----------
interface PurchaseReturnRow {
  _id: string;
  date: string;
  returnId: string;
  supplierName: string;
  productName: string;
  barcode: string;
  color: string;
  size: string;
  buyRate: number;
  qty: number;
  total: number;
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
  rows: PurchaseReturnRow[];
  totals: {
    count: number;
    totalBuyRate: number;
    totalQty: number;
    totalAmount: number;
  };
  pagination: { total: number; page: number; limit: number; totalPages: number; hasNextPage: boolean };
}

interface SupplierOption {
  _id: string;
  supplierName: string;
}

interface LookupOption {
  _id: string;
  name: string;
}

// ---------- Static config ----------
const LIMIT = 25;

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

type DatePreset = "today" | "7d" | "30d" | "90d" | "thisMonth" | "custom";

const datePresets: { value: DatePreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
  { value: "90d", label: "Last 90 Days" },
  { value: "thisMonth", label: "This Month" },
  { value: "custom", label: "Custom Range" },
];

const toISODate = (d: Date) => d.toISOString().split("T")[0];

const rangeForPreset = (preset: DatePreset): { start: string; end: string } => {
  const today = new Date();
  const end = toISODate(today);
  switch (preset) {
    case "today":
      return { start: end, end };
    case "7d": {
      const s = new Date(today);
      s.setDate(s.getDate() - 6);
      return { start: toISODate(s), end };
    }
    case "90d": {
      const s = new Date(today);
      s.setDate(s.getDate() - 89);
      return { start: toISODate(s), end };
    }
    case "thisMonth": {
      const s = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start: toISODate(s), end };
    }
    case "30d":
    default: {
      const s = new Date(today);
      s.setDate(s.getDate() - 29);
      return { start: toISODate(s), end };
    }
  }
};

const COLUMN_DEFS = [
  { key: "date", label: "Date" },
  { key: "returnId", label: "Pur Return ID" },
  { key: "supplierName", label: "Supplier Name" },
  { key: "productName", label: "Product Name" },
  { key: "barcode", label: "Barcode" },
  { key: "color", label: "Color" },
  { key: "size", label: "Size" },
  { key: "buyRate", label: "Buy Rate" },
  { key: "qty", label: "Qty" },
  { key: "total", label: "Total" },
] as const;

type ColumnKey = (typeof COLUMN_DEFS)[number]["key"];

// Text columns read left-aligned; every other column holds a number and is
// right-aligned so digits line up by place value. Size sits with the numbers
// in the printed sheet, so it is right-aligned like them.
const TEXT_COLUMNS: ColumnKey[] = [
  "date",
  "returnId",
  "supplierName",
  "productName",
  "barcode",
  "color",
];

const money = (n: number) => (n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 });

// ---------- Component ----------
const PurchaseReturnReport = () => {
  const navigate = useNavigate();
  const printRef = useRef<HTMLDivElement>(null);
  const thermalRef = useRef<HTMLDivElement>(null);

  const initialRange = rangeForPreset("today");
  const [datePreset, setDatePreset] = useState<DatePreset>("today");
  const [startDate, setStartDate] = useState(initialRange.start);
  const [endDate, setEndDate] = useState(initialRange.end);
  const [supplierId, setSupplierId] = useState("");
  const [productId, setProductId] = useState("");
  const [category, setCategory] = useState("");
  const [subCategory, setSubCategory] = useState("");
  const [brand, setBrand] = useState("");
  const [page, setPage] = useState(1);
  // The drawer overlays the report at every width, so it starts closed —
  // opening it on load would cover the sheet before it has been read.
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pageFormat, setPageFormat] = useState<PageFormat>("a4");
  const [previewOpen, setPreviewOpen] = useState(false);
  // Preview, Print and PDF cover every row, not just this page
  const printAllCtl = useReportPrintAll(previewOpen, { sheetRef: printRef, thermalRef });
  const { printAll } = printAllCtl;
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

  // Printing happens straight from the live page (native browser preview),
  // so the sidebar/header outside this component's own DOM must be hidden
  // too. Scoped to a body class instead of a global print rule so it only
  // applies while this report is mounted.
  useEffect(() => {
    document.body.classList.add("printing-report");
    return () => {
      document.body.classList.remove("printing-report");
    };
  }, []);

  const { data: suppliers } = useQuery({
    queryKey: ["purchase-report-suppliers"],
    queryFn: async () => {
      const { data } = await axiosSecure.get("/report/purchase/suppliers");
      return (data.data.suppliers || []) as SupplierOption[];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Searched on the server as the user types: the product list answers one
  // page, so the whole catalogue is never loaded into the browser (BUG-P2-010)
  const productLookup = useRemoteLookup<LookupOption>("report-products", "/product/getproduct", (body) => body?.data?.products as LookupOption[] | undefined);
  const products = productLookup.items;

  const { data: categories } = useQuery({
    queryKey: ["report-categories"],
    queryFn: async () => {
      const { data } = await axiosSecure.get("/categories");
      return (data.data.categories || []) as LookupOption[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: subCategories } = useQuery({
    queryKey: ["report-subcategories"],
    queryFn: async () => {
      const { data } = await axiosSecure.get("/subcategories");
      return (data.data.subcategories || data.data.subCategories || []) as LookupOption[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: brands } = useQuery({
    queryKey: ["report-brands"],
    queryFn: async () => {
      const { data } = await axiosSecure.get("/brand");
      return (data.data.brands || []) as LookupOption[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const supplierOptions = useMemo(
    () => [
      { value: "", label: "All Suppliers" },
      ...(suppliers ?? []).map((s) => ({ value: s._id, label: s.supplierName })),
    ],
    [suppliers],
  );

  const productOptions = useMemo(
    () => [
      { value: "", label: "All Products" },
      ...(products ?? []).map((p) => ({ value: p._id, label: p.name })),
    ],
    [products],
  );

  const categoryOptions = useMemo(
    () => [
      { value: "", label: "All Categories" },
      ...(categories ?? []).map((c) => ({ value: c._id, label: c.name })),
    ],
    [categories],
  );

  const subCategoryOptions = useMemo(
    () => [
      { value: "", label: "All Sub Categories" },
      ...(subCategories ?? []).map((c) => ({ value: c._id, label: c.name })),
    ],
    [subCategories],
  );

  const brandOptions = useMemo(
    () => [
      { value: "", label: "All Brands" },
      ...(brands ?? []).map((b) => ({ value: b._id, label: b.name })),
    ],
    [brands],
  );

  const filters = { startDate, endDate, supplierId, productId, category, subCategory, brand };

  const { data, isLoading, isError, isFetching } = useQuery<ReportData>({
    queryKey: ["purchase-return-report", filters, page, printAll],
    queryFn: async () => {
      const res = await axiosSecure.post(`/report/purchase-return${printAll ? "?all=1" : `?page=${page}&limit=${LIMIT}`}`, filters);
      return res.data.data as ReportData;
    },
    placeholderData: keepPreviousData,
  });

  const header = data?.header;
  const totals = data?.totals;
  const pagination = data?.pagination;
  const rows = data?.rows ?? [];
  useRunWhenAllRowsReady(printAllCtl, printAll && !isFetching && !!data && !isError, printAll && !isFetching && isError);

  const filterChips: string[] = [];
  if (supplierId) {
    const s = suppliers?.find((x) => x._id === supplierId);
    filterChips.push(s ? s.supplierName : "Supplier");
  }
  if (productId) {
    const p = products?.find((x) => x._id === productId);
    filterChips.push(p ? p.name : "Product");
  }
  if (category) {
    const c = categories?.find((x) => x._id === category);
    filterChips.push(c ? c.name : "Category");
  }
  if (subCategory) {
    const c = subCategories?.find((x) => x._id === subCategory);
    filterChips.push(c ? c.name : "Sub Category");
  }
  if (brand) {
    const b = brands?.find((x) => x._id === brand);
    filterChips.push(b ? b.name : "Brand");
  }
  const filterLabel = filterChips.length > 0 ? filterChips.join(", ") : "All Returns";

  const activeFilterCount = [supplierId, productId, category, subCategory, brand].filter(
    Boolean,
  ).length;

  const visibleCols = COLUMN_DEFS.filter((c) => visibleColumns[c.key]);

  const setAllColumns = (value: boolean) => {
    setVisibleColumns(Object.fromEntries(COLUMN_DEFS.map((c) => [c.key, value])) as Record<ColumnKey, boolean>);
  };

  const isThermal = pageFormat === "80mm";

  // Reactive @page size — printing straight from the live page (Ctrl+P / the
  // Print button) uses the browser's own native print preview, so the sheet
  // must already be styled correctly in this document rather than copied into
  // a popup.
  useEffect(() => {
    const styleEl = document.createElement("style");
    styleEl.id = "report-print-page-size";
    // Empty margin boxes suppress the browser's own injected header/footer
    // (date, document title, URL, page numbers) in Chromium-based browsers.
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

  const handlePrint = () => printAllCtl.print(isThermal);

  const downloadPdfNow = async () => {
    const source = printAllCtl.pdfSource(isThermal);
    if (!source) return;
    setPdfBusy(true);
    try {
      // Page by page, so a report of any length fits (see utils/sheetPdf)
      const pdf = await sheetToPdf(source, pageFormat);

      pdf.save(`purchase-return-report-${startDate}-to-${endDate}.pdf`);
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
      <PageMeta title="Purchase Return Report - Baig Ecommerce" description="Purchase return report" />

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
              <TbTruckDelivery className="size-4" /> Preview
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
              <div className="sheet-doc-label">Purchase Return</div>
            </div>
            <div className="period-row hidden print:flex">
              <span>
                DATE PERIOD: <strong>{startDate}</strong> TO <strong>{endDate}</strong>
              </span>
              <span>FILTER: {filterLabel.toUpperCase()}</span>
            </div>

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
                  <TbTruckDelivery className="size-7" />
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
              <span className="ml-auto shrink-0 self-start text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Purchase Return
              </span>
            </div>

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
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 print:hidden">
                {[
                  { label: "Return Items", value: totals.count, isCount: true },
                  { label: "Total Qty", value: totals.totalQty, isCount: true },
                  { label: "Buy Rate", value: totals.totalBuyRate },
                  { label: "Return Total", value: totals.totalAmount, danger: true },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-center dark:border-gray-700 dark:bg-gray-800">
                    <p className="text-xs text-gray-500 dark:text-gray-400">{s.label}</p>
                    <p className={`mt-0.5 text-base font-bold ${s.danger ? "text-red-600 dark:text-red-400" : "text-gray-800 dark:text-gray-100"}`}>
                      {s.isCount ? s.value : `৳${money(s.value)}`}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Table */}
            <div className="mt-5 overflow-x-auto rounded-xl print:overflow-visible">
              <div className="overflow-x-auto print:overflow-visible">
                <table className="w-full min-w-[960px] print:min-w-0">
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
                          key={`${row._id}-${idx}`}
                          className={`border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-white/[0.02] ${idx % 2 === 1 ? "bg-gray-50/50 dark:bg-white/[0.01]" : ""}`}
                        >
                          <td className="px-3 py-2.5 text-left text-xs text-gray-500">
                            {(pagination ? (pagination.page - 1) * pagination.limit : 0) + idx + 1}
                          </td>
                          {visibleColumns.date && (
                            <td className="whitespace-nowrap px-3 py-2.5 text-left text-xs text-gray-700 dark:text-gray-300">
                              {row.date ? new Date(row.date).toLocaleDateString() : "-"}
                            </td>
                          )}
                          {visibleColumns.returnId && (
                            <td className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-medium text-brand-600 dark:text-brand-400">
                              {row.returnId || "-"}
                            </td>
                          )}
                          {visibleColumns.supplierName && (
                            <td className="px-3 py-2.5 text-left text-xs text-gray-700 dark:text-gray-300">
                              {row.supplierName || "-"}
                            </td>
                          )}
                          {visibleColumns.productName && (
                            <td className="px-3 py-2.5 text-left text-xs text-gray-700 dark:text-gray-300">
                              {row.productName || "-"}
                            </td>
                          )}
                          {visibleColumns.barcode && (
                            <td className="whitespace-nowrap px-3 py-2.5 text-left text-xs text-gray-500 dark:text-gray-400">
                              {row.barcode || "-"}
                            </td>
                          )}
                          {visibleColumns.color && (
                            <td className="whitespace-nowrap px-3 py-2.5 text-left text-xs text-gray-700 dark:text-gray-300">
                              {row.color || "-"}
                            </td>
                          )}
                          {visibleColumns.size && (
                            <td className="whitespace-nowrap px-3 py-2.5 text-right text-xs text-gray-700 dark:text-gray-300">
                              {row.size || "-"}
                            </td>
                          )}
                          {visibleColumns.buyRate && (
                            <td className="px-3 py-2.5 text-right text-xs text-gray-700 dark:text-gray-300">
                              {money(row.buyRate)}
                            </td>
                          )}
                          {visibleColumns.qty && (
                            <td className="px-3 py-2.5 text-right text-xs font-medium text-gray-800 dark:text-gray-100">
                              {row.qty ?? 0}
                            </td>
                          )}
                          {visibleColumns.total && (
                            <td className="px-3 py-2.5 text-right text-xs font-medium text-gray-800 dark:text-gray-100">
                              {money(row.total)}
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
                          colSpan={1 + COLUMN_DEFS.filter((c) => visibleColumns[c.key] && TEXT_COLUMNS.includes(c.key)).length}
                          className="px-3 py-3 text-right text-xs text-gray-700 dark:text-gray-200"
                        >
                          Total
                        </td>
                        {visibleColumns.size && (
                          <td className="px-3 py-3 text-right text-xs text-gray-800 dark:text-gray-100">
                            {totals.count}
                          </td>
                        )}
                        {visibleColumns.buyRate && (
                          <td className="px-3 py-3 text-right text-xs text-gray-800 dark:border-gray-700 dark:text-gray-100">
                            {money(totals.totalBuyRate)}
                          </td>
                        )}
                        {visibleColumns.qty && (
                          <td className="px-3 py-3 text-right text-xs text-gray-800 dark:border-gray-700 dark:text-gray-100">
                            {totals.totalQty}
                          </td>
                        )}
                        {visibleColumns.total && (
                          <td className="px-3 py-3 text-right text-xs text-gray-800 dark:border-gray-700 dark:text-gray-100">
                            {money(totals.totalAmount)}
                          </td>
                        )}
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

            <div className="footer-note hidden print:flex">
              <span>Generated: {new Date().toLocaleString()}</span>
              <span>
                {header?.storeName ?? "—"} — {new Date().getFullYear()}
              </span>
              <span className="footer-page-count">
                Page {pagination?.page ?? 1} of {pagination?.totalPages ?? 1}
              </span>
            </div>
          </div>
        </div>

        {/* Preview modal — an overlay showing the snapshot of the A4/A5
            sheet with every row (useReportPrintAll adds the rows as it
            scrolls) or of the thermal receipt. Print and PDF inside it use
            the same snapshot, so what is previewed is exactly what comes out. */}
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
                  ref={printAllCtl.previewRef}
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
                each returned item as a stacked block instead of columns. */}
            {previewOpen && isThermal && (
              <div ref={printAllCtl.thermalPreviewRef} className="w-[80mm] bg-white px-3 py-4 text-black relative shadow-lg" />
            )}
            <div ref={thermalRef} className="w-[80mm] bg-white px-3 py-4 text-black pointer-events-none fixed left-[-9999px] top-0">
              <div className="th-header">
                <div className="th-company">{header?.storeName ?? "—"}</div>
                <div className="th-subtitle">{header?.address}</div>
                <div className="th-title">Purchase Return</div>
              </div>
              <div className="th-period">
                {startDate} to {endDate}
                <br />
                Filter: {filterLabel}
              </div>

              {rows.map((row, idx) => (
                <div key={`${row._id}-${idx}`} className="th-block">
                  <div className="th-row">
                    <span className="th-label">#{idx + 1} {row.returnId || "-"}</span>
                    <span className="th-label">{row.date ? new Date(row.date).toLocaleDateString() : "-"}</span>
                  </div>
                  <div className="th-row">
                    <span className="th-label">{row.productName || "-"}</span>
                    <span className="th-label">{row.barcode || "-"}</span>
                  </div>
                  <div className="th-row">
                    <span className="th-label">{row.supplierName || "-"}</span>
                    <span className="th-label">
                      {[row.color, row.size].filter((v) => v && v !== "-").join(" / ") || "-"}
                    </span>
                  </div>
                  <div className="th-row">
                    <span className="th-label">Buy Rate × Qty</span>
                    <span className="th-value">৳{money(row.buyRate)} × {row.qty ?? 0}</span>
                  </div>
                  <div className="th-row">
                    <span className="th-label">Total</span>
                    <span className="th-value">৳{money(row.total)}</span>
                  </div>
                </div>
              ))}

              {totals && (
                <div className="th-summary">
                  <div className="th-summary-row">
                    <span>Return Items</span>
                    <span>{totals.count}</span>
                  </div>
                  <div className="th-summary-row">
                    <span>Total Qty</span>
                    <span>{totals.totalQty}</span>
                  </div>
                  <div className="th-summary-row">
                    <span>Buy Rate</span>
                    <span>৳{money(totals.totalBuyRate)}</span>
                  </div>
                  <div className="th-summary-row th-grand">
                    <span>Return Total</span>
                    <span>৳{money(totals.totalAmount)}</span>
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
              Date Range
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

          {/* Supplier */}
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
              Supplier
            </p>
            <SearchableSelect
              options={supplierOptions}
              value={supplierId}
              onChange={(v) => {
                setSupplierId(v);
                setPage(1);
              }}
              placeholder="All Suppliers"
              searchPlaceholder="Search supplier..."
            />
          </div>

          {/* Product */}
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
              Product
            </p>
            <SearchableSelect
              options={productOptions}
              value={productId}
              onSearchChange={productLookup.onSearchChange}
              onChange={(v) => {
                productLookup.remember(v);
                setProductId(v);
                setPage(1);
              }}
              placeholder="All Products"
              searchPlaceholder="Search product..."
            />
          </div>

          {/* Category */}
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
              Category
            </p>
            <SearchableSelect
              options={categoryOptions}
              value={category}
              onChange={(v) => {
                setCategory(v);
                setPage(1);
              }}
              placeholder="All Categories"
              searchPlaceholder="Search category..."
            />
          </div>

          {/* Sub Category */}
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
              Sub Category
            </p>
            <SearchableSelect
              options={subCategoryOptions}
              value={subCategory}
              onChange={(v) => {
                setSubCategory(v);
                setPage(1);
              }}
              placeholder="All Sub Categories"
              searchPlaceholder="Search sub category..."
            />
          </div>

          {/* Brand */}
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
              Brand
            </p>
            <SearchableSelect
              options={brandOptions}
              value={brand}
              onChange={(v) => {
                setBrand(v);
                setPage(1);
              }}
              placeholder="All Brands"
              searchPlaceholder="Search brand..."
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

export default PurchaseReturnReport;
