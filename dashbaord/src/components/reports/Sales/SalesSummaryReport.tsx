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
import NiceSelect from "../../form/NiceSelect";

import { IoIosPrint } from "react-icons/io";
import { MdChevronLeft, MdChevronRight, MdClose, MdOutlineFilterAlt } from "react-icons/md";
import { TbReceipt2 } from "react-icons/tb";
import { LuFileDown } from "react-icons/lu";
import ReportDateField from "../../form/ReportDateField";

// ---------- Types ----------
interface SalesRow {
  _id: string;
  productName: string;
  barcode: string;
  color: string;
  size: string;
  qty: number;
  avgBuyPrice: number;
  salesPrice: number;
  salesTotal: number;
  buyTotal: number;
}

interface SummaryBlock {
  salesTotal: number;
  itemDiscount: number;
  discount: number;
  lessTaka: number;
  returnAmount: number;
  deliveryCost: number;
  labourCost: number;
  payable: number;
  paid: number;
  changes: number;
  netPaid: number;
  due: number;
  invoiceCount: number;
}

interface AccountSummaryRow {
  accountName: string;
  totalAmount: number;
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
  rows: SalesRow[];
  totals: {
    count: number;
    totalQty: number;
    totalBuyValue: number;
    totalSalesValue: number;
  };
  summary: SummaryBlock;
  accountSummary: { accounts: AccountSummaryRow[]; grandTotal: number };
  pagination: { total: number; page: number; limit: number; totalPages: number; hasNextPage: boolean };
}

interface LookupOption {
  _id: string;
  name: string;
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
  { value: "80mm", label: "80mm" },
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

const toISODate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

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
  { key: "productName", label: "Product Name" },
  { key: "barcode", label: "Barcode" },
  { key: "color", label: "Color" },
  { key: "size", label: "Size" },
  { key: "qty", label: "Qty" },
  { key: "avgBuyPrice", label: "Avg Buy Price" },
  { key: "salesPrice", label: "Sales Price" },
  { key: "salesTotal", label: "Sales Total" },
] as const;

type ColumnKey = (typeof COLUMN_DEFS)[number]["key"];

// Text columns read left-aligned; every other column holds a number and is
// right-aligned so digits line up by place value.
const TEXT_COLUMNS: ColumnKey[] = ["productName", "barcode", "color", "size"];

const money = (n: number) => (n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 });

// Every price in this system is entered as a whole taka, so rates are shown
// whole too. They are still averages (3185 / 8 = 398.125), so a displayed rate
// multiplied by qty can be a taka or two off its own Sales Total — the totals
// are the stored figures and are always exact.

// ---------- Component ----------
const SalesSummaryReport = () => {
  const navigate = useNavigate();
  const printRef = useRef<HTMLDivElement>(null);
  const thermalRef = useRef<HTMLDivElement>(null);

  const initialRange = rangeForPreset("today");
  const [datePreset, setDatePreset] = useState<DatePreset>("today");
  const [startDate, setStartDate] = useState(initialRange.start);
  const [endDate, setEndDate] = useState(initialRange.end);
  const [salesType, setSalesType] = useState("");
  const [category, setCategory] = useState("");
  const [subCategory, setSubCategory] = useState("");
  const [brand, setBrand] = useState("");
  const [page, setPage] = useState(1);
  // The drawer overlays the report at every width, so it starts closed —
  // opening it on load would cover the sheet before it has been read.
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pageFormat, setPageFormat] = useState<PageFormat>("a4");
  const [pdfBusy, setPdfBusy] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
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
  useEffect(() => {
    document.body.classList.add("printing-report");
    return () => {
      document.body.classList.remove("printing-report");
    };
  }, []);

  // A5 needs a tighter type scale for the table to fit 124mm of printable
  // width; the rule keys off this class so print and preview stay in step.
  useEffect(() => {
    document.body.classList.toggle("sheet-a5", pageFormat === "a5");
    return () => document.body.classList.remove("sheet-a5");
  }, [pageFormat]);

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

  // Esc closes the filters drawer, matching the preview modal.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  const { data: categories } = useQuery({
    queryKey: ["sales-summary-report-categories"],
    queryFn: async () => {
      const { data } = await axiosSecure.get("/categories");
      return (data.data.categories || []) as LookupOption[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: subCategories } = useQuery({
    queryKey: ["sales-summary-report-subcategories"],
    queryFn: async () => {
      const { data } = await axiosSecure.get("/subcategories");
      return (data.data.subcategories || data.data.subCategories || []) as LookupOption[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: brands } = useQuery({
    queryKey: ["sales-summary-report-brands"],
    queryFn: async () => {
      const { data } = await axiosSecure.get("/brand");
      return (data.data.brands || []) as LookupOption[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const categoryOptions = useMemo(
    () => [
      { value: "", label: "All Categories" },
      ...(categories ?? []).map((c) => ({ value: c._id, label: c.name })),
    ],
    [categories],
  );

  const subCategoryOptions = useMemo(
    () => [
      { value: "", label: "All Subcategories" },
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

  const filters = { startDate, endDate, salesType, category, subCategory, brand };

  const { data, isLoading, isError, isFetching } = useQuery<ReportData>({
    queryKey: ["sales-summary-report", filters, page],
    queryFn: async () => {
      const res = await axiosSecure.post(`/report/sales-summary?page=${page}&limit=${LIMIT}`, filters);
      return res.data.data as ReportData;
    },
    placeholderData: keepPreviousData,
  });

  const header = data?.header;
  const totals = data?.totals;
  const summary = data?.summary;

  // Stored payable already has the per-invoice discounts, less taka and costs
  // applied. Only the period's sales returns are missing from it, so that is
  // the single adjustment made here.
  const payable = summary ? summary.payable - summary.returnAmount : 0;

  // netPaid already excludes counter change (derived server-side on write), so
  // only the period's refunded returns come off here.
  const netPaid = summary ? summary.netPaid - summary.returnAmount : 0;
  const accountSummary = data?.accountSummary;
  const pagination = data?.pagination;
  const rows = data?.rows ?? [];

  const filterChips: string[] = [];
  if (salesType) filterChips.push(salesTypeLabel[salesType] ?? salesType);
  if (category) {
    const c = categories?.find((x) => x._id === category);
    filterChips.push(c ? c.name : "Category");
  }
  if (subCategory) {
    const c = subCategories?.find((x) => x._id === subCategory);
    filterChips.push(c ? c.name : "Subcategory");
  }
  if (brand) {
    const b = brands?.find((x) => x._id === brand);
    filterChips.push(b ? b.name : "Brand");
  }
  const filterLabel = filterChips.length > 0 ? filterChips.join(", ") : "All Products";

  const activeFilterCount = [salesType, category, subCategory, brand].filter(Boolean).length;

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
      .replace(/print:hidden/g, "hidden")
      // The table is laid out for the screen: an overflow-x-auto wrapper and a
      // min-w on the table itself, each with a print: counterpart that only
      // unlocks under print media. Left as-is the copy would clip its last
      // column, so apply the print widths here too.
      .replace(/overflow-x-auto/g, "overflow-visible")
      .replace(/min-w-\[\d+px\]/g, "min-w-0");
    setPreviewHtml(html);
  }, [previewOpen, isThermal, pageFormat, data, visibleColumns]);


  // Reactive print rules — printing runs straight off the live page (Ctrl+P or
  // the Print button) through the browser's native preview, so whichever sheet
  // should come out has to be styled correctly in this document rather than
  // copied into a popup. Both sources (the A4/A5 table and the 80mm receipt)
  // stay mounted at all times, so these rules pick the page geometry *and*
  // decide which of the two is visible on paper.
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
      ? `
        @page { size: 80mm auto; margin: 0; ${blankMarginBoxes} }
        @media print {
          /* Hide everything, then re-show only the receipt subtree. */
          body.printing-report * { visibility: hidden !important; }
          body.printing-report .thermal-receipt,
          body.printing-report .thermal-receipt * { visibility: visible !important; }
          /* Thermal heads are 1-bit: any grey dithers into sparse dots and
             reads blurry. Force solid black on white so the printer fires a
             full dot for every glyph and rule. */
          body.printing-report .thermal-receipt,
          body.printing-report .thermal-receipt * {
            color: #000 !important;
            border-color: #000 !important;
            background: transparent !important;
            opacity: 1 !important;
            text-shadow: none !important;
            -webkit-font-smoothing: none !important;
          }
          /* The logo is the one element that keeps its own colours. */
          body.printing-report .thermal-receipt img {
            filter: none !important;
            opacity: 1 !important;
          }
          /* While the preview modal is open the receipt sits inside a fixed
             overlay that is itself print:hidden. display:none on an ancestor
             cannot be undone by visibility on a child, so the overlay chain is
             forced back to visible/static — otherwise printing from the
             preview would emit a blank page. */
          body.printing-report .thermal-preview-overlay,
          body.printing-report .thermal-preview-scroll {
            display: block !important;
            position: static !important;
            overflow: visible !important;
            background: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          body.printing-report .thermal-preview-toolbar { display: none !important; }
          body.printing-report .thermal-receipt {
            position: absolute !important;
            top: 0 !important;
            /* Centred rather than pinned left: on a page wider than the roll
               (A4 preview, PDF export) a left-pinned receipt hugs the edge. */
            left: 50% !important;
            transform: translateX(-50%) !important;
            width: 80mm !important;
            margin: 0 !important;
            background: #fff !important;
            box-shadow: none !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `
      : `
        @page { size: ${pageFormat}; margin: 12mm; ${blankMarginBoxes} }
        @media print {
          /* Keep the off-screen receipt out of the A4/A5 sheet entirely. */
          body.printing-report .thermal-receipt { display: none !important; }
          /* The A4/A5 preview modal is a display-only copy of the real sheet.
             Printing from it must emit the sheet itself, still mounted in the
             page underneath, so the whole overlay is dropped at print time —
             otherwise the copy would print on top of the original. */
          body.printing-report .thermal-preview-overlay { display: none !important; }
        }
      `;

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

      pdf.save(`sales-summary-report-${startDate}-to-${endDate}.pdf`);
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
      <PageMeta title="Sales Summary - Baig Ecommerce" description="Sales summary report" />

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
            {/* Page formats as a segmented control rather than a dropdown —
                three options are faster to hit directly than through a menu,
                and the active one stays visible without opening anything. */}
            <div className="flex items-center gap-0.5 rounded-full border border-gray-200 bg-white p-1 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              {pageFormatOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setPageFormat(opt.value)}
                  aria-pressed={opt.value === pageFormat}
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
              <div className="sheet-doc-label">Sales Summary</div>
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
              <span className="ml-auto shrink-0 self-start text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Sales Summary
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
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 print:hidden">
                {[
                  { label: "Sales Total", value: summary?.salesTotal ?? 0 },
                  { label: "Buy Value", value: totals.totalBuyValue },
                  {
                    // All three deductions in one tile — the strip is a fixed
                    // six-slot glance row, and the table below breaks the
                    // figure out into item discount / discount / less tk.
                    label: "Discount/Less",
                    value:
                      (summary?.itemDiscount ?? 0) +
                      (summary?.discount ?? 0) +
                      (summary?.lessTaka ?? 0),
                  },
                  { label: "Payable", value: payable },
                  { label: "Total Qty", value: totals.totalQty, isCount: true },
                  { label: "Items", value: totals.count, isCount: true },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-center dark:border-gray-700 dark:bg-gray-800">
                    <p className="text-xs text-gray-500 dark:text-gray-400">{s.label}</p>
                    <p className="mt-0.5 text-base font-bold text-gray-800 dark:text-gray-100">
                      {s.isCount ? s.value : `৳${money(s.value)}`}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Table */}
            <div className="mt-5 overflow-x-auto rounded-xl print:overflow-visible">
              <div className="overflow-x-auto print:overflow-visible">
                <table className="w-full min-w-[820px] print:min-w-0">
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
                          key={row._id}
                          className={`border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-white/[0.02] ${idx % 2 === 1 ? "bg-gray-50/50 dark:bg-white/[0.01]" : ""}`}
                        >
                          <td className="px-3 py-2.5 text-left text-xs text-gray-500">
                            {(pagination ? (pagination.page - 1) * pagination.limit : 0) + idx + 1}
                          </td>
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
                            <td className="whitespace-nowrap px-3 py-2.5 text-left text-xs text-gray-700 dark:text-gray-300">
                              {row.size || "-"}
                            </td>
                          )}
                          {visibleColumns.qty && (
                            <td className="px-3 py-2.5 text-right text-xs font-medium text-gray-800 dark:text-gray-100">
                              {row.qty}
                            </td>
                          )}
                          {visibleColumns.avgBuyPrice && (
                            <td className="px-3 py-2.5 text-right text-xs tabular-nums text-gray-700 dark:text-gray-300">
                              {money(row.avgBuyPrice)}
                            </td>
                          )}
                          {visibleColumns.salesPrice && (
                            <td className="px-3 py-2.5 text-right text-xs tabular-nums text-gray-700 dark:text-gray-300">
                              {money(row.salesPrice)}
                            </td>
                          )}
                          {visibleColumns.salesTotal && (
                            <td className="px-3 py-2.5 text-right text-xs font-medium text-gray-800 dark:text-gray-100">
                              {money(row.salesTotal)}
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
                            COLUMN_DEFS.filter(
                              (c) => visibleColumns[c.key] && TEXT_COLUMNS.includes(c.key),
                            ).length
                          }
                          className="px-3 py-3 text-right text-xs text-gray-700 dark:text-gray-200"
                        >
                          Total
                        </td>
                        {visibleColumns.qty && (
                          <td className="px-3 py-3 text-right text-xs text-gray-800 dark:text-gray-100">
                            {totals.totalQty}
                          </td>
                        )}
                        {visibleColumns.avgBuyPrice && (
                          <td className="px-3 py-3 text-right text-xs text-gray-800 dark:text-gray-100">
                            {money(totals.totalBuyValue)}
                          </td>
                        )}
                        {visibleColumns.salesPrice && <td className="px-3 py-3" />}
                        {visibleColumns.salesTotal && (
                          <td className="px-3 py-3 text-right text-xs text-gray-800 dark:text-gray-100">
                            {money(totals.totalSalesValue)}
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

            {/* Sales summary block */}
            {summary && (
              <div className="mt-5 flex justify-end">
                <div className="w-full max-w-sm">
                  <table className="w-full">
                    <tbody>
                      {[
                        { label: "SALES TOTAL", value: summary.salesTotal, always: true },
                        { label: "ITEM DISCOUNT (-)", value: summary.itemDiscount },
                        { label: "DISCOUNT (-)", value: summary.discount },
                        { label: "LESS TK (-)", value: summary.lessTaka },
                        { label: "RETURN (-)", value: summary.returnAmount },
                        { label: "DELIVERY COST (+)", value: summary.deliveryCost },
                        { label: "LABOUR COST (+)", value: summary.labourCost },
                        // A zero adjustment is noise — only the lines that moved
                        // the total earn a row. Sales total always shows, as it
                        // is what the rest adjusts.
                      ].filter((r) => r.always || r.value !== 0).map((r) => (
                        <tr key={r.label} className="border-b border-gray-100 dark:border-gray-800">
                          <td className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">
                            {r.label}
                          </td>
                          <td className="px-3 py-2 text-right text-xs font-semibold text-gray-800 dark:text-gray-100">
                            {money(r.value)}
                          </td>
                        </tr>
                      ))}
                      <tr className="total-row border-b border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-gray-800">
                        <td className="px-3 py-2.5 text-left text-xs font-bold text-gray-800 dark:text-gray-100">
                          TOTAL PAYABLE
                        </td>
                        <td className="px-3 py-2.5 text-right text-xs font-bold text-gray-800 dark:text-gray-100">
                          {money(payable)}
                        </td>
                      </tr>
                      <tr className="border-b border-gray-100 dark:border-gray-800">
                        <td className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">
                          PAID
                        </td>
                        <td className="px-3 py-2 text-right text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                          {money(netPaid)}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">
                          DUE
                        </td>
                        <td className="px-3 py-2 text-right text-xs font-bold text-red-600 dark:text-red-400">
                          {money(summary.due)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Account summary */}
            {accountSummary && accountSummary.accounts.length > 0 && (
              <div className="mt-5 flex justify-end">
                <div className="w-full max-w-sm">
                  <p className="mb-2 text-right text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                    Account Summary
                  </p>
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-800">
                        <th className="border-b border-gray-200 px-3 py-2 text-left text-xs font-semibold uppercase text-gray-600 dark:border-gray-700 dark:text-gray-300">
                          Account Name
                        </th>
                        <th className="border-b border-gray-200 px-3 py-2 text-right text-xs font-semibold uppercase text-gray-600 dark:border-gray-700 dark:text-gray-300">
                          Total Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {accountSummary.accounts.map((a) => (
                        <tr key={a.accountName} className="border-b border-gray-100 dark:border-gray-800">
                          <td className="px-3 py-2 text-left text-xs text-gray-700 dark:text-gray-300">
                            {a.accountName}
                          </td>
                          <td className="px-3 py-2 text-right text-xs text-gray-700 dark:text-gray-300">
                            {money(a.totalAmount)}
                          </td>
                        </tr>
                      ))}
                      <tr className="grand-total bg-gray-100 dark:bg-gray-800">
                        <td className="px-3 py-2.5 text-left text-xs font-bold text-gray-800 dark:text-gray-100">
                          Grand Total
                        </td>
                        <td className="px-3 py-2.5 text-right text-xs font-bold text-gray-800 dark:text-gray-100">
                          {money(accountSummary.grandTotal)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
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

        {/* Thermal (80mm) POS receipt layout — the single source for the 80mm
            preview, PDF, and print. Always mounted: parked off-screen normally
            so html2canvas and the print rules can reach it, and shown in place
            inside the preview modal when that is open. Rendering one node for
            all three paths is what keeps the preview honest — what is on
            screen is literally what prints. Products print as a narrow
            SL/QTY/AVG/SALES/TOTAL table, with barcode and colour/size as
            sublines under the name, the two things that cannot fit as their
            own columns at 80mm. */}
        <div
          className={
            previewOpen
              ? "thermal-preview-overlay fixed inset-0 z-[100010] flex flex-col items-center bg-black/60 py-6"
              : "contents"
          }
          onClick={() => setPreviewOpen(false)}
        >
          {previewOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="thermal-preview-toolbar mb-3 flex shrink-0 items-center gap-2"
            >
              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-semibold text-gray-800 shadow-lg transition-colors hover:bg-gray-100"
              >
                <IoIosPrint className="size-4" /> Print
              </button>
              <button
                onClick={handleDownloadPdf}
                disabled={pdfBusy}
                className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-semibold text-gray-800 shadow-lg transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <LuFileDown className="size-4" /> {pdfBusy ? "Generating..." : "PDF"}
              </button>
              <button
                onClick={() => setPreviewOpen(false)}
                className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-semibold text-gray-800 shadow-lg transition-colors hover:bg-gray-100"
              >
                <MdClose className="size-4" /> Close
              </button>
            </div>
          )}
          {/* A4/A5 preview — the paper sheet itself stays mounted in the page
              canvas (it is what html2canvas and the print rules target), so it
              cannot also live in here. Instead the modal shows a paper-sized
              frame holding a live copy of that sheet's markup, scaled to fit
              the viewport. It is display-only: Print and PDF above both act on
              the real sheet, so what is previewed is what comes out. */}
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
                ? "thermal-preview-scroll no-scrollbar min-h-0 flex-1 overflow-y-auto"
                : "contents"
            }
            onClick={(e) => previewOpen && isThermal && e.stopPropagation()}
          >
        <div
          ref={thermalRef}
          className={`thermal-receipt w-[80mm] bg-white px-3 py-4 font-mono text-black ${
            previewOpen && isThermal ? "relative shadow-lg" : "pointer-events-none fixed left-[-9999px] top-0"
          }`}
        >
          {/* Store header */}
          <div className="text-center">
            {header?.logo && (
              <img
                src={header.logo}
                alt={header.storeName}
                crossOrigin="anonymous"
                className="mx-auto mb-2 size-11 object-contain"
              />
            )}
            <h1 className="text-base font-bold leading-tight">{header?.storeName ?? "Store"}</h1>
            {header?.address && <p className="mt-1 text-[10px] leading-snug">{header.address}</p>}
            {header?.phone && <p className="text-[10px]">Tel: {header.phone}</p>}
          </div>

          <p className="mt-2.5 text-center text-[13px] font-bold tracking-wide">SALES BY PRODUCT</p>

          <div className="my-2 border-t border-dashed border-black" />

          {/* Meta */}
          <div className="space-y-0.5 text-center text-[10px] font-bold">
            <p>
              PERIOD: {startDate} To {endDate}
            </p>
            <p>FILTER: {filterLabel}</p>
          </div>

          <div className="my-2 border-t border-dashed border-black" />

          {/* Items table */}
          <div className="flex gap-1 border-b border-black pb-1 text-[9px] font-bold leading-tight">
            <span className="w-4 shrink-0">SL</span>
            <span className="flex-1">PRODUCT</span>
            <span className="w-5 shrink-0 text-right">QTY</span>
            <span className="w-10 shrink-0 text-right">AVG BUY PRICE</span>
            <span className="w-10 shrink-0 text-right">SALES PRICE</span>
            <span className="w-12 shrink-0 text-right">TOTAL SALES</span>
          </div>

          {rows.map((row, idx) => (
            <div key={row._id} className="border-b border-dotted border-black py-1">
              <div className="flex gap-1 text-[10px]">
                <span className="w-4 shrink-0">{idx + 1}</span>
                <span className="flex-1 break-words font-bold">{row.productName || "—"}</span>
                <span className="w-5 shrink-0 text-right">{row.qty}</span>
                <span className="w-10 shrink-0 text-right">{money(row.avgBuyPrice)}</span>
                <span className="w-10 shrink-0 text-right">{money(row.salesPrice)}</span>
                <span className="w-12 shrink-0 text-right font-bold">{money(row.salesTotal)}</span>
              </div>
              {row.barcode && <p className="pl-5 text-[9px] leading-tight">{row.barcode}</p>}
              {(row.color || row.size) && (
                <p className="pl-5 text-[9px] leading-tight">
                  {[row.color, row.size].filter(Boolean).join(" | ")}
                </p>
              )}
            </div>
          ))}

          {totals && (
            <div className="flex gap-1 border-b border-black py-1.5 text-[10px] font-bold">
              <span className="w-4 shrink-0" />
              <span className="flex-1">TOTAL</span>
              <span className="w-5 shrink-0 text-right">{totals.totalQty}</span>
              <span className="w-10 shrink-0 text-right">—</span>
              <span className="w-10 shrink-0 text-right">—</span>
              <span className="w-12 shrink-0 text-right">{money(totals.totalSalesValue)}</span>
            </div>
          )}

          <div className="my-2 border-t border-dashed border-black" />

          {/* Summary */}
          {summary && (
            <div className="space-y-1 text-[10px]">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{money(summary.salesTotal)}</span>
              </div>
              {summary.itemDiscount > 0 && (
                <div className="flex justify-between">
                  <span>(-) Item Discount</span>
                  <span>{money(summary.itemDiscount)}</span>
                </div>
              )}
              {summary.discount > 0 && (
                <div className="flex justify-between">
                  <span>(-) Discount</span>
                  <span>{money(summary.discount)}</span>
                </div>
              )}
              {summary.lessTaka > 0 && (
                <div className="flex justify-between">
                  <span>(-) Less Tk</span>
                  <span>{money(summary.lessTaka)}</span>
                </div>
              )}
              {summary.returnAmount > 0 && (
                <div className="flex justify-between">
                  <span>(-) Return</span>
                  <span>{money(summary.returnAmount)}</span>
                </div>
              )}
              {summary.deliveryCost > 0 && (
                <div className="flex justify-between">
                  <span>(+) Delivery</span>
                  <span>{money(summary.deliveryCost)}</span>
                </div>
              )}
              {summary.labourCost > 0 && (
                <div className="flex justify-between">
                  <span>(+) Labour</span>
                  <span>{money(summary.labourCost)}</span>
                </div>
              )}

              <div className="flex justify-between border-t border-black pt-1.5 text-[11px] font-bold">
                <span>Net Sales</span>
                <span>{money(payable)}</span>
              </div>
              <div className="flex justify-between">
                <span>Paid</span>
                <span className="font-bold">{money(netPaid)}</span>
              </div>
              <div className="flex justify-between">
                <span>Due</span>
                <span className="font-bold">{money(summary.due)}</span>
              </div>
              <div className="flex justify-between">
                <span>Total Invoices</span>
                <span className="font-bold">{summary.invoiceCount}</span>
              </div>
            </div>
          )}

          {/* Account summary */}
          {accountSummary && accountSummary.accounts.length > 0 && (
            <>
              <div className="my-2 border-t border-dashed border-black" />
              <p className="text-[10px] font-bold tracking-wide">PAYMENT</p>
              <div className="mt-0.5 space-y-0.5 text-[10px]">
                {accountSummary.accounts.map((a) => (
                  <div key={a.accountName} className="flex justify-between">
                    <span>{a.accountName}</span>
                    <span>{money(a.totalAmount)}</span>
                  </div>
                ))}
                <div className="flex justify-between border-t border-dotted border-black pt-1 font-bold">
                  <span>Total Paid</span>
                  <span>{money(accountSummary.grandTotal)}</span>
                </div>
              </div>
            </>
          )}

          <div className="my-2 border-t border-dashed border-black" />

          {/* Footer */}
          <div className="space-y-0.5 text-center text-[9px]">
            <p>Generated: {new Date().toLocaleString()}</p>
            <p>
              Page {pagination?.page ?? 1} of {pagination?.totalPages ?? 1}
            </p>
            <p>
              {header?.storeName ?? "Store"} — {new Date().getFullYear()}
            </p>
          </div>
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

          {/* Subcategory */}
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
              Subcategory
            </p>
            <SearchableSelect
              options={subCategoryOptions}
              value={subCategory}
              onChange={(v) => {
                setSubCategory(v);
                setPage(1);
              }}
              placeholder="All Subcategories"
              searchPlaceholder="Search subcategory..."
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

export default SalesSummaryReport;
