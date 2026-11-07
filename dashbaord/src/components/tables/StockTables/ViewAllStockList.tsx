import { useEffect, useRef, useState, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { FaSync, FaTimes, FaBoxOpen, FaLayerGroup } from "react-icons/fa";
import { MdOutlineQrCodeScanner } from "react-icons/md";
import SearchableSelect from "../../form/SearchableSelect";
import axiosSecure from "../../../hooks/useAxiosSecure";
import useIsMobile from "../../../hooks/useIsMobile";
import MobileCardList from "../../common/MobileCardList";
import InfiniteScrollTrigger from "../../common/InfiniteScrollTrigger";
import MobileCardRow from "../../common/MobileCardRow";
import { showApiError } from "../../../utils/apiError";

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
  // /product/search-product answers with two kinds of document: whole products
  // and standalone variants (a barcode scan usually matches the variant, since
  // that is where barcodes live). A variant row carries no `variantType` or
  // `stock` — its quantity is `stockVariant` and its name sits on the embedded
  // parent — so it has to be read differently or it renders as 0 stock.
  resultType?: "product" | "variant";
  variantName?: string;
  stockVariant?: number;
  product?: {
    _id?: string;
    name?: string;
    subcategory?: Subcategory;
    unit?: string;
    groupUnit?: string;
    groupUnitQuantity?: number;
    purchasePrice?: number;
    retailPrice?: number;
    wholesalePrice?: number;
  };
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
  // A subcategory's parent category, so the list can follow the chosen category
  categoryId?: string;
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

// Barcodes vary in length, so one box can't tell a scan from a name: the term
// is sent as all three and a match on any of them counts.
const searchEndpoint = (q: string): string => {
  const term = encodeURIComponent(q.trim());
  return `/product/search-product?name=${term}&barCode=${term}&sku=${term}`;
};

// A search hit is a standalone variant, not a product, when it has no
// variantType of its own but does carry variant-only fields.
const isVariantResult = (item: Product): boolean =>
  item.resultType === "variant" ||
  (!item.variantType && (item.stockVariant !== undefined || !!item.variantName));

const flattenProducts = (products: Product[]): StockRow[] => {
  const rows: StockRow[] = [];
  const seen = new Set<string>();
  const push = (row: StockRow) => {
    // A name search can return the same variant twice — once nested in its
    // parent product's `variant[]`, once as its own top-level hit.
    if (seen.has(row.key)) return;
    seen.add(row.key);
    rows.push(row);
  };
  for (const item of products) {
    if (isVariantResult(item)) {
      const parent = item.product;
      // The variant's own unit/group fields win; the parent fills the gaps.
      const vUnit = item.unit ?? parent?.unit;
      const vGroupUnit = item.groupUnit ?? parent?.groupUnit;
      const vGroupUnitQty = item.groupUnitQuantity ?? parent?.groupUnitQuantity;
      push({
        key: `${parent?._id ?? "variant"}-${item._id}`,
        barcode: item.barCode || item.sku || "N/A",
        subcategory: na(item.subcategory?.name ?? parent?.subcategory?.name),
        productName: parent?.name || item.variantName || "N/A",
        variant: item.variantName || "N/A",
        variantType: "multi",
        size: strVal(item.size),
        color: strVal(item.color),
        buyRate: na(item.purchasePrice ?? parent?.purchasePrice),
        retailPrice: na(item.retailPrice ?? parent?.retailPrice),
        wsPrice: na(item.wholesalePrice ?? parent?.wholesalePrice),
        unit: na(vUnit),
        groupUnit: na(vGroupUnit),
        groupUnitQuantity: na(vGroupUnitQty),
        groupQty: formatGroupQty(item.stockVariant, vGroupUnitQty, vGroupUnit, vUnit),
        stock: item.stockVariant ?? 0,
      });
    } else if (item.variantType === "multipleVariant") {
      const variants = item.variant ?? [];
      if (variants.length === 0) continue;
      for (const v of variants) {
        // For multi-variant products the unit/group fields live on the variant,
        // falling back to the parent product when a variant omits them.
        const vUnit = v.unit ?? item.unit;
        const vGroupUnit = v.groupUnit ?? item.groupUnit;
        const vGroupUnitQty = v.groupUnitQuantity ?? item.groupUnitQuantity;
        push({
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
      push({
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
  // A later page is loading below the rows already shown
  const [loadingMore, setLoadingMore] = useState(false);
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
  // Only the newest request may fill the table (a slow old search could
  // otherwise land last and replace the right results)
  const requestRef = useRef(0);

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
          (subRes.data.data?.subCategories ?? []).map((s: { _id: string; name: string; category?: string | { _id: string } | null }) => ({
            value: s._id,
            label: s.name,
            categoryId: (s.category && typeof s.category === "object" ? s.category._id : s.category) || "",
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

  // ── Debounce search 300 ms ─────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => { setDebSearch(search); setPage(1); }, 300);
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
    const requestId = ++requestRef.current;
    // Only the plain browse is paged; page 1 replaces the rows, later pages
    // append to them (infinite scroll). Search and filters answer in one go.
    const append = p > 1 && !q && !(cat || sub || brand);
    if (append) setLoadingMore(true);
    else setIsLoading(true);
    try {
      let endpoint: string;

      if (q) {
        // text search — no pagination from backend
        endpoint = searchEndpoint(q);
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
      if (requestId !== requestRef.current) return;
      const data = res.data.data;
      const products: Product[] = data?.products ?? [];
      const flat = flattenProducts(products);
      setRows((prev) => (append ? [...prev, ...flat] : flat));
      setTotal(data?.total ?? products.length);
      setTotalPages(data?.totalPages ?? 1);
      if (!append && scrollRef.current) scrollRef.current.scrollTop = 0;
    } catch (error) {
      if (requestId === requestRef.current) showApiError(error, "Failed to fetch products");
    } finally {
      if (requestId === requestRef.current) {
        setIsLoading(false);
        setLoadingMore(false);
      }
    }
  }, []);

  // The spinner replaces the table only on the first load; after that the
  // current rows stay and dim while a search or filter loads
  const firstLoad = isLoading && rows.length === 0;
  const busy = isLoading || search.trim() !== debSearch.trim();

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
          endpoint = searchEndpoint(debSearch);
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

  // Infinite scroll over the plain browse: ask for the next page once the last
  // rendered row is within a few rows of the end of what is loaded
  const hasMore = !hasFilter && !debSearch && page < totalPages;
  const lastRenderedIndex = virtualItems[virtualItems.length - 1]?.index ?? -1;
  useEffect(() => {
    if (hasMore && !isLoading && !loadingMore && rows.length > 0 && lastRenderedIndex >= rows.length - 5) {
      setPage((p) => p + 1);
    }
  }, [hasMore, isLoading, loadingMore, rows.length, lastRenderedIndex]);

  const activeFilters = [categoryId, subcategoryId, brandId].filter(Boolean).length;

  // Once a category is chosen, only its own subcategories are offered
  const visibleSubcategoryOpts = categoryId
    ? subcategoryOpts.filter((o) => o.categoryId === categoryId)
    : subcategoryOpts;
  const changeCategory = (v: string) => {
    setCategoryId(v);
    // A subcategory of another category no longer applies
    const sub = subcategoryOpts.find((o) => o.value === subcategoryId);
    if (v && sub && sub.categoryId !== v) setSubcategoryId("");
  };

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
          <div className="relative group">
            <button
              type="button"
              onClick={focusSearchInput}
              title="Click to resume scanning"
              aria-label="Resume scanning"
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-accent-500 group-focus-within:text-accent-500 transition-colors"
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
                // Scanners terminate input with Enter — skip the
                // debounce and filter immediately instead of waiting.
                if (e.key === "Enter") {
                  e.preventDefault();
                  setDebSearch(search);
                  setPage(1);
                }
              }}
              autoComplete="off"
              className="h-10 w-full rounded-xl border border-gray-200 bg-gray-50 dark:bg-white/[0.03] pl-9 pr-9 text-sm text-gray-700 dark:text-gray-300 placeholder:text-gray-400 focus:border-accent-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-accent-500/20 dark:border-white/[0.08] transition-colors"
            />
            {busy && search.trim() && (
              <span
                role="status"
                aria-label="Searching"
                className="absolute right-8 top-1/2 size-3.5 -translate-y-1/2 animate-spin rounded-full border-2 border-accent-500/25 border-t-accent-500"
              />
            )}
            {search && (
              <button
                onClick={() => setSearch("")}
                aria-label="Clear search"
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
                  className="shine flex items-center gap-1.5 h-10 px-3 rounded-xl bg-error-50 text-error-600 hover:bg-error-100 dark:bg-error-500/15 dark:text-error-400 dark:hover:bg-error-500/25 text-xs font-medium transition-colors"
              >
                <FaTimes size={10} />
                Clear ({activeFilters})
              </button>
            )}
            <button
              onClick={() => (page === 1 ? fetchPage(1, debSearch, categoryId, subcategoryId, brandId) : setPage(1))}
              disabled={isLoading}
              aria-label="Refresh"
              className="shine size-10 flex items-center justify-center rounded-md border border-accent-100 bg-accent-50 hover:bg-accent-100 text-accent-600 dark:border-accent-500/20 dark:bg-accent-500/15 dark:text-accent-400 transition-all active:scale-90 disabled:opacity-50"
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
            onChange={changeCategory}
            placeholder="Filter by Category"
            searchPlaceholder="Search category..."
          />
          <SearchableSelect
            options={visibleSubcategoryOpts}
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
        firstLoad ? (
          <div className="flex items-center justify-center py-20">
            <div className="size-8 border-4 border-accent-500/20 border-t-accent-500 rounded-full animate-spin" />
          </div>
        ) : (
          <div className={`transition-opacity duration-200 ${busy ? "pointer-events-none opacity-50" : "opacity-100"}`}>
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
          </div>
        )
      ) : (
      <div className="rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03] overflow-hidden">
        {/* Header — non-scrolling */}
        <div className="overflow-x-auto border-b border-gray-200 dark:border-white/[0.08]">
          <table className="w-full min-w-[1170px] border-collapse" style={{ tableLayout: "fixed" }}>
            <colgroup>
              {COLS.map((c) => <col key={c.label} style={{ width: c.width }} />)}
            </colgroup>
            <thead className="bg-gray-50/95 dark:bg-gray-800/95">
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
        <div
          ref={scrollRef}
          aria-busy={busy}
          className={`overflow-x-auto overflow-y-auto transition-opacity duration-200 ${busy && !firstLoad ? "pointer-events-none opacity-50" : "opacity-100"}`}
          style={{ maxHeight: 560 }}
        >
          {firstLoad ? (
            <div className="flex items-center justify-center" style={{ height: 300 }}>
              <div className="size-8 border-4 border-accent-500/20 border-t-accent-500 rounded-full animate-spin" />
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 text-sm text-gray-400 dark:text-gray-500" style={{ height: 200 }}>
              <span>No products found.</span>
              {(activeFilters > 0 || search) && (
                <button onClick={clearAllFilters} className="text-accent-500 text-xs hover:underline">
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

      {/* Desktop loads from the virtualizer above; the mobile cards grow the page */}
      <InfiniteScrollTrigger
        watch={isMobile}
        hasMore={hasMore}
        loading={loadingMore}
        onLoadMore={() => setPage((p) => p + 1)}
        label="Loading more products…"
      />
    </div>
  );
};

export default ViewAllStockList;
