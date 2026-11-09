import { useEffect, useRef, useState, useCallback } from "react";
import { keepPreviousData, useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  FaSync, FaTimes, FaExclamationTriangle,
  FaBoxOpen, FaChevronDown,
} from "react-icons/fa";
import { MdOutlineQrCodeScanner } from "react-icons/md";
import axiosSecure from "../../../hooks/useAxiosSecure";
import toast from "react-hot-toast";
import useIsMobile from "../../../hooks/useIsMobile";
import MobileCardList from "../../common/MobileCardList";
import MobileCardRow from "../../common/MobileCardRow";
import InfiniteScrollTrigger from "../../common/InfiniteScrollTrigger";

// ---------- Types ----------

// A row of the server's low stock list (POST /stock/low-stock)
interface ServerRow {
  _id: string;
  productName: string;
  variantName: string;
  variantType: "single" | "multi";
  subcategory: string;
  subcategoryId?: string;
  barcode: string;
  color: string;
  size: string;
  buyRate: number;
  retailPrice: number;
  wsPrice: number;
  stock: number;
  alertQty: number;
}

interface LowStockPage {
  rows: ServerRow[];
  totals: { count: number; totalStock: number };
  pagination: { page: number; hasNextPage: boolean };
}

interface LowStockRow {
  key: string;
  barcode: string;
  subcategory: string;
  subcategoryId: string;
  productName: string;
  variant: string;
  variantType: "single" | "multi";
  color: string;
  size: string;
  buyRate: number | string;
  retailPrice: number | string;
  wholesalePrice: number | string;
  stock: number;
  alertQty: number;
}

interface CategoryOption { id: string; name: string }

// ---------- Helpers ----------

const toRow = (r: ServerRow): LowStockRow => ({
  key: r._id,
  barcode: r.barcode || "-",
  subcategory: r.subcategory || "-",
  subcategoryId: r.subcategoryId || "",
  productName: r.productName,
  variant: r.variantType === "multi" ? r.variantName || "-" : "Single",
  variantType: r.variantType,
  color: r.color || "-",
  size: r.size || "-",
  buyRate: r.buyRate ?? "-",
  retailPrice: r.retailPrice ?? "-",
  wholesalePrice: r.wsPrice ?? "-",
  stock: r.stock,
  alertQty: r.alertQty,
});

// ---------- Category dropdown ----------

const CategoryDropdown = ({
  categories, value, onChange,
}: {
  categories: CategoryOption[];
  value: string;
  onChange: (v: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = categories.find((c) => c.id === value);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div ref={ref} className="relative shrink-0 w-[190px]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between w-full h-10 px-3 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] text-sm text-gray-700 dark:text-gray-300 hover:border-accent-400 transition-colors focus:outline-none focus:ring-2 focus:ring-accent-500/20"
      >
        <span className="truncate">{selected?.name ?? "All Categories"}</span>
        <FaChevronDown size={10} className={`ml-2 shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-gray-900 shadow-lg overflow-hidden">
          <div className="max-h-52 overflow-y-auto">
            <button
              onClick={() => { onChange(""); setOpen(false); }}
              className={`w-full px-3 py-2.5 text-sm text-left hover:bg-accent-50 dark:hover:bg-white/[0.05] transition-colors ${!value ? "font-semibold text-accent-600 bg-accent-50/60 dark:bg-white/[0.04]" : "text-gray-700 dark:text-gray-300"}`}
            >
              All Categories
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => { onChange(c.id); setOpen(false); }}
                className={`w-full px-3 py-2.5 text-sm text-left hover:bg-accent-50 dark:hover:bg-white/[0.05] transition-colors ${value === c.id ? "font-semibold text-accent-600 bg-accent-50/60 dark:bg-white/[0.04]" : "text-gray-700 dark:text-gray-300"}`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ---------- Column config ----------

const COLS = [
  "Barcode", "Subcategory", "Product", "Variant",
  "Color", "Size", "Buy Rate", "Retail Price", "W.S Price", "Stock", "Alert",
];

const ROW_H = 50;

// ---------- Component ----------

const LowStockList = () => {
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const [categories, setCategories] = useState<CategoryOption[]>([]);

  const [search, setSearch]           = useState("");
  const [debSearch, setDebSearch]     = useState("");
  const [categoryId, setCategoryId]   = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ── Barcode scanner focus management ────────────────────────────────────
  // A USB barcode scanner behaves like a keyboard: it only "types" into
  // whichever element currently has focus. Keep the search box focused by
  // default so scanning works without clicking into it first.
  const focusSearchInput = useCallback(() => {
    searchInputRef.current?.focus();
  }, []);

  useEffect(() => {
    focusSearchInput();
  }, [focusSearchInput]);

  const handleSearchBlur = () => {
    window.setTimeout(() => {
      const active = document.activeElement;
      const isFormField =
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        active instanceof HTMLSelectElement ||
        active instanceof HTMLButtonElement;
      if (!isFormField) {
        focusSearchInput();
      }
    }, 150);
  };

  // ── Fetch: the server's low stock list, one page at a time ──────────────
  // Filtered and searched on the server; the whole catalogue is never loaded
  // into the browser (BUG-P2-010)
  const {
    data,
    isFetching: isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isPlaceholderData,
  } = useInfiniteQuery({
    queryKey: ["low-stock", debSearch, categoryId] as const,
    initialPageParam: 1,
    queryFn: async ({ pageParam }): Promise<LowStockPage> => {
      const res = await axiosSecure.post(
        "/stock/low-stock",
        { search: debSearch.trim() || undefined, subCategory: categoryId || undefined },
        { params: { page: pageParam, limit: 100 } },
      );
      return res.data.data as LowStockPage;
    },
    getNextPageParam: (last) => (last?.pagination?.hasNextPage ? last.pagination.page + 1 : undefined),
    staleTime: 5 * 60 * 1000,
    // Keep the current rows (dimmed) while a new search or filter loads
    placeholderData: keepPreviousData,
  });
  // The spinner replaces the table only on the first load; loading the next
  // page or a new search keeps the rows in place
  const firstLoad = isLoading && !data;
  const busy = search.trim() !== debSearch.trim() || (isLoading && isPlaceholderData);

  const rows: LowStockRow[] = data?.pages.flatMap((page) => (page?.rows ?? []).map(toRow)) ?? [];
  const totals = data?.pages[0]?.totals;

  useEffect(() => { if (isError) toast.error("Failed to fetch low stock"); }, [isError]);

  // Subcategory filter options: the shop's subcategories
  useEffect(() => {
    axiosSecure
      .get("/subcategories")
      .then((res) => {
        const list = res.data?.data?.subCategories ?? res.data?.data?.subcategories ?? res.data?.data ?? [];
        setCategories(Array.isArray(list) ? list.map((c: { _id: string; name: string }) => ({ id: c._id, name: c.name })) : []);
      })
      .catch(() => setCategories([]));
  }, []);

  // Back to the top when the filter changes
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [debSearch, categoryId]);

  // ── Debounce search 300 ms ─────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setDebSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["low-stock"] });
    refetch();
  };

  // ── Virtualizer ───────────────────────────────────────────────────────────
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_H,
    overscan: 12,
  });
  const virtualItems  = virtualizer.getVirtualItems();
  const totalVH       = virtualizer.getTotalSize();
  const paddingTop    = virtualItems[0]?.start ?? 0;
  const paddingBottom = virtualItems.length > 0
    ? totalVH - (virtualItems[virtualItems.length - 1]?.end ?? 0)
    : 0;

  // Infinite scroll: fetch the next page once the last rendered row is within
  // a few rows of the end of what is loaded
  const lastRenderedIndex = virtualItems[virtualItems.length - 1]?.index ?? -1;
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage && rows.length > 0 && lastRenderedIndex >= rows.length - 5) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, rows.length, lastRenderedIndex, fetchNextPage]);

  // The whole list's figures, from the server (not only the loaded pages)
  const lowCount    = totals?.count ?? rows.length;
  const totalStock  = totals?.totalStock ?? rows.reduce((s, r) => s + r.stock, 0);
  const hasFilter   = !!(search || categoryId);
  const clearAll    = () => { setSearch(""); setCategoryId(""); };

  return (
    <div className="space-y-4">

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex items-center gap-4 rounded-2xl border border-orange-200 dark:border-orange-500/20 bg-orange-50 dark:bg-orange-500/10 px-6 py-4">
          <div className="size-10 rounded-xl bg-orange-100 dark:bg-orange-500/20 flex items-center justify-center shrink-0">
            <FaExclamationTriangle size={15} className="text-orange-500 dark:text-orange-400" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-orange-500 dark:text-orange-400">Low Stock Items</p>
            <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">{lowCount.toLocaleString()}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-2xl border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 px-6 py-4">
          <div className="size-10 rounded-xl bg-red-100 dark:bg-red-500/20 flex items-center justify-center shrink-0">
            <FaBoxOpen size={15} className="text-red-500 dark:text-red-400" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-red-500 dark:text-red-400">Total Remaining</p>
            <p className="text-2xl font-bold text-red-700 dark:text-red-300">{totalStock.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-3 flex-wrap rounded-2xl border border-gray-100 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] px-4 py-3">
        {/* Search */}
        <div className="relative group flex-1 min-w-[180px]">
          <button
            type="button"
            onClick={focusSearchInput}
            title="Click to resume scanning"
            aria-label="Resume scanning"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-accent-500 group-focus-within:text-accent-500 transition-colors"
          >
            <MdOutlineQrCodeScanner size={14} />
          </button>
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Scan barcode or search product, variant…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onBlur={handleSearchBlur}
            onKeyDown={(e) => {
              // Scanners terminate input with Enter — skip the
              // debounce and filter immediately instead of waiting.
              if (e.key === "Enter") {
                e.preventDefault();
                setDebSearch(search);
              }
            }}
            autoComplete="off"
            className="h-10 w-full rounded-xl border border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.03] pl-9 pr-14 text-sm text-gray-700 dark:text-gray-300 placeholder:text-gray-400 focus:border-accent-500 focus:bg-white dark:focus:bg-white/[0.05] focus:outline-none focus:ring-2 focus:ring-accent-500/20 transition-colors"
          />
          {busy && search.trim() && (
            <span
              role="status"
              aria-label="Searching"
              className="absolute right-8 top-1/2 size-3.5 -translate-y-1/2 animate-spin rounded-full border-2 border-accent-500/25 border-t-accent-500"
            />
          )}
          {search && (
            <button onClick={() => setSearch("")} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-error-500">
              <FaTimes size={10} />
            </button>
          )}
        </div>

        {/* Category */}
        <CategoryDropdown categories={categories} value={categoryId} onChange={setCategoryId} />

        {/* Meta */}
        <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap shrink-0">
          {rows.length} items
        </span>

        {hasFilter && (
          <button
            onClick={clearAll}
              className="shine flex items-center gap-1.5 h-10 px-3 rounded-xl bg-error-50 text-error-600 hover:bg-error-100 dark:bg-error-500/15 dark:text-error-400 dark:hover:bg-error-500/25 text-xs font-medium transition-colors"
          >
            <FaTimes size={10} /> Clear
          </button>
        )}

        <button
          onClick={handleRefresh}
          disabled={isLoading}
          aria-label="Refresh"
          className="shine size-10 flex items-center justify-center rounded-md border border-accent-100 bg-accent-50 hover:bg-accent-100 text-accent-600 dark:border-accent-500/20 dark:bg-accent-500/15 dark:text-accent-400 transition-all active:scale-90 disabled:opacity-50"
          title="Refresh"
        >
          <FaSync size={11} className={isLoading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* ── Table ── */}
      {isMobile ? (
        firstLoad ? (
          <div className="flex items-center justify-center" style={{ height: 300 }}>
            <div className="size-8 border-4 border-accent-500/20 border-t-accent-500 rounded-full animate-spin" />
          </div>
        ) : (
          <div className={`transition-opacity duration-200 ${busy ? "pointer-events-none opacity-50" : "opacity-100"}`}>
          <MobileCardList
            items={rows}
            getKey={(row) => row.key}
            emptyMessage={hasFilter ? "No results for current filter" : "All products are well stocked!"}
            renderCard={(row) => (
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <span className="text-xs text-gray-400 font-mono">{row.barcode}</span>
                    <h3 className="font-bold text-sm text-gray-800 dark:text-white/90">
                      {row.productName}
                    </h3>
                  </div>
                  <span className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[11px] font-medium ${
                    row.variantType === "single"
                      ? "bg-sky-100 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400"
                      : "bg-violet-100 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400"
                  }`}>
                    {row.variant}
                  </span>
                </div>
                <MobileCardRow label="Subcategory">{row.subcategory}</MobileCardRow>
                <MobileCardRow label="Color / Size">{row.color} / {row.size}</MobileCardRow>
                <MobileCardRow label="Buy Rate">{row.buyRate === "-" ? "-" : `৳${row.buyRate}`}</MobileCardRow>
                <MobileCardRow label="Retail Price">{row.retailPrice === "-" ? "-" : `৳${row.retailPrice}`}</MobileCardRow>
                <MobileCardRow label="W.S Price">{row.wholesalePrice === "-" ? "-" : `৳${row.wholesalePrice}`}</MobileCardRow>
                <MobileCardRow label="Stock / Alert">
                  <span className={row.stock === 0 ? "text-red-600 dark:text-red-400 font-bold" : "text-orange-600 dark:text-orange-400 font-bold"}>
                    {row.stock}
                  </span>
                  {" "}/ {row.alertQty}
                </MobileCardRow>
              </div>
            )}
          />
          </div>
        )
      ) : (
      <div aria-busy={busy} className={`rounded-xl border border-gray-200 dark:border-white/[0.07] bg-white dark:bg-white/[0.03] overflow-hidden transition-opacity duration-200 ${busy && !firstLoad ? "pointer-events-none opacity-50" : "opacity-100"}`}>
        {firstLoad ? (
          <div className="flex items-center justify-center" style={{ height: 300 }}>
            <div className="size-8 border-4 border-accent-500/20 border-t-accent-500 rounded-full animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20">
            <div className="size-14 rounded-full bg-green-50 dark:bg-green-500/10 flex items-center justify-center">
              <FaBoxOpen size={22} className="text-green-500" />
            </div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {hasFilter ? "No results for current filter" : "All products are well stocked!"}
            </p>
            {hasFilter && (
              <button onClick={clearAll} className="text-accent-500 text-xs hover:underline">Clear filters</button>
            )}
          </div>
        ) : (
          <div ref={scrollRef} className="no-scrollbar overflow-auto" style={{ maxHeight: 580 }}>
            {/* Fixed column widths and one-line, measured rows keep columns and rows still
                while the list virtualizes; narrow screens scroll instead of crushing */}
            <table className="w-full border-collapse table-fixed" style={{ minWidth: 960 }}>
              <colgroup><col style={{width:"12%"}}/><col style={{width:"11%"}}/><col style={{width:"15%"}}/><col style={{width:"8%"}}/><col style={{width:"7%"}}/><col style={{width:"7%"}}/><col style={{width:"8%"}}/><col style={{width:"9%"}}/><col style={{width:"9%"}}/><col style={{width:"7%"}}/><col style={{width:"7%"}}/></colgroup>
              <thead className="sticky top-0 z-10">
                <tr>
                  {COLS.map((c) => (
                    <th
                      key={c}
                      title={c}
                      className="border border-gray-200 dark:border-white/[0.07] px-2 py-3 text-[10px] font-bold uppercase tracking-wide text-gray-700 dark:text-gray-200 text-center bg-slate-50 dark:bg-slate-800/60 whitespace-nowrap truncate"
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paddingTop > 0 && (
                  <tr><td colSpan={COLS.length} style={{ height: paddingTop, padding: 0, border: "none" }} /></tr>
                )}

                {virtualItems.map((vi) => {
                  const row = rows[vi.index];
                  const isEven = vi.index % 2 === 0;
                  const urgency = row.stock === 0
                    ? "bg-red-50/60 dark:bg-red-500/[0.04]"
                    : isEven ? "bg-white dark:bg-transparent" : "bg-slate-50/70 dark:bg-white/[0.015]";

                  return (
                    <tr
                      key={row.key}
                      ref={virtualizer.measureElement}
                      data-index={vi.index}
                      className={`${urgency} hover:bg-orange-50/40 dark:hover:bg-white/[0.03] transition-colors`}
                      style={{ height: ROW_H }}
                    >
                      <td className="border border-gray-200 dark:border-white/[0.07] px-2 text-center text-[11px] font-mono text-gray-600 dark:text-gray-400 truncate" title={String(row.barcode)}>
                        {row.barcode}
                      </td>
                      <td className="border border-gray-200 dark:border-white/[0.07] px-2 text-center text-[12px] text-gray-600 dark:text-gray-400 truncate" title={String(row.subcategory)}>
                        {row.subcategory}
                      </td>
                      <td className="border border-gray-200 dark:border-white/[0.07] px-2 text-center text-[12px] font-semibold text-gray-800 dark:text-gray-200 truncate" title={String(row.productName)}>
                        {row.productName}
                      </td>
                      <td className="border border-gray-200 dark:border-white/[0.07] px-2 text-center truncate" title={row.variant}>
                        <span className={`inline-flex max-w-full items-center justify-center px-1.5 py-0.5 rounded text-[11px] font-medium ${
                          row.variantType === "single"
                            ? "bg-sky-100 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400"
                            : "bg-violet-100 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400"
                        }`}>
                          <span className="min-w-0 truncate">{row.variant}</span>
                        </span>
                      </td>
                      <td className="border border-gray-200 dark:border-white/[0.07] px-2 text-center text-[12px] text-gray-600 dark:text-gray-400 truncate" title={String(row.color)}>
                        {row.color}
                      </td>
                      <td className="border border-gray-200 dark:border-white/[0.07] px-2 text-center text-[12px] text-gray-600 dark:text-gray-400 truncate" title={String(row.size)}>
                        {row.size}
                      </td>
                      <td className="border border-gray-200 dark:border-white/[0.07] px-2 text-center text-[12px] text-gray-700 dark:text-gray-300 truncate">
                        {row.buyRate === "-" ? "-" : `৳${row.buyRate}`}
                      </td>
                      <td className="border border-gray-200 dark:border-white/[0.07] px-2 text-center text-[12px] text-gray-700 dark:text-gray-300 truncate">
                        {row.retailPrice === "-" ? "-" : `৳${row.retailPrice}`}
                      </td>
                      <td className="border border-gray-200 dark:border-white/[0.07] px-2 text-center text-[12px] text-gray-700 dark:text-gray-300 truncate">
                        {row.wholesalePrice === "-" ? "-" : `৳${row.wholesalePrice}`}
                      </td>
                      <td className="border border-gray-200 dark:border-white/[0.07] px-2 text-center truncate">
                        <span className={`inline-flex items-center justify-center w-full text-[12px] font-bold ${
                          row.stock === 0
                            ? "text-red-600 dark:text-red-400"
                            : "text-orange-600 dark:text-orange-400"
                        }`}>
                          {row.stock}
                        </span>
                      </td>
                      <td className="border border-gray-200 dark:border-white/[0.07] px-2 text-center text-[12px] text-gray-500 dark:text-gray-400 truncate" title={String(row.alertQty)}>
                        {row.alertQty}
                      </td>
                    </tr>
                  );
                })}

                {paddingBottom > 0 && (
                  <tr><td colSpan={COLS.length} style={{ height: paddingBottom, padding: 0, border: "none" }} /></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}

      {/* Desktop loads from the virtualizer above; the mobile cards grow the page */}
      <InfiniteScrollTrigger
        watch={isMobile}
        hasMore={hasNextPage}
        loading={isFetchingNextPage}
        onLoadMore={fetchNextPage}
        label="Loading more items…"
      />
    </div>
  );
};

export default LowStockList;
