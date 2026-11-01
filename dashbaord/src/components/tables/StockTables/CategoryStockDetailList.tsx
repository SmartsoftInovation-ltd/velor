import { useEffect, useRef, useState, useCallback } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { FaSync, FaTimes, FaBoxOpen, FaLayerGroup } from "react-icons/fa";
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
  stockVariant?: number;
  initialStock?: number;
  stockAdjustmentPlus?: number;
  stockAdjustmentMinus?: number;
  totalSales?: number;
  posSold?: number;
  totalByReturnQuantity?: number;
  totalSalesReturnQuantity?: number;
  purchaseQuantityStock?: number;
  purchaseReturnStock?: number;
  salesReturnStock?: number;
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
  stock?: number;
  initialStock?: number;
  stockAdjustmentPlus?: number;
  stockAdjustmentMinus?: number;
  totalSales?: number;
  posSold?: number;
  totalByReturnQuantity?: number;
  totalSalesReturnQuantity?: number;
  purchaseQuantityStock?: number;
  purchaseReturnStock?: number;
  salesReturnStock?: number;
}

interface StockRow {
  key: string;
  barcode: string;
  subcategory: string;
  productName: string;
  size: string;
  color: string;
  opening: number;
  buyQty: number;
  adjPlus: number;
  adjMinus: number;
  sold: number;
  buyReturn: number;
  salesReturn: number;
  courierReturn: number;
  stock: number;
  posSold: number;
}

interface FilterOption {
  value: string;
  label: string;
}

// ---------- Helpers ----------

const num = (v: number | undefined | null): number => v ?? 0;

const strVal = (v: string | string[] | undefined): string => {
  if (!v) return "-";
  const result = Array.isArray(v) ? v.join(", ") : v;
  return result.trim() || "-";
};

// Stock = (Opening + Purchase QTY + Adj(+) + Sales Return + Courier Return)
//       - (POS Sold + Web Sold + Adj(-) + Purchase Return)
const calcStock = (
  opening: number,
  buyQty: number,
  adjPlus: number,
  adjMinus: number,
  sold: number,
  posSold: number,
  buyReturn: number,
  salesReturn: number,
  courierReturn: number,
): number =>
  opening +
  buyQty +
  adjPlus +
  salesReturn +
  courierReturn -
  (posSold + sold + adjMinus + buyReturn);

const flattenProducts = (products: Product[]): StockRow[] => {
  const rows: StockRow[] = [];
  for (const item of products) {
    if (item.variantType === "multipleVariant") {
      const variants = item.variant ?? [];
      if (variants.length === 0) continue;
      for (const v of variants) {
        const opening = num(v.initialStock);
        const buyQty = num(v.purchaseQuantityStock);
        const adjPlus = num(v.stockAdjustmentPlus);
        const adjMinus = num(v.stockAdjustmentMinus);
        const sold = num(v.totalSales);
        const buyReturn = num(v.purchaseReturnStock);
        const salesReturn = num(v.salesReturnStock);
        const courierReturn = num(v.totalSalesReturnQuantity);
        const posSold = num(v.posSold);
        rows.push({
          key: `${item._id}-${v._id}`,
          barcode: v.barCode || v.sku || item.barCode || "-",
          subcategory: item.subcategory?.name || "-",
          productName: item.name,
          size: strVal(v.size),
          color: strVal(v.color),
          opening,
          buyQty,
          adjPlus,
          adjMinus,
          sold,
          posSold,
          buyReturn,
          salesReturn,
          courierReturn,
          stock: calcStock(
            opening,
            buyQty,
            adjPlus,
            adjMinus,
            sold,
            posSold,
            buyReturn,
            salesReturn,
            courierReturn,
          ),
        });
      }
    } else {
      const opening = num(item.initialStock);
      const buyQty = num(item.purchaseQuantityStock);
      const adjPlus = num(item.stockAdjustmentPlus);
      const adjMinus = num(item.stockAdjustmentMinus);
      const sold = num(item.totalSales);
      const buyReturn = num(item.purchaseReturnStock);
      const salesReturn = num(item.salesReturnStock);
      const courierReturn = num(item.totalSalesReturnQuantity);
      const posSold = num(item.posSold);
      rows.push({
        key: item._id,
        barcode: item.barCode || item.sku || "-",
        subcategory: item.subcategory?.name || "-",
        productName: item.name,
        size: strVal(item.size),
        color: strVal(item.color),
        opening,
        buyQty,
        adjPlus,
        adjMinus,
        sold,
        posSold,
        buyReturn,
        salesReturn,
        courierReturn,
        stock: calcStock(
          opening,
          buyQty,
          adjPlus,
          adjMinus,
          sold,
          posSold,
          buyReturn,
          salesReturn,
          courierReturn,
        ),
      });
    }
  }
  return rows;
};

// ---------- Columns ----------

const COLS = [
  { label: "Barcode", width: 100 },
  { label: "Subcategory", width: 100 },
  { label: "Product", width: 120 },
  { label: "Size", width: 60 },
  { label: "Color", width: 80 },
  { label: "Opening", width: 75 },
  { label: "Purchase QTY", width: 75 },
  { label: "Adj(+)", width: 65 },
  { label: "Adj(-)", width: 65 },
  { label: "WEB-SOLD", width: 85 },
  { label: "POS-SOLD", width: 85 },
  { label: "Purchase Return", width: 70 },
  { label: "Sales Return", width: 70 },
  { label: "Courier Return", width: 90 },
  { label: "Stock", width: 70 },
];

const ROW_H = 50;

// ---------- Component ----------

const CategoryStockDetailList = () => {
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const [search, setSearch] = useState("");
  const [debSearch, setDebSearch] = useState("");

  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");

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

  // ── Filter options ─────────────────────────────────────────────────────────
  const { data: categoryOpts = [] } = useQuery({
    queryKey: ["categories-opts"] as const,
    queryFn: async (): Promise<FilterOption[]> => {
      const { data } = await axiosSecure.get("/categories");
      return (data.data?.categories ?? []).map(
        (c: { _id: string; name: string }) => ({
          value: c._id,
          label: c.name,
        }),
      );
    },
    staleTime: 10 * 60 * 1000,
  });

  const { data: subcategoryOpts = [] } = useQuery({
    queryKey: ["subcategories-opts"] as const,
    queryFn: async (): Promise<FilterOption[]> => {
      const { data } = await axiosSecure.get("/subcategories");
      return (data.data?.subCategories ?? []).map(
        (s: { _id: string; name: string }) => ({
          value: s._id,
          label: s.name,
        }),
      );
    },
    staleTime: 10 * 60 * 1000,
  });

  // ── Debounce search 300 ms ─────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setDebSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // ── Fetch products with cache ──────────────────────────────────────────────
  const buildEndpoint = (q: string, cat: string, sub: string) => {
    if (q) return `/product/search-product?name=${encodeURIComponent(q)}`;
    const params = new URLSearchParams();
    if (cat) params.set("category", cat);
    if (sub) params.set("subcategory", sub);
    const qs = params.toString();
    return qs ? `/product/getproduct?${qs}` : "/product/getproduct";
  };

  const {
    data,
    isFetching: isLoading,
    isError,
    refetch,
    isPlaceholderData,
  } = useQuery({
    queryKey: ["category-stock", debSearch, categoryId, subcategoryId] as const,
    queryFn: async (): Promise<StockRow[]> => {
      const endpoint = buildEndpoint(debSearch, categoryId, subcategoryId);
      const res = await axiosSecure.get(endpoint);
      const products: Product[] = res.data.data?.products ?? [];
      return flattenProducts(products);
    },
    staleTime: 0,
    refetchOnMount: true,
    gcTime: 0,
    // Keep the current rows (dimmed) while a new search or filter loads
    placeholderData: keepPreviousData,
  });

  const rows: StockRow[] = data ?? [];
  // The spinner replaces the table only on the first load
  const firstLoad = isLoading && !data;
  const busy = search.trim() !== debSearch.trim() || (isLoading && isPlaceholderData);

  useEffect(() => {
    if (isError) toast.error("Failed to fetch products");
  }, [isError]);

  // Reset scroll on data change
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [rows]);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["category-stock"] });
    refetch();
  };

  // ── Virtualizer ────────────────────────────────────────────────────────────
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_H,
    overscan: 10,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const totalVH = virtualizer.getTotalSize();
  const paddingTop =
    virtualItems.length > 0 ? (virtualItems[0]?.start ?? 0) : 0;
  const paddingBottom =
    virtualItems.length > 0
      ? totalVH - (virtualItems[virtualItems.length - 1]?.end ?? 0)
      : 0;

  const activeFilters = [categoryId, subcategoryId].filter(Boolean).length;
  const totalStock = rows.reduce((sum, r) => sum + r.stock, 0);

  const clearAll = () => {
    setCategoryId("");
    setSubcategoryId("");
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
            <p className="text-[10px] font-bold uppercase tracking-widest text-teal-500 dark:text-teal-400">
              Total Items
            </p>
            <p className="text-2xl font-bold text-teal-700 dark:text-teal-300">
              {rows.length.toLocaleString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-2xl border border-green-200 dark:border-green-500/20 bg-green-50 dark:bg-green-500/10 px-6 py-4">
          <div className="size-10 rounded-xl bg-green-100 dark:bg-green-500/20 flex items-center justify-center shrink-0">
            <FaLayerGroup
              size={15}
              className="text-green-600 dark:text-green-400"
            />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-green-500 dark:text-green-400">
              Total Stock
            </p>
            <p className="text-2xl font-bold text-green-700 dark:text-green-300">
              {totalStock.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="rounded-2xl border border-gray-100 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] p-4 space-y-3">
        {/* Search row */}
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
              {rows.length} rows
            </span>
            {activeFilters > 0 && (
              <button
                onClick={clearAll}
                  className="shine flex items-center gap-1.5 h-10 px-3 rounded-xl bg-error-50 text-error-600 hover:bg-error-100 dark:bg-error-500/15 dark:text-error-400 dark:hover:bg-error-500/25 text-xs font-medium transition-colors"
              >
                <FaTimes size={10} />
                Clear ({activeFilters})
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
        </div>

        {/* Filter dropdowns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                    <span className="text-xs text-gray-400">{row.barcode}</span>
                    <h3 className="font-bold text-sm text-gray-800 dark:text-white/90">
                      {row.productName}
                    </h3>
                  </div>
                  <span className="font-bold text-green-600 dark:text-green-400 text-sm">
                    {row.stock}
                  </span>
                </div>
                <MobileCardRow label="Subcategory">{row.subcategory}</MobileCardRow>
                <MobileCardRow label="Size / Color">{row.size} / {row.color}</MobileCardRow>
                <MobileCardRow label="Opening">{row.opening}</MobileCardRow>
                <MobileCardRow label="Purchase Qty">{row.buyQty}</MobileCardRow>
                <MobileCardRow label="Adj (+) / Adj (-)">{row.adjPlus} / {row.adjMinus}</MobileCardRow>
                <MobileCardRow label="Web Sold / POS Sold">{row.sold} / {row.posSold}</MobileCardRow>
                <MobileCardRow label="Purchase Return">{row.buyReturn}</MobileCardRow>
                <MobileCardRow label="Sales Return">{row.salesReturn}</MobileCardRow>
                <MobileCardRow label="Courier Return">{row.courierReturn}</MobileCardRow>
              </div>
            )}
          />
          </div>
        )
      ) : (
      <div className="rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03] overflow-hidden">
        {/* Sticky header */}
        <div className="overflow-x-auto border-b border-gray-200 dark:border-white/[0.08]">
          <table
            className="w-full min-w-[1250px] border-collapse"
            style={{ tableLayout: "fixed" }}
          >
            <colgroup>
              {COLS.map((c) => (
                <col key={c.label} style={{ width: c.width }} />
              ))}
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

        {/* Virtualized body */}
        <div
          ref={scrollRef}
          aria-busy={busy}
          className={`no-scrollbar overflow-x-auto overflow-y-auto transition-opacity duration-200 ${busy && !firstLoad ? "pointer-events-none opacity-50" : "opacity-100"}`}
          style={{ maxHeight: 560 }}
        >
          {firstLoad ? (
            <div
              className="flex items-center justify-center"
              style={{ height: 300 }}
            >
              <div className="size-8 border-4 border-accent-500/20 border-t-accent-500 rounded-full animate-spin" />
            </div>
          ) : rows.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center gap-2 text-sm text-gray-400 dark:text-gray-500"
              style={{ height: 200 }}
            >
              <span>No products found.</span>
              {(activeFilters > 0 || search) && (
                <button
                  onClick={clearAll}
                  className="text-accent-500 text-xs hover:underline"
                >
                  Clear all filters
                </button>
              )}
            </div>
          ) : (
            <table
              className="w-full min-w-[1250px] border-collapse"
              style={{ tableLayout: "fixed" }}
            >
              <colgroup>
                {COLS.map((c) => (
                  <col key={c.label} style={{ width: c.width }} />
                ))}
              </colgroup>
              <tbody>
                {paddingTop > 0 && (
                  <tr>
                    <td
                      colSpan={COLS.length}
                      style={{ height: paddingTop, padding: 0 }}
                    />
                  </tr>
                )}

                {virtualItems.map((vi) => {
                  const row = rows[vi.index];
                  const isEven = vi.index % 2 === 0;

                  const renderVal = (val: number) => {
                    if (val === 0)
                      return <span className="text-red-500">{val}</span>;
                    return (
                      <span className="font-bold text-gray-900 dark:text-gray-100">
                        {val}
                      </span>
                    );
                  };

                  return (
                    <tr
                      key={row.key}
                      className={`border-b border-gray-100 dark:border-white/[0.04] transition-colors ${isEven ? "bg-white dark:bg-transparent" : "bg-gray-50/50 dark:bg-white/[0.02]"}`}
                      style={{ height: ROW_H }}
                    >
                      <td className="px-3 text-center text-[12px] text-gray-600 dark:text-gray-400 border-x border-gray-100 dark:border-gray-800 first:border-l-0">
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
                        {row.color !== "-" ? (
                          <span className="inline-flex items-center justify-center px-2 py-0.5 rounded text-indigo-700 bg-indigo-50 dark:bg-indigo-500/10 dark:text-indigo-400 text-[11px] font-bold">
                            {row.color}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-[12px]">-</span>
                        )}
                      </td>
                      <td className="px-3 text-center text-[13px] border-x border-gray-100 dark:border-gray-800">
                        {renderVal(row.opening)}
                      </td>
                      <td className="px-3 text-center text-[13px] border-x border-gray-100 dark:border-gray-800">
                        {renderVal(row.buyQty)}
                      </td>
                      <td className="px-3 text-center text-[13px] border-x border-gray-100 dark:border-gray-800">
                        {renderVal(row.adjPlus)}
                      </td>
                      <td className="px-3 text-center text-[13px] border-x border-gray-100 dark:border-gray-800">
                        {renderVal(row.adjMinus)}
                      </td>
                      <td className="px-3 text-center text-[13px] border-x border-gray-100 dark:border-gray-800">
                        {renderVal(row.sold)}
                      </td>
                      <td className="px-3 text-center text-[13px] border-x border-gray-100 dark:border-gray-800">
                        {renderVal(row.posSold)}
                      </td>
                      <td className="px-3 text-center text-[13px] border-x border-gray-100 dark:border-gray-800">
                        {renderVal(row.buyReturn)}
                      </td>
                      <td className="px-3 text-center text-[13px] border-x border-gray-100 dark:border-gray-800">
                        {renderVal(row.salesReturn)}
                      </td>
                      <td className="px-3 text-center text-[13px] border-x border-gray-100 dark:border-gray-800">
                        {renderVal(row.courierReturn)}
                      </td>
                      <td className="px-3 text-center text-[13px] border-x border-gray-100 dark:border-gray-800 last:border-r-0">
                        <span className="font-bold text-green-600 dark:text-green-400">
                          {row.stock}
                        </span>
                      </td>
                    </tr>
                  );
                })}

                {paddingBottom > 0 && (
                  <tr>
                    <td
                      colSpan={COLS.length}
                      style={{ height: paddingBottom, padding: 0 }}
                    />
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
      )}
    </div>
  );
};

export default CategoryStockDetailList;
