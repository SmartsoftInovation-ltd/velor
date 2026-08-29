import { useEffect, useRef, useState, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { FaSync, FaChevronLeft, FaChevronRight, FaTimes, FaBoxOpen, FaLayerGroup } from "react-icons/fa";
import { MdOutlineQrCodeScanner } from "react-icons/md";
import SearchableSelect from "../../form/SearchableSelect";
import axiosSecure from "../../../hooks/useAxiosSecure";
import toast from "react-hot-toast";
import useIsMobile from "../../../hooks/useIsMobile";
import MobileCardList from "../../common/MobileCardList";
import MobileCardRow from "../../common/MobileCardRow";

// ---------- Types ----------

interface Variant {
  _id: string;
  variantName?: string;
  sku?: string;
  barCode?: string;
  size?: string | string[];
  color?: string | string[];
  purchasePrice?: number;
  retailPrice?: number;
  wholesalePrice?: number;
  stockVariant?: number;
  unit?: string;
  groupUnit?: string;
  groupUnitQuantity?: number;
}

interface Subcategory {
  _id: string;
  name: string;
}

interface Product {
  _id: string;
  name: string;
  variantType: "singleVariant" | "multipleVariant";
  variant?: Variant[];
  subcategory?: Subcategory;
  barCode?: string;
  sku?: string;
  size?: string | string[];
  color?: string | string[];
  purchasePrice?: number;
  retailPrice?: number;
  wholesalePrice?: number;
  stock?: number;
  groupUnitQuantity?: number;
  groupUnit?: string;
  unit?: string;
}

interface StockRow {
  key: string;
  barcode: string;
  subcategory: string;
  productName: string;
  variant: string;
  variantType: "single" | "multi";
  size: string;
  color: string;
  buyRate: string;
  retailPrice: string;
  wsPrice: string;
  unit: string;
  groupUnit: string;
  groupUnitQuantity: string;
  groupQty: string;
  stock: number;
}

interface FilterOption {
  value: string;
  label: string;
}

// ---------- Helpers ----------

const na = (v: string | number | undefined | null): string =>
  v !== undefined && v !== null && v !== "" ? String(v) : "N/A";

const strVal = (v: string | string[] | undefined): string => {
  if (!v) return "N/A";
  const result = Array.isArray(v) ? v.join(", ") : v;
  return result.trim() || "N/A";
};

const formatGroupQty = (
  stock: number | undefined,
  groupUnitQty: number | undefined,
  groupUnit: string | undefined,
  unit: string | undefined
): string => {
  if (!stock || !groupUnitQty || groupUnitQty <= 0) return "N/A";
  const groups = Math.floor(stock / groupUnitQty);
  const remainder = stock - groupUnitQty * groups;
  const parts: string[] = [];
  if (groups > 0) parts.push(`${groups} ${groupUnit || ""}`.trim());
  if (remainder > 0) parts.push(`${remainder} ${unit || ""}`.trim());
  return parts.join(" ").trim() || "N/A";
};

const flattenProducts = (products: Product[]): StockRow[] => {
  const rows: StockRow[] = [];
  for (const item of products) {
    if (item.variantType === "multipleVariant") {
      const variants = item.variant ?? [];
      if (variants.length === 0) continue;
      for (const v of variants) {
        // For multi-variant products the unit/group fields live on the variant,
        // falling back to the parent product when a variant omits them.
        const vUnit = v.unit ?? item.unit;
        const vGroupUnit = v.groupUnit ?? item.groupUnit;
        const vGroupUnitQty = v.groupUnitQuantity ?? item.groupUnitQuantity;
        rows.push({
          key: `${item._id}-${v._id}`,
          barcode: v.barCode || v.sku || item.barCode || "N/A",
          subcategory: na(item.subcategory?.name),
          productName: item.name,
          variant: v.variantName || "N/A",
          variantType: "multi",
          size: strVal(v.size),
          color: strVal(v.color),
          buyRate: na(v.purchasePrice ?? item.purchasePrice),
          retailPrice: na(v.retailPrice ?? item.retailPrice),
          wsPrice: na(v.wholesalePrice ?? item.wholesalePrice),
          unit: na(vUnit),
          groupUnit: na(vGroupUnit),
          groupUnitQuantity: na(vGroupUnitQty),
          groupQty: formatGroupQty(v.stockVariant, vGroupUnitQty, vGroupUnit, vUnit),
          stock: v.stockVariant ?? 0,
        });
      }
    } else {
      rows.push({
        key: item._id,
        barcode: item.barCode || item.sku || "N/A",
        subcategory: na(item.subcategory?.name),
        productName: item.name,
        variant: "Single",
        variantType: "single",
        size: strVal(item.size),
        color: strVal(item.color),
        buyRate: na(item.purchasePrice),
        retailPrice: na(item.retailPrice),
        wsPrice: na(item.wholesalePrice),
        unit: na(item.unit),
        groupUnit: na(item.groupUnit),
        groupUnitQuantity: na(item.groupUnitQuantity),
        groupQty: formatGroupQty(item.stock, item.groupUnitQuantity, item.groupUnit, item.unit),
        stock: item.stock ?? 0,
      });
    }
  }
  return rows;
};

// ---------- Columns ----------

const COLS = [
  { label: "Barcode",       width: 150 },
  { label: "Subcategory",   width: 130 },
  { label: "Product",       width: 160 },
  { label: "Size",          width: 70  },
  { label: "Color",         width: 90  },
  { label: "Buy Rate",      width: 90  },
  { label: "Retail Price",  width: 100 },
  { label: "W.S Price",     width: 90  },
  { label: "Unit",          width: 80  },
  { label: "Group Unit",    width: 90  },
  { label: "Group Unit Qty",width: 100 },
  { label: "Group Qty",     width: 100 },
  { label: "Stock",         width: 80  },
];

const PAGE_LIMIT = 50;
const ROW_H = 50;

// ---------- Component ----------

const ViewAllStockList = () => {
  const isMobile = useIsMobile();
  // product rows
  const [rows, setRows]             = useState<StockRow[]>([]);
  const [page, setPage]             = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal]           = useState(0);
  const [isLoading, setIsLoading]   = useState(false);
  const [totalQty, setTotalQty]     = useState(0);

  // search
  const [search, setSearch]       = useState("");
  const [debSearch, setDebSearch] = useState("");

  // filters
  const [categoryId, setCategoryId]       = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [brandId, setBrandId]             = useState("");

  // filter options
  const [categoryOpts, setCategoryOpts]     = useState<FilterOption[]>([]);
  const [subcategoryOpts, setSubcategoryOpts] = useState<FilterOption[]>([]);
  const [brandOpts, setBrandOpts]           = useState<FilterOption[]>([]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ── Load filter options once on mount ──────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const [catRes, subRes, brandRes] = await Promise.all([
          axiosSecure.get("/categories"),
          axiosSecure.get("/subcategories"),
          axiosSecure.get("/brand"),
        ]);
        setCategoryOpts(
          (catRes.data.data?.categories ?? []).map((c: { _id: string; name: string }) => ({
            value: c._id,
            label: c.name,
          }))
        );
        setSubcategoryOpts(
          (subRes.data.data?.subCategories ?? []).map((s: { _id: string; name: string }) => ({
            value: s._id,
            label: s.name,
          }))
        );
        setBrandOpts(
          (brandRes.data.data?.brands ?? []).map((b: { _id: string; name: string }) => ({
            value: b._id,
            label: b.name,
          }))
        );
      } catch {
        // silently ignore — filters just won't populate
      }
    };
    load();
  }, []);

  // ── Debounce search 400 ms ─────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => { setDebSearch(search); setPage(1); }, 400);
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
    // Only auto-restore focus if the user didn't intentionally focus another
    // control (a filter dropdown, pagination button, etc.).
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

  // ── Reset page when any filter changes ────────────────────────────────────
  useEffect(() => { setPage(1); }, [categoryId, subcategoryId, brandId]);

  // ── Fetch products ─────────────────────────────────────────────────────────
  const hasFilter = !!(categoryId || subcategoryId || brandId);

  const fetchPage = useCallback(async (
    p: number,
    q: string,
    cat: string,
    sub: string,
    brand: string,
  ) => {
    setIsLoading(true);
    try {
      let endpoint: string;

      if (q) {
        // text search — no pagination from backend
        endpoint = `/product/search-product?name=${encodeURIComponent(q)}`;
      } else if (cat || sub || brand) {
        // filter by category / subcategory / brand
        const params = new URLSearchParams();
        if (cat)   params.set("category",    cat);
        if (sub)   params.set("subcategory", sub);
        if (brand) params.set("brand",       brand);
        endpoint = `/product/getproduct?${params.toString()}`;
      } else {
        // plain paginated browse
        endpoint = `/product/productperpage?page=${p}&limit=${PAGE_LIMIT}`;
      }

      const res = await axiosSecure.get(endpoint);
      const data = res.data.data;
      const products: Product[] = data?.products ?? [];
      setRows(flattenProducts(products));
      setTotal(data?.total ?? products.length);
      setTotalPages(data?.totalPages ?? 1);
      if (scrollRef.current) scrollRef.current.scrollTop = 0;
    } catch {
      toast.error("Failed to fetch products");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPage(page, debSearch, categoryId, subcategoryId, brandId);
  }, [page, debSearch, categoryId, subcategoryId, brandId, fetchPage]);

  // ── Fetch true grand-total stock across the whole matching set ─────────────
  // (independent of the current page, so it matches CategoryStockDetail's total)
  useEffect(() => {
    const fetchTotalQty = async () => {
      try {
        let endpoint: string;
        if (debSearch) {
          endpoint = `/product/search-product?name=${encodeURIComponent(debSearch)}`;
        } else {
          const params = new URLSearchParams();
          if (categoryId)    params.set("category",    categoryId);
          if (subcategoryId) params.set("subcategory", subcategoryId);
          if (brandId)       params.set("brand",       brandId);
          endpoint = `/product/getproduct?${params.toString()}`;
        }
        const res = await axiosSecure.get(endpoint);
        const products: Product[] = res.data.data?.products ?? [];
        const qty = flattenProducts(products).reduce((sum, r) => sum + r.stock, 0);
        setTotalQty(qty);
      } catch {
        // leave previous totalQty in place
      }
    };
    fetchTotalQty();
  }, [debSearch, categoryId, subcategoryId, brandId]);

  // ── Virtualizer ────────────────────────────────────────────────────────────
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_H,
    overscan: 10,
  });

  const virtualItems  = virtualizer.getVirtualItems();
  const totalVH       = virtualizer.getTotalSize();
  const paddingTop    = virtualItems.length > 0 ? (virtualItems[0]?.start ?? 0) : 0;
  const paddingBottom = virtualItems.length > 0
    ? totalVH - (virtualItems[virtualItems.length - 1]?.end ?? 0)
    : 0;

  const activeFilters = [categoryId, subcategoryId, brandId].filter(Boolean).length;

  const clearAllFilters = () => {
    setCategoryId("");
    setSubcategoryId("");
    setBrandId("");
    setSearch("");
  };

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
            <p className="text-[10px] font-bold uppercase tracking-widest text-green-500 dark:text-green-400">Total Qty</p>
            <p className="text-2xl font-bold text-green-700 dark:text-green-300">{totalQty.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* ── Toolbar: search + filters in one grid ── */}
      <div className="rounded-2xl border border-gray-100 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] p-4 space-y-3">
        {/* Row 1: search + meta + refresh + clear */}
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
          <div className="relative">
            <button
              type="button"
              onClick={focusSearchInput}
              title="Click to resume scanning"
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-brand-500 transition-colors"
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
                  setPage(1);
                }
              }}
              autoComplete="off"
              className="h-10 w-full rounded-xl border border-gray-200 bg-gray-50 dark:bg-white/[0.03] pl-9 pr-9 text-sm text-gray-700 dark:text-gray-300 placeholder:text-gray-400 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-white/[0.08] transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <FaTimes size={11} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
              {rows.length} rows · {total} products
            </span>
            {activeFilters > 0 && (
              <button
                onClick={clearAllFilters}
                  className="flex items-center gap-1.5 h-10 px-3 rounded-xl bg-red-50 text-[#1D4ED8] text-xs font-medium hover:bg-[#C7DAFF] transition-colors /20 dark:bg-[#DCE8FF]/10"
              >
                <FaTimes size={10} />
                Clear ({activeFilters})
              </button>
            )}
            <button
              onClick={() => fetchPage(page, debSearch, categoryId, subcategoryId, brandId)}
              disabled={isLoading}
              className="size-10 flex items-center justify-center rounded-xl border border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.03] text-gray-500 hover:bg-brand-50 hover:border-brand-300 hover:text-brand-500 transition-colors disabled:opacity-40"
              title="Refresh"
            >
              <FaSync size={11} className={isLoading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* Row 2: filter dropdowns */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <SearchableSelect
            options={categoryOpts}
            value={categoryId}
            onChange={(v) => setCategoryId(v)}
            placeholder="Filter by Category"
            searchPlaceholder="Search category..."
          />
          <SearchableSelect
            options={subcategoryOpts}
            value={subcategoryId}
            onChange={(v) => setSubcategoryId(v)}
            placeholder="Filter by Subcategory"
            searchPlaceholder="Search subcategory..."
          />
          <SearchableSelect
            options={brandOpts}
            value={brandId}
            onChange={(v) => setBrandId(v)}
            placeholder="Filter by Brand"
            searchPlaceholder="Search brand..."
          />
        </div>
      </div>

      {/* ── Table card ── */}
      {isMobile ? (
        isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="size-8 border-4 border-brand-500/20 border-t-brand-500 rounded-full animate-spin" />
          </div>
        ) : (
          <MobileCardList
            items={rows}
            getKey={(row) => row.key}
            emptyMessage="No products found."
            renderCard={(row) => (
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <span className="text-xs text-gray-400 font-mono">{row.barcode}</span>
                    <h3 className="font-bold text-sm text-gray-800 dark:text-white/90">
                      {row.productName}
                    </h3>
                  </div>
                  {row.stock === 0 ? (
                    <span className="text-red-500 font-bold text-sm">{row.stock}</span>
                  ) : (
                    <span className="font-bold text-green-600 dark:text-green-400 text-sm">{row.stock}</span>
                  )}
                </div>
                <MobileCardRow label="Subcategory">{row.subcategory}</MobileCardRow>
                <MobileCardRow label="Size / Color">{row.size} / {row.color}</MobileCardRow>
                <MobileCardRow label="Buy Rate">{row.buyRate}</MobileCardRow>
                <MobileCardRow label="Retail Price">{row.retailPrice}</MobileCardRow>
                <MobileCardRow label="W.S Price">{row.wsPrice}</MobileCardRow>
                <MobileCardRow label="Unit">{row.unit}</MobileCardRow>
                <MobileCardRow label="Group Qty">{row.groupQty}</MobileCardRow>
              </div>
            )}
          />
        )
      ) : (
      <div className="rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03] overflow-hidden">
        {/* Header — non-scrolling */}
        <div className="overflow-x-auto border-b border-gray-200 dark:border-white/[0.08]">
          <table className="w-full min-w-[1170px] border-collapse" style={{ tableLayout: "fixed" }}>
            <colgroup>
              {COLS.map((c) => <col key={c.label} style={{ width: c.width }} />)}
            </colgroup>
            <thead className="bg-white dark:bg-gray-900">
              <tr>
                {COLS.map((c) => (
                  <th
                    key={c.label}
                    className="px-3 py-4 text-[11px] font-bold uppercase tracking-widest text-gray-800 dark:text-gray-200 text-center border-x border-gray-100 dark:border-gray-800 first:border-l-0 last:border-r-0"
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
          </table>
        </div>

        {/* Body — virtualized scroll */}
        <div ref={scrollRef} className="overflow-x-auto overflow-y-auto" style={{ maxHeight: 560 }}>
          {isLoading ? (
            <div className="flex items-center justify-center" style={{ height: 300 }}>
              <div className="size-8 border-4 border-brand-500/20 border-t-brand-500 rounded-full animate-spin" />
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 text-sm text-gray-400 dark:text-gray-500" style={{ height: 200 }}>
              <span>No products found.</span>
              {(activeFilters > 0 || search) && (
                <button onClick={clearAllFilters} className="text-brand-500 text-xs hover:underline">
                  Clear all filters
                </button>
              )}
            </div>
          ) : (
            <table className="w-full min-w-[1170px] border-collapse" style={{ tableLayout: "fixed" }}>
              <colgroup>
                {COLS.map((c) => <col key={c.label} style={{ width: c.width }} />)}
              </colgroup>
              <tbody>
                {paddingTop > 0 && (
                  <tr><td colSpan={COLS.length} style={{ height: paddingTop, padding: 0 }} /></tr>
                )}

                {virtualItems.map((vi) => {
                  const row = rows[vi.index];
                  const isEven = vi.index % 2 === 0;

                  return (
                    <tr
                      key={row.key}
                      className={`border-b border-gray-100 dark:border-white/[0.04] transition-colors ${isEven ? "bg-white dark:bg-transparent" : "bg-gray-50/50 dark:bg-white/[0.02]"}`}
                      style={{ height: ROW_H }}
                    >
                      <td className="px-3 text-center text-[12px] font-mono text-gray-600 dark:text-gray-400 border-x border-gray-100 dark:border-gray-800 first:border-l-0">
                        {row.barcode}
                      </td>
                      <td className="px-3 text-center text-[12px] text-gray-600 dark:text-gray-400 border-x border-gray-100 dark:border-gray-800">
                        {row.subcategory}
                      </td>
                      <td className="px-3 text-center text-[13px] font-bold text-gray-800 dark:text-gray-200 border-x border-gray-100 dark:border-gray-800">
                        {row.productName}
                      </td>
                      <td className="px-3 text-center text-[12px] text-gray-600 dark:text-gray-400 border-x border-gray-100 dark:border-gray-800">
                        {row.size}
                      </td>
                      <td className="px-3 text-center border-x border-gray-100 dark:border-gray-800">
                        {row.color !== "N/A" ? (
                          <span className="inline-flex items-center justify-center px-2 py-0.5 rounded text-indigo-700 bg-indigo-50 dark:bg-indigo-500/10 dark:text-indigo-400 text-[11px] font-bold">
                            {row.color}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-[12px]">-</span>
                        )}
                      </td>
                      <td className="px-3 text-center text-[13px] font-bold text-gray-900 dark:text-gray-100 border-x border-gray-100 dark:border-gray-800">
                        {row.buyRate}
                      </td>
                      <td className="px-3 text-center text-[13px] font-bold text-gray-900 dark:text-gray-100 border-x border-gray-100 dark:border-gray-800">
                        {row.retailPrice}
                      </td>
                      <td className="px-3 text-center text-[13px] font-bold text-gray-900 dark:text-gray-100 border-x border-gray-100 dark:border-gray-800">
                        {row.wsPrice}
                      </td>
                      <td className="px-3 text-center text-[12px] text-gray-600 dark:text-gray-400 border-x border-gray-100 dark:border-gray-800">
                        {row.unit}
                      </td>
                      <td className="px-3 text-center text-[12px] text-gray-600 dark:text-gray-400 border-x border-gray-100 dark:border-gray-800">
                        {row.groupUnit}
                      </td>
                      <td className="px-3 text-center text-[13px] font-bold text-gray-900 dark:text-gray-100 border-x border-gray-100 dark:border-gray-800">
                        {row.groupUnitQuantity}
                      </td>
                      <td className="px-3 text-center text-[13px] text-gray-600 dark:text-gray-400 border-x border-gray-100 dark:border-gray-800">
                        {row.groupQty}
                      </td>
                      <td className="px-3 text-center border-x border-gray-100 dark:border-gray-800 last:border-r-0">
                        {row.stock === 0 ? (
                          <span className="text-red-500 font-bold">{row.stock}</span>
                        ) : (
                          <span className="font-bold text-green-600 dark:text-green-400">{row.stock}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {paddingBottom > 0 && (
                  <tr><td colSpan={COLS.length} style={{ height: paddingBottom, padding: 0 }} /></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
      )}

      {/* ── Pagination (only when no filter/search active) ── */}
      {totalPages > 1 && !hasFilter && !debSearch && (
        <div className="flex items-center justify-between pt-1">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Page {page} of {totalPages} · {total} total products
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1 || isLoading}
              className="size-8 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:text-brand-500 transition-colors disabled:opacity-40 dark:border-white/[0.08] dark:bg-white/[0.03]"
            >
              <FaChevronLeft size={11} />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const start = Math.max(1, Math.min(page - 2, totalPages - 4));
              const p = start + i;
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  disabled={isLoading}
                  className={`size-8 flex items-center justify-center rounded-lg text-xs font-medium transition-colors disabled:opacity-40 ${
                    p === page
                      ? "bg-brand-500 text-white"
                      : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-gray-400"
                  }`}
                >
                  {p}
                </button>
              );
            })}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || isLoading}
              className="size-8 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:text-brand-500 transition-colors disabled:opacity-40 dark:border-white/[0.08] dark:bg-white/[0.03]"
            >
              <FaChevronRight size={11} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ViewAllStockList;
