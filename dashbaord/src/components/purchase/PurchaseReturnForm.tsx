import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { FaSearch, FaTimes, FaBoxOpen, FaSpinner } from "react-icons/fa";
import { MdDelete, MdOutlineQrCodeScanner } from "react-icons/md";
import axiosSecure from "../../hooks/useAxiosSecure";
import Label from "../form/Label";
import Button from "../ui/button/Button";
import DatePicker from "../form/date-picker";
import SearchableSelect from "../form/SearchableSelect";
import { showApiError } from "../../utils/apiError";

// Matches the backend's isLikelyCode check (sales.controller.js) — a scanned
// barcode/SKU/QR value is a plain alphanumeric code, not a free-text name search.
const isLikelyCode = (val: string) => /^[0-9A-Za-z\-_.]{4,}$/.test(val.trim());

// ---------- Types ----------
interface Supplier {
  _id: string;
  supplierName: string;
  supplierId: string;
  mobile?: string;
  openingDues: number;
  totalPurchaseDue: number;
}

interface Account {
  _id: string;
  name: string;
}

interface ProductSearchResult {
  _id: string;
  _type: "variant" | "product";
  variantName?: string;
  name?: string;
  barCode?: string;
  sku?: string;
  size?: string;
  color?: string;
  purchasePrice?: number;
  stockVariant?: number;
  stock?: number;
  product?: string;
  image?: Array<{ url: string }>;
}

interface ReturnItem {
  id: string;
  displayName: string;
  product: string | null;
  variant: string | null;
  purchasePrice: number;
  availableStock: number;
  quantity: number;
  subtotal: number;
  image: string;
}

// ---------- Component ----------
const PurchaseReturnForm = () => {
  const queryClient = useQueryClient();

  // ── Supplier state ──────────────────────────────────────────────────────────
  const [supplierQuery, setSupplierQuery] = useState("");
  const [allSuppliers, setAllSuppliers] = useState<Supplier[]>([]);
  const [supplierResults, setSupplierResults] = useState<Supplier[]>([]);
  const [showSupplierDrop, setShowSupplierDrop] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(
    null,
  );
  const supplierRef = useRef<HTMLDivElement>(null);

  // ── Product search state ────────────────────────────────────────────────────
  const [productQuery, setProductQuery] = useState("");
  const [debouncedProductQuery, setDebouncedProductQuery] = useState("");
  const [showProductDrop, setShowProductDrop] = useState(false);
  const productRef = useRef<HTMLDivElement>(null);
  const productDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const productSearchInputRef = useRef<HTMLInputElement>(null);
  const [isScanning, setIsScanning] = useState(false);

  // ── Return items ────────────────────────────────────────────────────────────
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);

  // ── Form fields ─────────────────────────────────────────────────────────────
  // Account the supplier's refund is paid into — the backend credits the full
  // return value here, so it is required.
  const [cashType, setCashType] = useState("");

  const [returnDate, setReturnDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [remarks, setRemarks] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ── Load suppliers ──────────────────────────────────────────────────────────
  const loadSuppliers = () => {
    axiosSecure
      .get("/supplier/getsuppliers")
      .then(({ data }) => setAllSuppliers(data.data || []))
      .catch(() => {});
  };

  useEffect(() => {
    loadSuppliers();
  }, []);

  // ── Filter suppliers as user types ─────────────────────────────────────────
  useEffect(() => {
    if (!supplierQuery.trim()) {
      setSupplierResults([]);
      setShowSupplierDrop(false);
      return;
    }
    const q = supplierQuery.toLowerCase();
    const filtered = allSuppliers.filter(
      (s) =>
        s.supplierName.toLowerCase().includes(q) ||
        (s.supplierId && s.supplierId.includes(q)) ||
        (s.mobile && s.mobile.includes(q)),
    );
    setSupplierResults(filtered);
    setShowSupplierDrop(filtered.length > 0);
  }, [supplierQuery, allSuppliers]);

  // ── Close dropdowns on outside click ───────────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        supplierRef.current &&
        !supplierRef.current.contains(e.target as Node)
      )
        setShowSupplierDrop(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (productRef.current && !productRef.current.contains(e.target as Node))
        setShowProductDrop(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Barcode scanner focus management ────────────────────────────────────
  // A USB barcode scanner behaves like a keyboard: it only "types" into
  // whichever element currently has focus. Keep the product search box
  // focused by default so scanning works without clicking into it first.
  const focusProductSearch = useCallback(() => {
    productSearchInputRef.current?.focus();
  }, []);

  useEffect(() => {
    focusProductSearch();
  }, [focusProductSearch]);

  const handleProductSearchBlur = () => {
    window.setTimeout(() => {
      const active = document.activeElement;
      const isFormField =
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        active instanceof HTMLSelectElement ||
        active instanceof HTMLButtonElement;
      if (!isFormField) {
        focusProductSearch();
      }
    }, 150);
  };

  // ── Supplier actions ────────────────────────────────────────────────────────
  const selectSupplier = (s: Supplier) => {
    setSelectedSupplier(s);
    setSupplierQuery(s.supplierName);
    setShowSupplierDrop(false);
    setErrors((prev) => ({ ...prev, supplier: "" }));
  };

  const clearSupplier = () => {
    setSelectedSupplier(null);
    setSupplierQuery("");
    setSupplierResults([]);
    setShowSupplierDrop(false);
  };

  // ── Product search (debounced) ──────────────────────────────────────────────
  const handleProductQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setProductQuery(val);
    setShowProductDrop(true);
    if (productDebounceRef.current) clearTimeout(productDebounceRef.current);
    productDebounceRef.current = setTimeout(
      () => setDebouncedProductQuery(val),
      400,
    );
  };

  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ["accounts"],
    queryFn: async () => {
      const { data } = await axiosSecure.get("/account/all-account");
      return data?.data?.accounts || [];
    },
  });

  const { data: productResults = [], isFetching: productSearching } = useQuery<
    ProductSearchResult[]
  >({
    queryKey: ["return-product-search", debouncedProductQuery],
    queryFn: async () => {
      if (!debouncedProductQuery.trim()) return [];
      const { data } = await axiosSecure.get(
        `/sales/get-sales-products?q=${encodeURIComponent(debouncedProductQuery.trim())}`,
      );
      return data?.data || [];
    },
    enabled: !!debouncedProductQuery.trim(),
    staleTime: 30 * 1000,
  });

  const addProduct = (item: ProductSearchResult) => {
    const isDup = returnItems.some((r) => r.id === item._id);
    if (isDup) {
      toast.error("Product already added.");
      return;
    }

    const isVariant = item._type === "variant";
    const stock = isVariant ? (item.stockVariant ?? 0) : (item.stock ?? 0);
    const displayName = isVariant
      ? (item.variantName ?? "Unnamed")
      : (item.name ?? "Unnamed");
    const img = item.image?.[0]?.url ?? "";
    const purchasePrice = item.purchasePrice ?? 0;

    const newItem: ReturnItem = {
      id: item._id,
      displayName,
      product: isVariant ? (item.product ?? null) : item._id,
      variant: isVariant ? item._id : null,
      purchasePrice,
      availableStock: stock,
      quantity: 1,
      subtotal: purchasePrice * 1,
      image: img,
    };

    setReturnItems((prev) => [...prev, newItem]);
    setProductQuery("");
    setDebouncedProductQuery("");
    setShowProductDrop(false);
    setErrors((prev) => ({ ...prev, items: "" }));
  };

  // ── Barcode scan submit ──────────────────────────────────────────────────
  // USB scanners emit the code as fast keystrokes terminated by Enter. When
  // that happens, skip the "click a dropdown row" step entirely: hit the
  // same search API and add the matching product immediately.
  const handleProductScanSubmit = async (val: string) => {
    const query = val.trim();
    if (!query) return;

    setIsScanning(true);
    try {
      const { data } = await axiosSecure.get(
        `/sales/get-sales-products?q=${encodeURIComponent(query)}`,
      );
      const results: ProductSearchResult[] = data?.data || [];

      if (results.length === 0) {
        toast.error(`No product found for "${query}"`);
        setShowProductDrop(false);
        return;
      }

      const exactMatch =
        results.find((p) => p.barCode === query || p.sku === query) ||
        results[0];

      addProduct(exactMatch);

      if (results.length > 1 && !exactMatch) {
        toast(`Multiple matches for "${query}" — added the closest match.`, {
          icon: "⚠️",
        });
      }
    } catch (error) {
      showApiError(error, "Barcode lookup failed. Please try again.");
    } finally {
      setIsScanning(false);
      setShowProductDrop(false);
      focusProductSearch();
    }
  };

  const handleProductSearchKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key !== "Enter") return;
    e.preventDefault();

    if (productResults.length > 0 && isLikelyCode(productQuery)) {
      const exactMatch = productResults.find(
        (p) => p.barCode === productQuery || p.sku === productQuery,
      );
      if (exactMatch) {
        addProduct(exactMatch);
        return;
      }
    }

    handleProductScanSubmit(productQuery);
  };

  const updateQuantity = (id: string, rawVal: string) => {
    const qty = Math.max(1, parseInt(rawVal) || 1);
    setReturnItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              quantity: qty,
              subtotal: item.purchasePrice * qty,
            }
          : item,
      ),
    );
  };

  const removeItem = (id: string) => {
    setReturnItems((prev) => prev.filter((item) => item.id !== id));
  };

  // ── Totals ──────────────────────────────────────────────────────────────────
  const totalReturnAmount = returnItems.reduce(
    (sum, item) => sum + item.subtotal,
    0,
  );

  const openingDues = selectedSupplier?.openingDues ?? 0;
  const remainingDue = Math.max(0, openingDues - totalReturnAmount);

  // ── Validation ──────────────────────────────────────────────────────────────
  const validate = () => {
    const errs: Record<string, string> = {};
    if (!selectedSupplier) errs.supplier = "Please select a supplier.";
    if (returnItems.length === 0)
      errs.items = "Add at least one product to return.";
    for (const item of returnItems) {
      if (item.quantity > item.availableStock) {
        errs.items = `"${item.displayName}" — return qty (${item.quantity}) exceeds available stock (${item.availableStock}).`;
        break;
      }
      if (item.quantity < 1) {
        errs.items = `"${item.displayName}" — quantity must be at least 1.`;
        break;
      }
    }
    if (!returnDate) errs.returnDate = "Return date is required.";
    if (!cashType) errs.cashType = "Please select a refund account.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!validate()) return;

    const payload = {
      supplier: selectedSupplier!._id,
      cashType,
      returnDate: new Date(returnDate).toISOString(),
      remarks: remarks.trim() || undefined,
      totalReturnAmount,
      products: returnItems.map((item) => ({
        product: item.product,
        variant: item.variant,
        quantity: item.quantity,
        purchasePrice: item.purchasePrice,
        subtotal: item.subtotal,
      })),
    };

    setIsLoading(true);
    try {
      await axiosSecure.post("/purchase-return", payload);
      toast.success("Purchase return created successfully!");
      queryClient.invalidateQueries({ queryKey: ["purchase-returns-v2"] });
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["supplier"] });
      // The refund credits an account balance, so the cached account list is
      // stale the moment this succeeds.
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      loadSuppliers();
      // Reset
      clearSupplier();
      setReturnItems([]);
      setReturnDate(new Date().toISOString().split("T")[0]);
      setRemarks("");
      setCashType("");
      setErrors({});
    } catch (error: any) {
      showApiError(error, "Failed to create purchase return.");
    } finally {
      setIsLoading(false);
    }
  };

  const fmt = (n: number) =>
    n.toLocaleString("en-BD", { minimumFractionDigits: 0 });

  return (
    <div className="space-y-5">
      {/* ── Section 1: Return Info ───────────────────────────────────────────── */}
      <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="px-5 py-3.5 border-b border-gray-100 dark:border-gray-800 rounded-t-2xl">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
            Return Info
          </p>
        </div>

        <div className="p-5 space-y-4">
          {/* Row 1: Supplier + Date side by side */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Supplier search */}
            <div ref={supplierRef} className="relative">
              <Label>
                Supplier <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 size-3.5 pointer-events-none" />
                <input
                  type="text"
                  value={supplierQuery}
                  onChange={(e) => {
                    setSupplierQuery(e.target.value);
                    if (selectedSupplier) {
                      setSelectedSupplier(null);
                    }
                  }}
                  onFocus={() =>
                    supplierQuery.trim() &&
                    supplierResults.length > 0 &&
                    setShowSupplierDrop(true)
                  }
                  placeholder="Search by name, ID or phone…"
                  autoComplete="off"
                  className={`w-full pl-9 pr-8 py-2.5 text-sm rounded-xl border ${
                    errors.supplier
                      ? "border-red-400 focus:border-red-400 focus:ring-red-400/20"
                      : selectedSupplier
                        ? "border-brand-400 bg-brand-50/30 dark:bg-brand-500/5"
                        : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:bg-white dark:focus:bg-gray-900 focus:border-brand-500 focus:ring-brand-500/20"
                  } text-gray-800 dark:text-white placeholder:text-gray-400 outline-none focus:ring-2 transition-all duration-200`}
                />
                {supplierQuery && (
                  <button
                    type="button"
                    onClick={clearSupplier}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <FaTimes className="size-3" />
                  </button>
                )}
              </div>
              {errors.supplier && (
                <p className="text-red-500 text-xs mt-1">{errors.supplier}</p>
              )}

              {showSupplierDrop && (
                <div className="absolute z-[9999] w-full mt-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden">
                  <div className="max-h-52 overflow-y-auto divide-y divide-gray-50 dark:divide-gray-800">
                    {supplierResults.map((s) => (
                      <button
                        key={s._id}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          selectSupplier(s);
                        }}
                        className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                      >
                        <p className="text-sm font-medium text-gray-800 dark:text-white">
                          {s.supplierName}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {s.supplierId && (
                            <span className="text-xs text-gray-400">
                              {s.supplierId}
                            </span>
                          )}
                          {s.openingDues > 0 && (
                            <span className="text-xs text-red-500 font-medium">
                              Due: ৳{fmt(s.openingDues)}
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Return Date */}
            <div className="relative z-[9999]">
              <DatePicker
                label="Return Date *"
                id="return-date"
                defaultDate={returnDate}
                // @ts-ignore
                onChange={(d) => setReturnDate(d)}
              />
              {errors.returnDate && (
                <p className="text-red-500 text-xs mt-1">{errors.returnDate}</p>
              )}
            </div>

            {/* Refund Account — the full return value is credited here */}
            <div>
              <Label>
                Refund Account <span className="text-red-500">*</span>
              </Label>
              <SearchableSelect
                options={accounts.map((a) => ({ value: a._id, label: a.name }))}
                value={cashType}
                onChange={(val) => {
                  setCashType(val);
                  setErrors((prev) => ({ ...prev, cashType: "" }));
                }}
                placeholder={
                  accounts.length === 0 ? "Loading..." : "Select account"
                }
                searchPlaceholder="Search account..."
                hasError={!!errors.cashType}
              />
              {errors.cashType && (
                <p className="text-red-500 text-xs mt-1">{errors.cashType}</p>
              )}
            </div>
          </div>

          {/* Row 2: Remarks full width */}
          <div>
            <Label>Remarks</Label>
            <textarea
              rows={3}
              placeholder="Optional notes…"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white outline-none focus:bg-white dark:focus:bg-gray-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all placeholder:text-gray-400 resize-y"
            />
          </div>
        </div>

        {/* Supplier due preview — shown after supplier selected */}
        {selectedSupplier && (
          <div className="mx-5 mb-5 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 overflow-hidden">
            <div className="grid grid-cols-3 divide-x divide-gray-100 dark:divide-gray-700 max-md:gap-1">
              <div className="px-2 md:px-4 py-3">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                  Opening Due
                </p>
                <p className="text-sm font-bold text-red-500 tabular-nums">
                  ৳{fmt(openingDues)}
                </p>
              </div>
              <div className="px-2 md:px-4 py-3">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                  Total Return
                </p>
                <p className="text-sm font-bold text-orange-500 tabular-nums">
                  ৳{fmt(totalReturnAmount)}
                </p>
              </div>
              <div className="px-2 md:px-4 py-3">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                  Remaining Due
                </p>
                <p
                  className={`text-sm font-bold tabular-nums ${
                    remainingDue > 0
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-green-600 dark:text-green-400"
                  }`}
                >
                  ৳{fmt(remainingDue)}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Section 2: Product Search + Return Table ─────────────────────────── */}
      <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
            Return Products
          </p>
          {returnItems.length > 0 && (
            <span className="text-xs font-medium text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-500/10 px-2.5 py-0.5 rounded-full">
              {returnItems.length} item{returnItems.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Search bar */}
        <div
          ref={productRef}
          className="relative px-5 py-4 border-b border-gray-50 dark:border-gray-800/60"
        >
          <div className="relative">
            <button
              type="button"
              onClick={focusProductSearch}
              title="Click to resume scanning"
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-brand-500 transition-colors"
            >
              <MdOutlineQrCodeScanner size={14} />
            </button>
            <input
              ref={productSearchInputRef}
              type="text"
              value={productQuery}
              onChange={handleProductQueryChange}
              onFocus={() => productQuery.trim() && setShowProductDrop(true)}
              onBlur={handleProductSearchBlur}
              onKeyDown={handleProductSearchKeyDown}
              disabled={isScanning}
              placeholder="Scan barcode or search by product/variant name…"
              autoComplete="off"
              className="w-full pl-10 pr-10 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white placeholder:text-gray-400 outline-none focus:bg-white dark:focus:bg-gray-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all duration-200"
            />
            {productSearching ? (
              <FaSpinner className="absolute right-3.5 top-1/2 -translate-y-1/2 text-brand-500 size-3.5 animate-spin" />
            ) : productQuery ? (
              <button
                type="button"
                onClick={() => {
                  setProductQuery("");
                  setDebouncedProductQuery("");
                  setShowProductDrop(false);
                }}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 transition-colors"
              >
                <FaTimes className="size-3" />
              </button>
            ) : null}
          </div>

          {/* Product dropdown */}
          {showProductDrop && productQuery.trim() && (
            <div className="absolute z-50 left-5 right-5 mt-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden">
              {productSearching ? (
                <div className="flex items-center gap-3 px-4 py-4 text-sm text-gray-400">
                  <FaSpinner className="animate-spin text-brand-500 size-4 shrink-0" />
                  <span>Searching…</span>
                </div>
              ) : productResults.length > 0 ? (
                <div className="max-h-64 overflow-y-auto divide-y divide-gray-50 dark:divide-gray-800">
                  {productResults.map((item) => {
                    const isVariant = item._type === "variant";
                    const displayName = isVariant
                      ? (item.variantName ?? "Unnamed")
                      : (item.name ?? "Unnamed");
                    const stock = isVariant
                      ? (item.stockVariant ?? 0)
                      : (item.stock ?? 0);
                    const img = item.image?.[0]?.url ?? "";
                    const alreadyAdded = returnItems.some(
                      (r) => r.id === item._id,
                    );

                    return (
                      <button
                        key={item._id}
                        type="button"
                        disabled={alreadyAdded || stock === 0}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          addProduct(item);
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                          alreadyAdded || stock === 0
                            ? "opacity-40 cursor-not-allowed bg-gray-50 dark:bg-gray-800/50"
                            : "hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                        }`}
                      >
                        {img ? (
                          <img
                            src={img}
                            alt={displayName}
                            className="size-9 rounded-lg object-cover shrink-0 border border-gray-100 dark:border-gray-700"
                          />
                        ) : (
                          <div className="size-9 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
                            <FaBoxOpen className="size-3.5 text-gray-300 dark:text-gray-600" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 dark:text-white truncate">
                            {displayName}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {item.barCode && (
                              <span className="text-[11px] text-gray-400 font-mono">
                                #{item.barCode}
                              </span>
                            )}
                            {item.size && item.size !== "N/A" && (
                              <span className="text-[11px] text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                                {item.size}
                              </span>
                            )}
                            {item.color && item.color !== "N/A" && (
                              <span className="text-[11px] text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                                {item.color}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold text-brand-600 dark:text-brand-400 tabular-nums">
                            ৳{item.purchasePrice ?? 0}
                          </p>
                          <p
                            className={`text-[11px] mt-0.5 ${
                              stock === 0 ? "text-red-400" : "text-gray-400"
                            }`}
                          >
                            Stock: {stock}
                            {stock === 0 && " (Out)"}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : debouncedProductQuery.trim() && !productSearching ? (
                <div className="flex flex-col items-center gap-2 px-4 py-8 text-gray-400">
                  <FaBoxOpen className="size-7 opacity-40" />
                  <p className="text-sm">
                    No products found for "{debouncedProductQuery}"
                  </p>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Error */}
        {errors.items && (
          <div className="mx-5 mt-4 px-4 py-3 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-xl text-red-600 dark:text-red-400 text-sm">
            {errors.items}
          </div>
        )}

        {/* Return items table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-200 text-sm">
            <thead>
              <tr className="bg-gray-50/80 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                {[
                  "#",
                  "Product / Variant",
                  "Purchase Price",
                  "Available Stock",
                  "Return Qty",
                  "Subtotal",
                  "",
                ].map((h, i) => (
                  <th
                    key={i}
                    className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60">
              {returnItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-14 text-center">
                    <div className="flex flex-col items-center gap-2.5 text-gray-300 dark:text-gray-600">
                      <FaBoxOpen className="size-10" />
                      <p className="text-sm text-gray-400 dark:text-gray-500">
                        Search and add products to return above
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                returnItems.map((item, idx) => {
                  const isOverStock = item.quantity > item.availableStock;

                  return (
                    <tr
                      key={item.id}
                      className="group hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition-colors"
                    >
                      {/* # */}
                      <td className="px-3 py-3 w-8">
                        <span className="text-[11px] text-gray-400 font-medium tabular-nums">
                          {idx + 1}
                        </span>
                      </td>

                      {/* Product name + image */}
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          {item.image ? (
                            <img
                              src={item.image}
                              alt={item.displayName}
                              className="size-8 rounded-lg object-cover shrink-0 border border-gray-100 dark:border-gray-700"
                            />
                          ) : (
                            <div className="size-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
                              <FaBoxOpen className="size-3 text-gray-300 dark:text-gray-600" />
                            </div>
                          )}
                          <span className="text-xs font-medium text-gray-800 dark:text-white">
                            {item.displayName}
                          </span>
                        </div>
                      </td>

                      {/* Purchase price */}
                      <td className="px-3 py-3">
                        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 tabular-nums">
                          ৳{fmt(item.purchasePrice)}
                        </span>
                      </td>

                      {/* Available stock */}
                      <td className="px-3 py-3">
                        <span
                          className={`text-xs font-semibold tabular-nums ${
                            item.availableStock === 0
                              ? "text-red-500"
                              : "text-gray-700 dark:text-gray-300"
                          }`}
                        >
                          {item.availableStock}
                        </span>
                      </td>

                      {/* Return quantity input */}
                      <td className="px-3 py-3">
                        <input
                          type="number"
                          min={1}
                          max={item.availableStock}
                          value={item.quantity}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) =>
                            updateQuantity(item.id, e.target.value)
                          }
                          className={`w-20 text-center text-xs font-semibold h-8 rounded-lg border px-2 outline-none focus:ring-2 transition-all tabular-nums ${
                            isOverStock
                              ? "border-red-400 focus:ring-red-400/20 bg-red-50 dark:bg-red-500/10 text-red-600"
                              : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-white focus:ring-brand-500/20 focus:border-brand-500"
                          }`}
                        />
                        {isOverStock && (
                          <p className="text-[10px] text-red-500 mt-0.5 whitespace-nowrap">
                            Max {item.availableStock}
                          </p>
                        )}
                      </td>

                      {/* Subtotal */}
                      <td className="px-3 py-3">
                        <span className="text-xs font-bold text-gray-800 dark:text-white tabular-nums">
                          ৳{fmt(item.subtotal)}
                        </span>
                      </td>

                      {/* Remove */}
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="size-7 flex items-center justify-center rounded-lg bg-red-500 hover:bg-red-600 text-white transition-all"
                        >
                          <MdDelete className="size-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Section 3: Return Summary ─────────────────────────────────────────── */}
      {returnItems.length > 0 && (
        <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 dark:border-gray-800">
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
              Return Summary
            </p>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {/* Per-item breakdown */}
              {returnItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl bg-gray-50 dark:bg-gray-800/50 px-4 py-3 space-y-1"
                >
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider truncate">
                    {item.displayName}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                    ৳{fmt(item.purchasePrice)} × {item.quantity}
                  </p>
                  <p className="text-base font-bold text-gray-800 dark:text-white tabular-nums">
                    ৳{fmt(item.subtotal)}
                  </p>
                </div>
              ))}

              {/* Total return amount */}
              <div className="rounded-xl bg-orange-50 dark:bg-orange-500/10 px-4 py-3 space-y-1 border border-orange-100 dark:border-orange-500/20">
                <p className="text-[10px] font-semibold text-orange-500 uppercase tracking-wider">
                  Total Return Amount
                </p>
                <p className="text-xl font-bold text-orange-600 dark:text-orange-400 tabular-nums">
                  ৳{fmt(totalReturnAmount)}
                </p>
              </div>
            </div>

            {/* Supplier due change — only when supplier selected */}
            {selectedSupplier && (
              <div className="mt-4 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="px-4 py-2.5 bg-gray-50 dark:bg-gray-800/40 border-b border-gray-100 dark:border-gray-700">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                    Supplier Due Impact — {selectedSupplier.supplierName}
                  </p>
                </div>
                <div className="grid grid-cols-3 divide-x divide-gray-100 dark:divide-gray-700 max-md:gap-1">
                  <div className="px-2 md:px-4 py-3">
                    <p className="text-[10px] text-gray-400 mb-1">
                      Current Due
                    </p>
                    <p className="text-sm font-bold text-red-500 tabular-nums">
                      ৳{fmt(openingDues)}
                    </p>
                  </div>
                  <div className="px-2 md:px-4 py-3">
                    <p className="text-[10px] text-gray-400 mb-1">Deducting</p>
                    <p className="text-sm font-bold text-orange-500 tabular-nums">
                      − ৳{fmt(totalReturnAmount)}
                    </p>
                  </div>
                  <div className="px-2 md:px-4 py-3">
                    <p className="text-[10px] text-gray-400 mb-1">
                      After Return
                    </p>
                    <p
                      className={`text-sm font-bold tabular-nums ${
                        remainingDue > 0
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-green-600 dark:text-green-400"
                      }`}
                    >
                      ৳{fmt(remainingDue)}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Submit ────────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-end gap-3 pt-1">
        <Button
          onClick={handleSubmit}
          disabled={isLoading}
            className="bg-[#DCE8FF] hover:bg-[#C7DAFF] text-[#1D4ED8] px-8 py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-60 min-w-52"
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <FaSpinner className="animate-spin size-3.5" />
              Submitting…
            </span>
          ) : (
            "Submit Purchase Return"
          )}
        </Button>
      </div>
    </div>
  );
};

export default PurchaseReturnForm;
