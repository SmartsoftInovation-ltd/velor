import { useState, FormEvent, useEffect, useRef } from "react";
import Button from "../ui/button/Button";
import MobileActionBar from "../common/MobileActionBar";
import DatePicker from "../form/date-picker";
import Label from "../form/Label";
import Input from "../form/input/InputField";
import TextArea from "../form/input/TextArea";
import { FaSearch, FaSpinner, FaTimes } from "react-icons/fa";
import axiosSecure from "../../hooks/useAxiosSecure";
import toast from "react-hot-toast";

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

const SearchDropdown = ({ onSelect, selectedLabel, onClear, hasError }: SearchDropdownProps) => {
  const [query, setQuery]       = useState("");
  const [results, setResults]   = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen]     = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

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

  // Debounced search — 350 ms, min 2 chars
  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (query.length < 2) { setResults([]); setIsSearching(false); return; }

    setIsSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await axiosSecure.get(
          `/sales/get-sales-products?q=${encodeURIComponent(query)}&limit=20`
        );
        // response: apiResponse.sendSuccess wraps as { data: { data: results[] } }
        setResults(res.data.data ?? []);
        setIsOpen(true);
      } catch {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const handleSelect = (item: SearchResult) => {
    onSelect(item);
    setQuery("");
    setResults([]);
    setIsOpen(false);
  };

  const handleClear = () => {
    onClear();
    setQuery("");
    setResults([]);
    setIsOpen(false);
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

  return (
    <div ref={containerRef} className="relative">
      {/* Search input */}
      <div className={`flex items-center h-11 px-3 gap-2 rounded-xl border bg-white dark:bg-gray-900 transition-all ${
        isOpen
          ? "border-brand-500 ring-2 ring-brand-500/20"
          : hasError
          ? "border-red-500"
          : "border-gray-300 dark:border-gray-700 hover:border-brand-400"
      }`}>
        {isSearching
          ? <FaSpinner className="size-3 text-brand-500 animate-spin shrink-0" />
          : <FaSearch className="size-3 text-gray-400 shrink-0" />
        }
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          placeholder="Type product name or barcode…"
          className="flex-1 bg-transparent text-sm text-gray-700 dark:text-white placeholder:text-gray-400 outline-none"
        />
        {query && (
          <button type="button" onClick={() => { setQuery(""); setResults([]); }} className="text-gray-400 hover:text-red-500">
            <FaTimes className="size-3" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden">
          <div className="max-h-64 overflow-y-auto">
            {results.map((item) => {
              const isVariant = item._type === "variant";
              const label     = isVariant ? item.variantName : item.name;
              const stock     = isVariant ? (item.stockVariant ?? 0) : (item.stock ?? 0);
              const meta      = [item.size, item.color].filter(Boolean).join(" · ");
              const code      = item.barCode || item.sku || "";

              return (
                <button
                  key={item._id}
                  type="button"
                  onClick={() => handleSelect(item)}
                  className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors border-b border-gray-100 dark:border-gray-800 last:border-0"
                >
                  <div className="flex items-center justify-between gap-2">
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
          <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">
              {results.length} result{results.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      )}

      {/* No results */}
      {isOpen && query.length >= 2 && !isSearching && results.length === 0 && (
        <div className="absolute z-50 w-full mt-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg px-4 py-6 text-center">
          <p className="text-sm text-gray-400 dark:text-gray-500">No results for "{query}"</p>
        </div>
      )}
    </div>
  );
};

// ---------- Main form ----------

const CreateStockAdjustForm = () => {
  const [selectedItem, setSelectedItem] = useState<SearchResult | null>(null);
  const [selectedLabel, setSelectedLabel] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<StockAdjustFormData>({
    productId: "",
    variantId: "",
    increaseQuantity: null,
    decreaseQuantity: null,
    date: null,
    adjustReason: "",
  });
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
          <Label htmlFor="productSearch">Product / Variant:</Label>
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
          <Label htmlFor="increaseQuantity">Increase Quantity:</Label>
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
          <Label htmlFor="decreaseQuantity">Decrease Quantity:</Label>
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
            label="Adjustment Date"
            placeholder="Select a date"
            onChange={handleDateChange}
          />
          {errors.date && (
            <span className="text-red-500 text-xs mt-1">{errors.date}</span>
          )}
        </div>

        {/* Reason */}
        <div className="flex flex-col sm:col-span-3">
          <Label htmlFor="adjustReason">Adjustment Reason:</Label>
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
        <Button
          //@ts-ignore
          type="submit"
            className="bg-[#D5F0E3] hover:bg-[#B8E4CF] text-[#0A6B43] px-4 py-2 rounded disabled:opacity-50"
          disabled={isLoading}
        >
          {isLoading ? "Creating..." : "Stock Adjustment"}
        </Button>
      </MobileActionBar>
    </form>
  );
};

export default CreateStockAdjustForm;
