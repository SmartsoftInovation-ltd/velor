import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  FaSync,
  FaChevronLeft,
  FaChevronRight,
  FaEye,
  FaEdit,
} from "react-icons/fa";
import { MdDelete, MdOutlineQrCodeScanner } from "react-icons/md";
import { Modal } from "../../ui/modal";
import Button from "../../ui/button/Button";
import axiosSecure from "../../../hooks/useAxiosSecure";
import toast from "react-hot-toast";
import useIsMobile from "../../../hooks/useIsMobile";
import MobileCardList from "../../common/MobileCardList";
import MobileCardRow from "../../common/MobileCardRow";

// ---------- Types ----------

interface SubRef {
  name: string;
}
interface ProdRef {
  name?: string;
  subcategory?: SubRef;
  category?: SubRef;
  brand?: SubRef;
}

interface ProductId {
  name: string;
  barCode?: string;
  sku?: string;
  size?: string;
  color?: string;
  stock?: number;
  subcategory?: SubRef;
  category?: SubRef;
  brand?: SubRef;
  purchasePrice?: number;
  retailPrice?: number;
  wholesalePrice?: number;
  groupUnit?: string;
  groupUnitQuantity?: number;
  unit?: string;
}
interface VariantId {
  variantName: string;
  barCode?: string;
  sku?: string;
  size?: string;
  color?: string;
  stockVariant?: number;
  purchasePrice?: number;
  retailPrice?: number;
  wholesalePrice?: number;
  product?: ProdRef;
}
interface StockAdjustment {
  _id: string;
  date: string;
  increaseQuantity: number | null;
  decreaseQuantity: number | null;
  adjustReason: string;
  productId?: ProductId;
  variantId?: VariantId;
}

// ---------- Tooltip ----------

const Tooltip = ({
  text,
  children,
}: {
  text: string;
  children: React.ReactNode;
}) => {
  const [v, setV] = useState(false);
  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setV(true)}
      onMouseLeave={() => setV(false)}
    >
      {children}
      {v && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-[10px] font-bold rounded shadow-lg whitespace-nowrap z-[9999] pointer-events-none">
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </div>
      )}
    </div>
  );
};

// ---------- Columns ----------

const COLS = [
  { label: "Adj. ID", width: 110 },
  { label: "Barcode", width: 145 },
  { label: "Date", width: 95 },
  { label: "Product", width: 145 },
  { label: "Subcategory", width: 125 },
  { label: "Variant", width: 105 },
  { label: "Size", width: 65 },
  { label: "Color", width: 85 },
  { label: "Adj. (+)", width: 75 },
  { label: "Adj. (-)", width: 75 },
  { label: "Reason", width: 165 },
  { label: "Actions", width: 130 },
];

const PAGE_LIMIT = 30;
const ROW_H = 56;

// ---------- Component ----------

const StockAdjustmentList = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [list, setList] = useState<StockAdjustment[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [debSearch, setDebSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // delete only
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Debounce 400 ms
  useEffect(() => {
    const t = setTimeout(() => {
      setDebSearch(search);
      setPage(1);
    }, 400);
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

  const fetchPage = useCallback(async (p: number, q: string) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(p),
        limit: String(PAGE_LIMIT),
      });
      if (q) params.set("q", q);
      const { data } = await axiosSecure.get(`/stock/stock-adjust?${params}`);
      setList(data.data.stockAdjusts ?? []);
      setTotal(data.data.total ?? 0);
      setTotalPages(data.data.totalPages ?? 1);
      if (scrollRef.current) scrollRef.current.scrollTop = 0;
    } catch {
      toast.error("Failed to fetch stock adjustments");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPage(page, debSearch);
  }, [page, debSearch, fetchPage]);

  // Delete the stock adjustment and reverse the stock change
  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      await axiosSecure.delete(`/stock/deletestockadjust/${deleteId}`);
      toast.success("Stock adjustment deleted");
      setDeleteId(null);
      fetchPage(page, debSearch);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed to delete");
    } finally {
      setIsDeleting(false);
    }
  };

  // Virtualizer
  const virtualizer = useVirtualizer({
    count: list.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_H,
    overscan: 8,
  });
  const virtualItems = virtualizer.getVirtualItems();
  const totalVH = virtualizer.getTotalSize();
  const paddingTop = virtualItems[0]?.start ?? 0;
  const paddingBottom =
    virtualItems.length > 0
      ? totalVH - (virtualItems[virtualItems.length - 1]?.end ?? 0)
      : 0;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <button
            type="button"
            onClick={focusSearchInput}
            title="Click to resume scanning"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-brand-500 transition-colors"
          >
            <MdOutlineQrCodeScanner size={13} />
          </button>
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Scan barcode or search by product name…"
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
            className="h-10 w-full rounded-xl border border-gray-200 bg-white pl-8 pr-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-gray-300"
          />
        </div>
        <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto shrink-0">
          {total} record{total !== 1 ? "s" : ""}
        </span>
        <button
          onClick={() => fetchPage(page, debSearch)}
          disabled={isLoading}
          className="size-9 flex items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:text-brand-500 transition-colors disabled:opacity-40 dark:border-white/[0.08] dark:bg-white/[0.03]"
        >
          <FaSync size={11} className={isLoading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Table card */}
      {isMobile ? (
        isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="size-8 border-4 border-brand-500/20 border-t-brand-500 rounded-full animate-spin" />
          </div>
        ) : (
          <MobileCardList
            items={list}
            getKey={(item) => item._id}
            emptyMessage={
              debSearch
                ? `No stock adjustments found for "${debSearch}"`
                : "No stock adjustments yet"
            }
            renderCard={(item, i) => {
              const index = (page - 1) * PAGE_LIMIT + i;
              const isVar = !item.productId && !!item.variantId;
              const barcode =
                item.productId?.barCode ??
                item.variantId?.barCode ??
                item.variantId?.sku ??
                "N/A";
              const product =
                item.productId?.name ??
                item.variantId?.product?.name ??
                "N/A";
              const variant = item.productId
                ? "Single"
                : (item.variantId?.variantName ?? "N/A");
              const size = item.productId?.size ?? item.variantId?.size ?? "N/A";
              const color = item.productId?.color ?? item.variantId?.color ?? "N/A";
              return (
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <span className="text-xs text-gray-400">
                        SADJ-{String(index + 1).padStart(6, "0")}
                      </span>
                      <h3 className="font-bold text-sm text-gray-800 dark:text-white/90">
                        {product}
                      </h3>
                    </div>
                    <span
                      className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                        isVar
                          ? "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400"
                          : "bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400"
                      }`}
                    >
                      {variant}
                    </span>
                  </div>
                  <MobileCardRow label="Barcode">
                    <span className="font-mono">{barcode}</span>
                  </MobileCardRow>
                  <MobileCardRow label="Date">
                    {new Date(item.date).toLocaleDateString()}
                  </MobileCardRow>
                  <MobileCardRow label="Size">{size}</MobileCardRow>
                  <MobileCardRow label="Color">{color}</MobileCardRow>
                  <MobileCardRow label="Adjustment">
                    {item.increaseQuantity != null ? (
                      <span className="text-green-600 dark:text-green-400 font-bold">
                        +{item.increaseQuantity}
                      </span>
                    ) : item.decreaseQuantity != null ? (
                      <span className="text-red-600 dark:text-red-400 font-bold">
                        -{item.decreaseQuantity}
                      </span>
                    ) : (
                      "—"
                    )}
                  </MobileCardRow>
                  {item.adjustReason && (
                    <MobileCardRow label="Reason">
                      {item.adjustReason}
                    </MobileCardRow>
                  )}
                  <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-white/5">
                    <button
                      onClick={() => navigate(`/stock-adjustment-view/${item._id}`)}
                      className="min-h-11 min-w-11 rounded-xl flex items-center justify-center border border-gray-200 bg-white text-gray-500 hover:border-brand-400 hover:text-brand-500 hover:bg-brand-50 transition-colors dark:border-white/[0.08] dark:bg-white/[0.03] dark:hover:bg-brand-500/10 dark:hover:text-brand-400"
                    >
                      <FaEye size={14} />
                    </button>
                    <button
                      onClick={() => navigate(`/stock-adjustment-edit/${item._id}`)}
                      className="min-h-11 min-w-11 rounded-xl flex items-center justify-center border border-gray-200 bg-white text-gray-500 hover:border-amber-400 hover:text-amber-500 hover:bg-amber-50 transition-colors dark:border-white/[0.08] dark:bg-white/[0.03] dark:hover:bg-amber-500/10 dark:hover:text-amber-400"
                    >
                      <FaEdit size={14} />
                    </button>
                    <button
                      onClick={() => setDeleteId(item._id)}
                      className="min-h-11 min-w-11 rounded-xl flex items-center justify-center bg-red-500 text-white hover:bg-red-600 transition-colors"
                    >
                      <MdDelete size={16} />
                    </button>
                  </div>
                </div>
              );
            }}
          />
        )
      ) : (
      <div className="rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03] overflow-hidden">
        {/* Fixed header */}
        <div className="overflow-x-auto border-b border-gray-200 dark:border-white/[0.08]">
          <table
            className="w-full min-w-[1390px] border-collapse"
            style={{ tableLayout: "fixed" }}
          >
            <colgroup>
              {COLS.map((c) => (
                <col key={c.label} style={{ width: c.width }} />
              ))}
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

        {/* Virtualized body */}
        <div
          ref={scrollRef}
          className="no-scrollbar overflow-x-auto overflow-y-auto"
          style={{ maxHeight: 560 }}
        >
          {isLoading ? (
            <div
              className="flex items-center justify-center"
              style={{ height: 300 }}
            >
              <div className="size-8 border-4 border-brand-500/20 border-t-brand-500 rounded-full animate-spin" />
            </div>
          ) : list.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
              <div className="size-14 rounded-full bg-gray-100 dark:bg-white/[0.05] flex items-center justify-center mb-1">
                <svg
                  className="size-7 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"
                  />
                </svg>
              </div>
              <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">
                {debSearch
                  ? `No stock adjustments found for "${debSearch}"`
                  : "No stock adjustments yet"}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                {debSearch
                  ? "Try a different name or barcode"
                  : "Create a stock adjustment to get started"}
              </p>
            </div>
          ) : (
            <table
              className="w-full min-w-[1390px] border-collapse"
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
                  const item = list[vi.index];
                  const index = (page - 1) * PAGE_LIMIT + vi.index;
                  const isEven = vi.index % 2 === 0;
                  const isVar = !item.productId && !!item.variantId;

                  const barcode =
                    item.productId?.barCode ??
                    item.variantId?.barCode ??
                    item.variantId?.sku ??
                    "N/A";
                  const product =
                    item.productId?.name ??
                    item.variantId?.product?.name ??
                    "N/A";
                  const subcat =
                    item.productId?.subcategory?.name ??
                    item.variantId?.product?.subcategory?.name ??
                    "N/A";
                  const variant = item.productId
                    ? "Single"
                    : (item.variantId?.variantName ?? "N/A");
                  const size =
                    item.productId?.size ?? item.variantId?.size ?? "N/A";
                  const color =
                    item.productId?.color ?? item.variantId?.color ?? "N/A";

                  return (
                    <tr
                      key={item._id}
                      className={`border-b border-gray-100 dark:border-white/[0.04] transition-colors ${isEven ? "bg-white dark:bg-transparent" : "bg-gray-50/50 dark:bg-white/[0.02]"}`}
                      style={{ height: ROW_H }}
                    >
                      <td className="px-3 text-center text-[12px] text-gray-600 dark:text-gray-400 border-x border-gray-100 dark:border-gray-800 first:border-l-0">
                        SADJ-{String(index + 1).padStart(6, "0")}
                      </td>
                      <td className="px-3 text-center text-[12px] font-mono text-gray-600 dark:text-gray-400 border-x border-gray-100 dark:border-gray-800">
                        {barcode}
                      </td>
                      <td className="px-3 text-center text-[12px] text-gray-500 dark:text-gray-400 border-x border-gray-100 dark:border-gray-800">
                        {new Date(item.date).toLocaleDateString()}
                      </td>
                      <td className="px-3 text-center text-[13px] font-bold text-gray-800 dark:text-gray-200 truncate max-w-0 border-x border-gray-100 dark:border-gray-800">
                        <span className="block truncate" title={product}>
                          {product}
                        </span>
                      </td>
                      <td className="px-3 text-center text-[12px] text-gray-600 dark:text-gray-400 border-x border-gray-100 dark:border-gray-800">
                        {subcat}
                      </td>
                      <td className="px-3 text-center border-x border-gray-100 dark:border-gray-800">
                        <span
                          className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                            isVar
                              ? "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400"
                              : "bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400"
                          }`}
                        >
                          {variant}
                        </span>
                      </td>
                      <td className="px-3 text-center text-[12px] text-gray-600 dark:text-gray-400 border-x border-gray-100 dark:border-gray-800">
                        {size}
                      </td>
                      <td className="px-3 text-center border-x border-gray-100 dark:border-gray-800">
                        {color !== "N/A" ? (
                          <span className="inline-flex items-center justify-center px-2 py-0.5 rounded text-indigo-700 bg-indigo-50 dark:bg-indigo-500/10 dark:text-indigo-400 text-[11px] font-bold">
                            {color}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-[12px]">-</span>
                        )}
                      </td>
                      <td className="px-3 text-center border-x border-gray-100 dark:border-gray-800">
                        {item.increaseQuantity != null ? (
                          <span className="inline-flex items-center justify-center px-2 py-0.5 rounded bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400 text-[13px] font-bold">
                            +{item.increaseQuantity}
                          </span>
                        ) : (
                          <span className="text-gray-300 dark:text-gray-600">
                            —
                          </span>
                        )}
                      </td>
                      <td className="px-3 text-center border-x border-gray-100 dark:border-gray-800">
                        {item.decreaseQuantity != null ? (
                          <span className="inline-flex items-center justify-center px-2 py-0.5 rounded bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400 text-[13px] font-bold">
                            -{item.decreaseQuantity}
                          </span>
                        ) : (
                          <span className="text-gray-300 dark:text-gray-600">
                            —
                          </span>
                        )}
                      </td>
                      <td className="px-3 text-center text-[12px] text-gray-600 dark:text-gray-400 max-w-0 border-x border-gray-100 dark:border-gray-800">
                        <span
                          className="block truncate"
                          title={item.adjustReason}
                        >
                          {item.adjustReason}
                        </span>
                      </td>

                      {/* Action buttons */}
                      <td className="px-3 text-center border-x border-gray-100 dark:border-gray-800 last:border-r-0">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* View */}
                          <Tooltip text="View">
                            <button
                              onClick={() =>
                                navigate(`/stock-adjustment-view/${item._id}`)
                              }
                              className="size-8 rounded-xl flex items-center justify-center border border-gray-200 bg-white text-gray-500 hover:border-brand-400 hover:text-brand-500 hover:bg-brand-50 transition-colors dark:border-white/[0.08] dark:bg-white/[0.03] dark:hover:bg-brand-500/10 dark:hover:text-brand-400"
                            >
                              <FaEye size={13} />
                            </button>
                          </Tooltip>
                          {/* Edit */}
                          <Tooltip text="Edit">
                            <button
                              onClick={() =>
                                navigate(`/stock-adjustment-edit/${item._id}`)
                              }
                              className="size-8 rounded-xl flex items-center justify-center border border-gray-200 bg-white text-gray-500 hover:border-amber-400 hover:text-amber-500 hover:bg-amber-50 transition-colors dark:border-white/[0.08] dark:bg-white/[0.03] dark:hover:bg-amber-500/10 dark:hover:text-amber-400"
                            >
                              <FaEdit size={13} />
                            </button>
                          </Tooltip>
                          {/* Delete */}
                          <Tooltip text="Delete">
                            <button
                              onClick={() => setDeleteId(item._id)}
                              className="size-8 rounded-xl flex items-center justify-center bg-red-500 text-white hover:bg-red-600 transition-colors"
                            >
                              <MdDelete size={15} />
                            </button>
                          </Tooltip>
                        </div>
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-1">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Page {page} of {totalPages} · {total} records
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

      {/* Delete confirm modal */}
      <Modal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        className="max-w-sm w-full"
      >
        <div className="p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
            Delete Stock Adjustment
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            This will reverse the stock change and permanently remove the
            record. Are you sure?
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button
              className="bg-[#DCE8FF] hover:bg-[#C7DAFF] text-[#1D4ED8]"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default StockAdjustmentList;
