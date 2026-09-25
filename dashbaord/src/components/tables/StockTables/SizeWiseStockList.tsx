import { useEffect, useRef, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  FaSync, FaTimes, FaBoxOpen, FaLayerGroup,
  FaChevronLeft, FaChevronRight, FaChevronDown,
} from "react-icons/fa";
import { MdOutlineQrCodeScanner } from "react-icons/md";
import axiosSecure from "../../../hooks/useAxiosSecure";
import toast from "react-hot-toast";

// ---------- Types ----------

interface MultiVariant {
  _id: string;
  barCode?: string;
  sku?: string;
  size?: string;
  stockVariant: number;
  product?: {
    _id: string;
    name: string;
    barCode?: string;
    category?: { _id: string; name: string };
    subcategory?: { _id: string; name: string };
    brand?: { _id: string; name: string };
  };
}

interface PivotRow {
  key: string;
  barcode: string;
  category: string;
  categoryId: string;
  subcategory: string;
  subcategoryId: string;
  brand: string;
  brandId: string;
  productName: string;
  variantType: "single" | "multi";
  sizeStock: Record<string, number>;
  hasAnySize: boolean;
  total: number;
}

interface FilterOption { id: string; name: string }

// ---------- Size columns ----------

const SIZE_COLS = [
  { label: "XS/28",  keys: ["XS", "28"] },
  { label: "S/30",   keys: ["S", "30", "15"] },
  { label: "M/32",   keys: ["M", "32", "15.5"] },
  { label: "L/34",   keys: ["L", "34", "16"] },
  { label: "XL/36",  keys: ["XL", "36", "16.5"] },
  { label: "2XL/38", keys: ["2XL", "38", "17"] },
  { label: "3XL/40", keys: ["3XL", "40", "17.5"] },
  { label: "4XL/42", keys: ["4XL", "42"] },
  { label: "5XL/44", keys: ["5XL", "44"] },
  { label: "6XL/46", keys: ["6XL", "46"] },
  { label: "7XL/48", keys: ["7XL", "48"] },
  { label: "8XL/50", keys: ["8XL", "50"] },
];

const PAGE_LIMIT = 100;
const ROW_H      = 48;

// ---------- Helpers ----------

const normSize = (s: string) => s.trim().toUpperCase();

const getSizeVal = (ss: Record<string, number>, col: typeof SIZE_COLS[number]): number | null => {
  for (const k of col.keys) {
    const v = ss[normSize(k)];
    if (v !== undefined) return v;
  }
  return null;
};

// Group by product only (no color) — sums stock across all colors per size
const buildPivotRows = (variants: MultiVariant[]): PivotRow[] => {
  const map = new Map<string, PivotRow>();

  for (const v of variants) {
    if (!v.product?._id) continue;
    const size = (v.size || "").trim();
    const key  = `m::${v.product._id}`;
    if (!map.has(key)) {
      map.set(key, {
        key,
        barcode:       v.product.barCode || v.barCode || v.sku || "-",
        category:      v.product.category?.name    || "-",
        categoryId:    v.product.category?._id     || "",
        subcategory:   v.product.subcategory?.name || "-",
        subcategoryId: v.product.subcategory?._id  || "",
        brand:         v.product.brand?.name       || "-",
        brandId:       v.product.brand?._id        || "",
        productName:   v.product.name,
        variantType:   "multi",
        sizeStock: {}, hasAnySize: false, total: 0,
      });
    }
    const row = map.get(key)!;
    if (size && size !== "N/A") {
      const nk = normSize(size);
      row.sizeStock[nk] = (row.sizeStock[nk] ?? 0) + v.stockVariant;
      row.hasAnySize = true;
    }
    row.total += v.stockVariant;
  }

  return Array.from(map.values());
};

// ---------- Filter dropdown ----------

const FilterDropdown = ({
  options, value, onChange, allLabel,
}: {
  options: FilterOption[];
  value: string;
  onChange: (v: string) => void;
  allLabel: string;
}) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = options.find((c) => c.id === value);
  const filtered = q.trim()
    ? options.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()))
    : options;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQ("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleOpen = () => {
    setOpen((o) => !o);
    setQ("");
    setTimeout(() => inputRef.current?.focus(), 60);
  };

  return (
    <div ref={ref} className="relative shrink-0 w-[150px]">
      <button
        type="button"
        onClick={handleOpen}
        className="flex items-center justify-between w-full h-10 px-3 rounded-xl border border-gray-200 dark:border-white/8 bg-white dark:bg-white/3 text-sm text-gray-700 dark:text-gray-300 hover:border-brand-400 transition-colors focus:outline-none focus:ring-1 focus:ring-brand-500"
      >
        <span className="truncate text-xs">{selected?.name ?? allLabel}</span>
        <FaChevronDown size={10} className={`ml-1 shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[180px] rounded-xl border border-gray-200 dark:border-white/8 bg-white dark:bg-gray-900 shadow-lg overflow-hidden">
          <div className="px-2 pt-2 pb-1">
            <input
              ref={inputRef}
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search…"
              className="w-full h-8 rounded-lg border border-gray-200 dark:border-white/8 bg-gray-50 dark:bg-white/5 px-2.5 text-xs text-gray-700 dark:text-gray-300 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            <button
              onClick={() => { onChange(""); setOpen(false); setQ(""); }}
              className={`flex items-center w-full px-3 py-2.5 text-sm text-left hover:bg-brand-50 dark:hover:bg-white/5 transition-colors ${!value ? "font-semibold text-brand-600 bg-brand-50/60 dark:bg-white/4" : "text-gray-700 dark:text-gray-300"}`}
            >
              {allLabel}
            </button>
            {filtered.length === 0 ? (
              <p className="px-3 py-2.5 text-xs text-gray-400 dark:text-gray-500">No results</p>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.id}
                  onClick={() => { onChange(c.id); setOpen(false); setQ(""); }}
                  className={`flex items-center w-full px-3 py-2.5 text-sm text-left hover:bg-brand-50 dark:hover:bg-white/5 transition-colors ${value === c.id ? "font-semibold text-brand-600 bg-brand-50/60 dark:bg-white/4" : "text-gray-700 dark:text-gray-300"}`}
                >
                  {c.name}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ---------- Component ----------

const SizeWiseStockList = () => {
  const queryClient = useQueryClient();

  const [page, setPage]               = useState(1);
  const [search, setSearch]           = useState("");
  const [debSearch, setDebSearch]     = useState("");
  const [categoryId, setCategoryId]   = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [brandId, setBrandId]         = useState("");
  const [rows, setRows]               = useState<PivotRow[]>([]);
  const [categories, setCategories]   = useState<FilterOption[]>([]);
  const [subcategories, setSubcategories] = useState<FilterOption[]>([]);
  const [brands, setBrands]           = useState<FilterOption[]>([]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

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

  // ── Fetch ─────────────────────────────────────────────────────────────────
  interface PageData { pivot: PivotRow[]; total: number; totalPages: number }

  const { data: pageData, isFetching: isLoading, isError, refetch } = useQuery({
    queryKey: ["size-wise-stock-v2", page] as const,
    queryFn: async (): Promise<PageData> => {
      const res = await axiosSecure.get(`/stock/getallmultiplevariant?page=${page}&limit=${PAGE_LIMIT}`);
      const raw = res.data?.data ?? {};
      const variants = Array.isArray(raw) ? raw : (raw.variants ?? []);
      // This page shows multi-variant products only — the endpoint's
      // total/totalPages include single-variant products too, so derive
      // counts from the filtered pivot instead of trusting the server totals.
      const pivot = buildPivotRows(variants);
      return { pivot, total: pivot.length, totalPages: 1 };
    },
    staleTime: 0,
    retry: false,
  });

  useEffect(() => { if (isError) toast.error("Failed to fetch stock data"); }, [isError]);

  const allRows    = pageData?.pivot      ?? [];
  const total      = pageData?.total      ?? 0;
  const totalPages = pageData?.totalPages ?? 1;

  // Build filter option lists from data
  useEffect(() => {
    const pivot = pageData?.pivot;
    if (!pivot?.length) return;
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    const catMap    = new Map<string, string>();
    const subcatMap = new Map<string, string>();
    const brandMap  = new Map<string, string>();
    for (const r of pivot) {
      if (r.categoryId)    catMap.set(r.categoryId, r.category);
      if (r.subcategoryId) subcatMap.set(r.subcategoryId, r.subcategory);
      if (r.brandId)       brandMap.set(r.brandId, r.brand);
    }
    setCategories(Array.from(catMap.entries()).map(([id, name]) => ({ id, name })));
    setSubcategories(Array.from(subcatMap.entries()).map(([id, name]) => ({ id, name })));
    setBrands(Array.from(brandMap.entries()).map(([id, name]) => ({ id, name })));
  }, [pageData]);

  // ── Search query ──────────────────────────────────────────────────────────
  const { data: searchMatched } = useQuery({
    queryKey: ["size-wise-search", debSearch] as const,
    queryFn: async (): Promise<Set<string>> => {
      const res = await axiosSecure.get(`/sales/get-sales-products?q=${encodeURIComponent(debSearch)}`);
      const matched: { name?: string; barCode?: string; sku?: string }[] =
        res.data?.data?.results ?? res.data?.data ?? [];
      const keys = new Set<string>();
      matched.forEach((m) => {
        if (m.name)    keys.add(m.name.toLowerCase());
        if (m.barCode) keys.add(m.barCode.toLowerCase());
        if (m.sku)     keys.add(m.sku.toLowerCase());
      });
      return keys;
    },
    enabled: !!debSearch,
    staleTime: 2 * 60 * 1000,
  });

  // ── Derived filtered rows ─────────────────────────────────────────────────
  useEffect(() => {
    let r = allRows;
    if (categoryId)    r = r.filter((x) => x.categoryId    === categoryId);
    if (subcategoryId) r = r.filter((x) => x.subcategoryId === subcategoryId);
    if (brandId)       r = r.filter((x) => x.brandId       === brandId);
    if (debSearch) {
      const lq = debSearch.toLowerCase();
      r = r.filter((x) => {
        const localMatch =
          x.productName.toLowerCase().includes(lq) ||
          x.barcode.toLowerCase().includes(lq) ||
          x.category.toLowerCase().includes(lq) ||
          x.subcategory.toLowerCase().includes(lq) ||
          x.brand.toLowerCase().includes(lq);
        if (searchMatched) {
          return searchMatched.has(x.productName.toLowerCase()) || searchMatched.has(x.barcode.toLowerCase()) || localMatch;
        }
        return localMatch;
      });
    }
    setRows(r);
  }, [allRows, categoryId, subcategoryId, brandId, debSearch, searchMatched]);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["size-wise-stock-v2"] });
    refetch();
  };

  // ── Virtualizer ───────────────────────────────────────────────────────────
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_H,
    overscan: 12,
  });
  const virtualItems   = virtualizer.getVirtualItems();
  const totalVH        = virtualizer.getTotalSize();
  const paddingTop     = virtualItems[0]?.start ?? 0;
  const paddingBottom  = virtualItems.length > 0 ? totalVH - (virtualItems[virtualItems.length - 1]?.end ?? 0) : 0;

  const totalStock = rows.reduce((s, r) => s + r.total, 0);
  const hasFilter  = !!(search || categoryId || subcategoryId || brandId);
  const clearAll   = () => { setSearch(""); setCategoryId(""); setSubcategoryId(""); setBrandId(""); };
  const totalCols  = 2 + SIZE_COLS.length + 1;

  const cellBorder = "border border-gray-200 dark:border-white/[0.07]";

  return (
    <div className="space-y-4">

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex items-center gap-4 rounded-2xl border border-teal-200 dark:border-teal-500/20 bg-teal-50 dark:bg-teal-500/10 px-6 py-4">
          <div className="size-10 rounded-xl bg-teal-100 dark:bg-teal-500/20 flex items-center justify-center shrink-0">
            <FaBoxOpen size={16} className="text-teal-600 dark:text-teal-400" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-teal-500 dark:text-teal-400">Total Items</p>
            <p className="text-2xl font-bold text-teal-700 dark:text-teal-300">{rows.length.toLocaleString()}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-2xl border border-green-200 dark:border-green-500/20 bg-green-50 dark:bg-green-500/10 px-6 py-4">
          <div className="size-10 rounded-xl bg-green-100 dark:bg-green-500/20 flex items-center justify-center shrink-0">
            <FaLayerGroup size={15} className="text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-green-500 dark:text-green-400">Total Stock</p>
            <p className="text-2xl font-bold text-green-700 dark:text-green-300">{totalStock.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 flex-wrap rounded-2xl border border-gray-100 dark:border-white/6 bg-white dark:bg-white/2 px-4 py-3">
        <div className="relative flex-1 min-w-40">
          <button
            type="button"
            onClick={focusSearchInput}
            title="Click to resume scanning"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-brand-500 transition-colors"
          >
            <MdOutlineQrCodeScanner size={14} />
          </button>
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Scan barcode or search product…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onBlur={handleSearchBlur}
            onKeyDown={(e) => {
              // Scanners terminate input with Enter — skip the 400ms
              // debounce and filter immediately instead of waiting.
              if (e.key === "Enter") {
                e.preventDefault();
                setDebSearch(search);
              }
            }}
            autoComplete="off"
            className="h-10 w-full rounded-xl border border-gray-200 dark:border-white/8 bg-gray-50 dark:bg-white/3 pl-9 pr-8 text-sm text-gray-700 dark:text-gray-300 placeholder:text-gray-400 focus:border-brand-500 focus:bg-white dark:focus:bg-white/5 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-colors"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <FaTimes size={10} />
            </button>
          )}
        </div>

        <FilterDropdown options={categories}    value={categoryId}    onChange={setCategoryId}    allLabel="All Categories" />
        <FilterDropdown options={subcategories} value={subcategoryId} onChange={setSubcategoryId} allLabel="All Subcategories" />
        <FilterDropdown options={brands}        value={brandId}       onChange={setBrandId}        allLabel="All Brands" />

        <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap shrink-0">
          {rows.length} rows · {total} total
        </span>

        {hasFilter && (
          <button
            onClick={clearAll}
              className="flex items-center gap-1.5 h-10 px-3 rounded-xl /20 bg-red-50 dark:bg-[#D5F0E3]/10 text-[#0A6B43] text-xs font-medium hover:bg-[#B8E4CF] transition-colors shrink-0"
          >
            <FaTimes size={10} /> Clear
          </button>
        )}

        <button
          onClick={handleRefresh}
          disabled={isLoading}
          className="size-10 flex items-center justify-center rounded-xl border border-gray-200 dark:border-white/8 bg-gray-50 dark:bg-white/3 text-gray-500 hover:bg-brand-50 hover:border-brand-300 hover:text-brand-500 transition-colors disabled:opacity-40 shrink-0"
          title="Refresh"
        >
          <FaSync size={11} className={isLoading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* ── Table ── */}
      <div className="rounded-xl border border-gray-200 dark:border-white/[0.07] bg-white dark:bg-white/3 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center" style={{ height: 300 }}>
            <div className="size-8 border-4 border-brand-500/20 border-t-brand-500 rounded-full animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 text-sm text-gray-400 dark:text-gray-500" style={{ height: 200 }}>
            <span>No stock data found.</span>
            {hasFilter && <button onClick={clearAll} className="text-brand-500 text-xs hover:underline">Clear filters</button>}
          </div>
        ) : (
          <div ref={scrollRef} className="no-scrollbar overflow-auto" style={{ maxHeight: 580 }}>
            <table className="border-collapse table-fixed max-md:min-w-[900px] md:w-full">
              <colgroup>
                <col style={{ width: "14%" }} />
                <col style={{ width: "16%" }} />
                {SIZE_COLS.map((c) => <col key={c.label} style={{ width: "4.5%" }} />)}
                <col style={{ width: "5%" }} />
              </colgroup>

              <thead className="bg-slate-50 dark:bg-white/3 sticky top-0 z-10">
                <tr>
                  {[
                    { label: "Subcategory" },
                    { label: "Product" },
                    ...SIZE_COLS.map((c) => ({ label: c.label })),
                    { label: "TTL" },
                  ].map((c) => (
                    <th
                      key={c.label}
                      className={`${cellBorder} px-1.5 py-3 text-[10px] font-bold uppercase tracking-wide text-gray-700 dark:text-gray-200 text-center bg-slate-50 dark:bg-slate-800/60 whitespace-nowrap`}
                    >
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {paddingTop > 0 && (
                  <tr><td colSpan={totalCols} style={{ height: paddingTop, padding: 0, border: "none" }} /></tr>
                )}

                {virtualItems.map((vi) => {
                  const row = rows[vi.index];
                  const isEven = vi.index % 2 === 0;
                  const rowBg  = isEven ? "bg-white dark:bg-transparent" : "bg-slate-50/70 dark:bg-white/[0.015]";

                  return (
                    <tr
                      key={row.key}
                      className={`${rowBg} hover:bg-blue-50/40 dark:hover:bg-white/3 transition-colors`}
                      style={{ height: ROW_H }}
                    >
                      <td className={`${cellBorder} px-1.5 text-center text-[12px] text-gray-600 dark:text-gray-400`}>
                        {row.subcategory}
                      </td>
                      <td className={`${cellBorder} px-1.5 text-center text-[12px] font-semibold text-gray-800 dark:text-gray-200`}>
                        {row.productName}
                      </td>

                      {SIZE_COLS.map((col) => {
                        if (!row.hasAnySize) {
                          return (
                            <td key={col.label} className={`${cellBorder} text-center text-[11px] text-gray-300 dark:text-gray-600`}>
                              N/A
                            </td>
                          );
                        }
                        const val = getSizeVal(row.sizeStock, col);
                        const display = val ?? 0;
                        return (
                          <td key={col.label} className={`${cellBorder} text-center text-[12px]`}>
                            {display > 0 ? (
                              <span className="font-bold text-gray-800 dark:text-gray-100">{display}</span>
                            ) : (
                              <span className="font-medium text-red-400 dark:text-red-500">0</span>
                            )}
                          </td>
                        );
                      })}

                      <td className={`${cellBorder} text-center`}>
                        <span className={`inline-flex items-center justify-center w-full text-[12px] font-bold ${
                          row.total > 0 ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"
                        }`}>
                          {row.total}
                        </span>
                      </td>
                    </tr>
                  );
                })}

                {paddingBottom > 0 && (
                  <tr><td colSpan={totalCols} style={{ height: paddingBottom, padding: 0, border: "none" }} /></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && !hasFilter && (
        <div className="flex items-center justify-between pt-1">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Page {page} of {totalPages} · {total} total records
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1 || isLoading}
              className="size-8 flex items-center justify-center rounded-lg border border-gray-200 dark:border-white/8 bg-white dark:bg-white/3 text-gray-500 hover:bg-brand-50 hover:text-brand-500 disabled:opacity-40 transition-colors"
            >
              <FaChevronLeft size={10} />
            </button>
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400 px-1">{page}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || isLoading}
              className="size-8 flex items-center justify-center rounded-lg border border-gray-200 dark:border-white/8 bg-white dark:bg-white/3 text-gray-500 hover:bg-brand-50 hover:text-brand-500 disabled:opacity-40 transition-colors"
            >
              <FaChevronRight size={10} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SizeWiseStockList;
