import { useState, FormEvent, useEffect, useRef, useMemo } from "react";
import Button from "../ui/button/Button";
import MobileActionBar from "../common/MobileActionBar";
import DatePicker from "../form/date-picker";
import Label from "../form/Label";
import Input from "../form/input/InputField";
import TextArea from "../form/input/TextArea";
import { FaChevronDown, FaSearch, FaSpinner, FaTimes } from "react-icons/fa";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import axiosSecure from "../../hooks/useAxiosSecure";
import toast from "react-hot-toast";
import { useFormDraft, draftValue, clearDraft } from "../../hooks/useFormDraft";

// Unsaved input survives a reload or a trip to another page in this tab
// (sessionStorage, per store); cleared once the form is submitted.
const DRAFT_KEY = "stock-adjustment";

// ---------- Types ----------

interface SearchResult {
  _id: string;
  _type: "product" | "variant";
  _score: number;
  // product fields
  name?: string;
  stock?: number;
  // variant fields
  variantName?: string;
  productName?: string; // parent product's name
  product?: string; // ObjectId of parent product
  stockVariant?: number;
  // shared
  sku?: string;
  barCode?: string;
  size?: string;
  color?: string;
  purchasePrice?: number;
  retailPrice?: number;
}

interface StockAdjustFormData {
  productId: string;
  variantId: string;
  increaseQuantity: number | null;
  decreaseQuantity: number | null;
  date: string | null;
  adjustReason: string;
}

// ---------- Search dropdown component ----------

interface SearchDropdownProps {
  onSelect: (item: SearchResult) => void;
  selectedLabel: string;
  onClear: () => void;
  hasError: boolean;
}

// Pages of matches the picker loads as the list scrolls, and the row height
// the virtualizer lays them out with
const PICKER_PAGE_SIZE = 30;
const PICKER_ROW_HEIGHT = 56;

interface PickerPage {
  items: SearchResult[];
  page: number;
  hasMore: boolean;
}

const SearchDropdown = ({ onSelect, selectedLabel, onClear, hasError }: SearchDropdownProps) => {
  const [query, setQuery] = useState("");
  const [debQuery, setDebQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [active, setActive] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  // Enter pressed (a scanner ends every code with it) before the results came
  const pickOnArrivalRef = useRef(false);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Search once typing pauses
  useEffect(() => {
    const t = setTimeout(() => setDebQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  // Empty lists every product and variant by name; the server returns one
  // page at a time, so the browser never holds more than what was scrolled to
  const term = debQuery;
  const {
    data,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    isPlaceholderData,
  } = useInfiniteQuery({
    queryKey: ["stock-adjust-picker", term],
    enabled: isOpen,
    initialPageParam: 1,
    queryFn: async ({ pageParam, signal }): Promise<PickerPage> => {
      // signal: a newer search cancels this one
      const res = await axiosSecure.get("/sales/get-sales-products", {
        params: { q: term, page: pageParam, limit: PICKER_PAGE_SIZE },
        signal,
      });
      return res.data.data as PickerPage;
    },
    getNextPageParam: (last) => (last?.hasMore ? last.page + 1 : undefined),
    // Typing a term again (or backspacing to it) answers from memory
    staleTime: 30 * 1000,
    // The current matches stay (dimmed) while the next search loads
    placeholderData: keepPreviousData,
  });
  const items: SearchResult[] = data?.pages.flatMap((p) => p?.items ?? []) ?? [];
  const pending = query.trim() !== debQuery;
  const loading = pending || (isFetching && !isFetchingNextPage);
  const stale = loading && items.length > 0 && (pending || isPlaceholderData);

  // Only the rows in view are on the page, however many have been loaded
  const virtualizer = useVirtualizer({
    count: items.length + (hasNextPage ? 1 : 0),
    getScrollElement: () => listRef.current,
    estimateSize: () => PICKER_ROW_HEIGHT,
    overscan: 6,
  });
  const virtualRows = virtualizer.getVirtualItems();

  // Near the bottom: load the next page
  const lastVisible = virtualRows[virtualRows.length - 1]?.index ?? -1;
  useEffect(() => {
    if (lastVisible >= items.length - 5 && hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [lastVisible, items.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // A new search starts at the top
  useEffect(() => {
    setActive(0);
    if (listRef.current) listRef.current.scrollTop = 0;
  }, [term]);

  const handleSelect = (item: SearchResult) => {
    onSelect(item);
    pickOnArrivalRef.current = false;
    setQuery("");
    setDebQuery("");
    setIsOpen(false);
  };

  // A scanned code (Enter before the results came) picks its exact match
  useEffect(() => {
    if (!pickOnArrivalRef.current || loading) return;
    pickOnArrivalRef.current = false;
    if (items[0]?._score === 100) handleSelect(items[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, items]);

  const handleClear = () => {
    onClear();
    setQuery("");
    setDebQuery("");
    setIsOpen(false);
  };

  const moveActive = (next: number) => {
    if (!items.length) return;
    const clamped = Math.max(0, Math.min(items.length - 1, next));
    setActive(clamped);
    virtualizer.scrollToIndex(clamped, { align: "auto" });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIsOpen(true);
      moveActive(active + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      moveActive(active - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (loading || !items.length) {
        // Search now instead of waiting for the pause, then pick the exact match
        setDebQuery(query.trim());
        pickOnArrivalRef.current = true;
        setIsOpen(true);
      } else if (items[active]) {
        handleSelect(items[active]);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  // If something is already selected — show selected pill
  if (selectedLabel) {
    return (
      <div
        className={`flex items-center justify-between h-11 px-4 rounded-xl border bg-white dark:bg-gray-900 text-sm ${
          hasError ? "border-red-500" : "border-gray-300 dark:border-gray-700"
        }`}
      >
        <span className="text-gray-800 dark:text-white font-medium truncate">{selectedLabel}</span>
        <button type="button" onClick={handleClear} className="ml-2 text-gray-400 hover:text-red-500 transition-colors shrink-0">
          <FaTimes className="size-3" />
        </button>
      </div>
    );
  }

  const showDropdown = isOpen;

  return (
    <div ref={containerRef} className="relative">
      {/* Search input */}
      <div className={`flex items-center h-11 px-3 gap-2 rounded-xl border bg-white dark:bg-gray-900 transition-all ${
        showDropdown
          ? "border-accent-500 ring-2 ring-accent-500/20"
          : hasError
          ? "border-red-500"
          : "border-gray-300 dark:border-gray-700 hover:border-accent-400"
      }`}>
        {loading
          ? <FaSpinner className="size-3 text-accent-500 animate-spin shrink-0" />
          : <FaSearch className="size-3 text-gray-400 shrink-0" />
        }
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onClick={() => setIsOpen(true)}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls="stock-adjust-picker-list"
          aria-autocomplete="list"
          autoComplete="off"
          placeholder="Select, or type a product name or barcode…"
          className="flex-1 bg-transparent text-sm text-gray-700 dark:text-white placeholder:text-gray-400 outline-none"
        />
        {query && (
          <button type="button" onClick={() => { setQuery(""); setDebQuery(""); }} aria-label="Clear search" className="text-gray-400 hover:text-red-500">
            <FaTimes className="size-3" />
          </button>
        )}
        {/* Opens and closes the list */}
        <button
          type="button"
          tabIndex={-1}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setIsOpen((open) => !open)}
          aria-label={showDropdown ? "Close list" : "Open list"}
          className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-accent-600 dark:hover:bg-white/5"
        >
          <FaChevronDown className={`size-3 transition-transform duration-200 ${showDropdown ? "rotate-180 text-accent-500" : ""}`} />
        </button>
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute z-50 w-full mt-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden">
          {items.length === 0 ? (
            <div className="flex items-center justify-center gap-2 px-4 py-6 text-sm text-gray-400 dark:text-gray-500">
              {loading ? (
                <>
                  <FaSpinner className="size-3.5 animate-spin text-accent-500" />
                  Searching…
                </>
              ) : (
                <>{query.trim() ? <>No results for “{query.trim()}”</> : "No products or variants yet"}</>
              )}
            </div>
          ) : (
            <div
              ref={listRef}
              id="stock-adjust-picker-list"
              role="listbox"
              className={`no-scrollbar max-h-72 overflow-y-auto transition-opacity duration-150 ${stale ? "opacity-60" : "opacity-100"}`}
            >
              <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
                {virtualRows.map((row) => {
                  const item = items[row.index];
                  const style = {
                    position: "absolute" as const,
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: row.size,
                    transform: `translateY(${row.start}px)`,
                  };
                  // The extra row after the last item: the next page loading
                  if (!item) {
                    return (
                      <div key="loader" style={style} className="flex items-center justify-center gap-2 text-xs text-gray-400">
                        <FaSpinner className="size-3 animate-spin text-accent-500" />
                        Loading more…
                      </div>
                    );
                  }
                  const isVariant = item._type === "variant";
                  const label = isVariant
                    ? item.productName
                      ? `${item.productName} — ${item.variantName ?? ""}`
                      : item.variantName
                    : item.name;
                  const stock = isVariant ? (item.stockVariant ?? 0) : (item.stock ?? 0);
                  const meta = [item.size, item.color].filter(Boolean).join(" · ");
                  const code = item.barCode || item.sku || "";
                  const isActive = row.index === active;

                  return (
                    <button
                      key={item._id}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      style={style}
                      onMouseEnter={() => setActive(row.index)}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleSelect(item)}
                      className={`w-full text-left px-4 transition-colors border-b border-gray-100 dark:border-gray-800 ${
                        isActive ? "bg-accent-50 dark:bg-accent-500/10" : "hover:bg-gray-50 dark:hover:bg-gray-800"
                      }`}
                    >
                      <div className="flex h-full items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {/* type badge */}
                          <span className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            isVariant
                              ? "bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400"
                              : "bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400"
                          }`}>
                            {isVariant ? "VARIANT" : "SINGLE"}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-800 dark:text-white truncate">{label}</p>
                            {(meta || code) && (
                              <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate">
                                {[meta, code].filter(Boolean).join(" · ")}
                              </p>
                            )}
                          </div>
                        </div>
                        {/* stock badge */}
                        <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${
                          stock > 0
                            ? "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400"
                            : "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400"
                        }`}>
                          {stock}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {items.length > 0 && (
            <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
              <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">
                {items.length}{hasNextPage ? "+" : ""} result{items.length !== 1 ? "s" : ""}
              </p>
              {hasNextPage && (
                <p className="text-[10px] text-gray-400">Scroll for more</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ---------- Main form ----------

const CreateStockAdjustForm = () => {
  const [selectedItem, setSelectedItem] = useState<SearchResult | null>(() => draftValue<SearchResult | null>(DRAFT_KEY, "selectedItem", null));
  const [selectedLabel, setSelectedLabel] = useState(() => draftValue(DRAFT_KEY, "selectedLabel", ""));
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<StockAdjustFormData>(() => draftValue<StockAdjustFormData>(DRAFT_KEY, "formData", {
    productId: "",
    variantId: "",
    increaseQuantity: null,
    decreaseQuantity: null,
    date: null,
    adjustReason: "",
  }));
  useFormDraft(
    DRAFT_KEY,
    useMemo(() => ({ selectedItem, selectedLabel, formData }), [selectedItem, selectedLabel, formData]),
  );
  const [errors, setErrors] = useState<Partial<Record<keyof StockAdjustFormData, string>>>({});

  const handleItemSelect = (item: SearchResult) => {
    setSelectedItem(item);
    const label = item._type === "variant"
      ? `${item.variantName}${item.barCode ? ` · ${item.barCode}` : item.sku ? ` · ${item.sku}` : ""}${item.size ? ` · ${item.size}` : ""}${item.color ? ` / ${item.color}` : ""}`
      : (item.name ?? "");

    setSelectedLabel(label);
    setFormData((prev) => ({
      ...prev,
      productId: item._type === "product" ? item._id : "",
      variantId: item._type === "variant" ? item._id : "",
    }));
    setErrors((prev) => ({ ...prev, productId: "" }));
  };

  const handleClear = () => {
    setSelectedItem(null);
    setSelectedLabel("");
    setFormData((prev) => ({ ...prev, productId: "", variantId: "" }));
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { id, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [id]: type === "number" ? (value === "" ? null : Number(value)) : value,
    }));
    setErrors((prev) => ({ ...prev, [id]: "" }));
  };

  const handleDateChange = (dates: Date[]) => {
    const dateStr = dates?.length > 0 ? dates[0].toISOString().split("T")[0] : null;
    setFormData((prev) => ({ ...prev, date: dateStr }));
    setErrors((prev) => ({ ...prev, date: "" }));
  };

  const validate = () => {
    const errs: Partial<Record<keyof StockAdjustFormData, string>> = {};
    if (!formData.productId && !formData.variantId) errs.productId = "Select a product or variant.";
    if (!formData.date) errs.date = "Date is required.";
    if (!formData.adjustReason.trim()) errs.adjustReason = "Reason is required.";
    return errs;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) { setErrors(validationErrors); return; }

    try {
      setIsLoading(true);
      const payload: Record<string, unknown> = {
        increaseQuantity: formData.increaseQuantity,
        decreaseQuantity: formData.decreaseQuantity,
        date: formData.date,
        adjustReason: formData.adjustReason,
      };
      if (formData.variantId) payload.variantId = formData.variantId;
      else payload.productId = formData.productId;

      await axiosSecure.post("/stock/stock-adjust", payload);
      toast.success("Stock adjustment created successfully!");
      clearDraft(DRAFT_KEY);

      // reset
      setSelectedItem(null);
      setSelectedLabel("");
      setFormData({ productId: "", variantId: "", increaseQuantity: null, decreaseQuantity: null, date: null, adjustReason: "" });
      setErrors({});
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to create stock adjustment");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

        {/* Product / Variant search */}
        <div className="flex flex-col sm:col-span-1">
          <Label htmlFor="productSearch">Product / Variant <span className="text-red-500">*</span></Label>
          <SearchDropdown
            onSelect={handleItemSelect}
            selectedLabel={selectedLabel}
            onClear={handleClear}
            hasError={!!errors.productId}
          />
          {errors.productId && (
            <span className="text-red-500 text-xs mt-1">{errors.productId}</span>
          )}
          {/* selected item info chip */}
          {selectedItem && (
            <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
              <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                selectedItem._type === "variant"
                  ? "bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400"
                  : "bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400"
              }`}>
                {selectedItem._type === "variant" ? "VARIANT" : "SINGLE"}
              </span>
              <span>
                Stock:{" "}
                <strong className={
                  (selectedItem._type === "variant" ? selectedItem.stockVariant ?? 0 : selectedItem.stock ?? 0) > 0
                    ? "text-green-600"
                    : "text-red-500"
                }>
                  {selectedItem._type === "variant" ? selectedItem.stockVariant ?? 0 : selectedItem.stock ?? 0}
                </strong>
              </span>
            </div>
          )}
        </div>

        {/* Increase Qty */}
        <div className="flex flex-col">
          <Label htmlFor="increaseQuantity">Increase Quantity</Label>
          <Input
            type="number"
            id="increaseQuantity"
            placeholder="Enter Increase Qty"
            value={formData.increaseQuantity ?? ""}
            onChange={handleChange}
            min="1"
            disabled={!!formData.decreaseQuantity}
          />
        </div>

        {/* Decrease Qty */}
        <div className="flex flex-col">
          <Label htmlFor="decreaseQuantity">Decrease Quantity</Label>
          <Input
            type="number"
            id="decreaseQuantity"
            placeholder="Enter Decrease Qty"
            value={formData.decreaseQuantity ?? ""}
            onChange={handleChange}
            min="1"
            disabled={!!formData.increaseQuantity}
          />
        </div>

        {/* Date */}
        <div className="flex flex-col">
          <DatePicker
            id="date"
            label={<>Adjustment Date <span className="text-red-500">*</span></>}
            placeholder="Select a date"
            onChange={handleDateChange}
          />
          {errors.date && (
            <span className="text-red-500 text-xs mt-1">{errors.date}</span>
          )}
        </div>

        {/* Reason */}
        <div className="flex flex-col sm:col-span-3">
          <Label htmlFor="adjustReason">Adjustment Reason <span className="text-red-500">*</span></Label>
          <TextArea
            placeholder="Enter Adjustment Reason"
            value={formData.adjustReason}
            onChange={(value: string) =>
              setFormData((prev) => ({ ...prev, adjustReason: value }))
            }
          />
          {errors.adjustReason && (
            <span className="text-red-500 text-xs mt-1">{errors.adjustReason}</span>
          )}
        </div>
      </div>

      <MobileActionBar>
        <div className="flex items-center justify-end gap-3 pt-1">
          <Button
            //@ts-ignore
            type="submit"
            className="!bg-accent-500 hover:!bg-accent-600 !text-white font-semibold px-6 py-2.5 !rounded-xl text-sm disabled:opacity-60 min-w-36"
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Creating…
              </span>
            ) : (
              "Create Adjustment"
            )}
          </Button>
        </div>
      </MobileActionBar>
    </form>
  );
};

export default CreateStockAdjustForm;
