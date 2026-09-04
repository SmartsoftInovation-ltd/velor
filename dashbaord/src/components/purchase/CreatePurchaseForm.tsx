import { useState, useRef, useEffect, useCallback, ChangeEvent, KeyboardEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import DatePicker from "../form/date-picker";
import Input from "../form/input/InputField";
import Button from "../ui/button/Button";
import axiosSecure from "../../hooks/useAxiosSecure";
import { MdDelete, MdOutlineQrCodeScanner } from "react-icons/md";
import { FaSpinner, FaBoxOpen } from "react-icons/fa";
import toast from "react-hot-toast";
import Label from "../form/Label";
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
  mobile: string;
}

interface Account {
  _id: string;
  name: string;
  slug: string;
}

interface TableProduct {
  id: string | number;
  barcode: string;
  name: string;
  variantName: string;
  sku?: string;
  size: string[];
  color: string[];
  purchasePrice: number | string;
  wholesalePrice: number | string;
  retailPrice: number | string;
  stock?: number;
  quantity: number;
  image?: string;
  variantType: "singleVariant" | "multipleVariant";
  productId?: string;
  variantId?: string;
}

interface SearchResult {
  _id: string;
  name?: string;
  productName?: string;
  variantName?: string;
  barCode?: string;
  sku?: string;
  size?: string;
  color?: string;
  purchasePrice?: number;
  retailPrice?: number;
  wholesalePrice?: number;
  stock?: number;
  stockVariant?: number;
  image?: Array<{ url: string; publicId: string }>;
  product?: string;
  _type: "product" | "variant";
}

interface PurchaseFormData {
  invoiceNumber: string;
  supplierId: string;
  date: string;
  cashType: string;
  commission: number;
  shipping: number;
  payable: number;
  dueamount: number;
  paid: number;
}

// ---------- Component ----------
const CreatePurchaseForm = () => {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [debouncedQuery, setDebouncedQuery] = useState<string>("");
  const [tableProducts, setTableProducts] = useState<TableProduct[]>([]);
  const [showDropdown, setShowDropdown] = useState<boolean>(false);
  const [submitLoading, setSubmitLoading] = useState<boolean>(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [isScanning, setIsScanning] = useState(false);

  const getTodayDate = () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const [formData, setFormData] = useState<PurchaseFormData>({
    invoiceNumber: "",
    supplierId: "",
    date: getTodayDate(),
    cashType: "",
    commission: 0,
    shipping: 0,
    payable: 0,
    dueamount: 0,
    paid: 0,
  });

  // ---------- Data Fetching ----------
  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data } = await axiosSecure.get("/supplier/getsuppliers");
      return data?.data || [];
    },
    staleTime: 0,
    refetchOnMount: true,
  });

  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ["accounts"],
    queryFn: async () => {
      const { data } = await axiosSecure.get("/account/all-account");
      return data?.data?.accounts || [];
    },
    staleTime: 0,
    refetchOnMount: true,
  });

  const { data: searchResults = [], isFetching: searchLoading } = useQuery<
    SearchResult[]
  >({
    queryKey: ["product-search", debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery.trim()) return [];
      const { data } = await axiosSecure.get(
        `/sales/get-sales-products?q=${encodeURIComponent(debouncedQuery.trim())}`,
      );
      return data?.data || [];
    },
    enabled: !!debouncedQuery.trim(),
    staleTime: 30 * 1000,
  });

  // ---------- Debounce search ----------
  const handleSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    setShowDropdown(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(value);
    }, 400);
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  // ---------- Totals ----------
  const subTotal = tableProducts.reduce((total, product) => {
    const price =
      typeof product.purchasePrice === "string"
        ? parseFloat(product.purchasePrice) || 0
        : product.purchasePrice || 0;
    return total + price * product.quantity;
  }, 0);

  const calculatedPayable = subTotal + formData.commission + formData.shipping;
  const calculatedDueAmount = calculatedPayable - formData.paid;

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      payable: calculatedPayable,
      dueamount: calculatedDueAmount,
    }));
  }, [subTotal, formData.commission, formData.shipping, formData.paid]);

  const handleFormChange = (
    field: keyof PurchaseFormData,
    value: string | number,
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  // Blur on wheel so scrolling the page doesn't silently increment/decrement
  // a focused number input's value.
  const blurOnWheel = (e: React.WheelEvent<HTMLInputElement>) => {
    e.currentTarget.blur();
  };

  const validateRequiredFields = () => {
    const newErrors: { [key: string]: string } = {};
    if (!formData.invoiceNumber.trim())
      newErrors.invoiceNumber = "Invoice number is required";
    if (!formData.supplierId) newErrors.supplierId = "Supplier is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ---------- Product selection ----------
  const selectProduct = (item: SearchResult) => {
    const isVariant = item._type === "variant";
    const imageUrl =
      Array.isArray(item.image) && item.image.length > 0
        ? item.image[0].url
        : "";
    const sizeArr =
      typeof item.size === "string" && item.size && item.size !== "N/A"
        ? [item.size]
        : [];
    const colorArr =
      typeof item.color === "string" && item.color && item.color !== "N/A"
        ? [item.color]
        : [];

    const displayName = isVariant
      ? item.productName
        ? `${item.productName} — ${item.variantName || ""}`
        : item.variantName || ""
      : item.name || "";

    const newProduct: TableProduct = {
      id: item._id,
      barcode: item.barCode || "",
      name: displayName,
      variantName: isVariant ? item.variantName || "" : "",
      sku: item.sku || "",
      size: sizeArr,
      color: colorArr,
      purchasePrice: item.purchasePrice || "",
      wholesalePrice: item.wholesalePrice || "",
      retailPrice: item.retailPrice || "",
      stock: isVariant ? item.stockVariant || 0 : item.stock || 0,
      quantity: 1,
      image: imageUrl,
      variantType: isVariant ? "multipleVariant" : "singleVariant",
      productId: isVariant ? undefined : item._id,
      variantId: isVariant ? item._id : undefined,
    };

    if (tableProducts.find((p) => p.id === newProduct.id)) {
      toast.error("Product already added!");
      return;
    }

    setTableProducts([...tableProducts, newProduct]);
    setSearchQuery("");
    setDebouncedQuery("");
    setShowDropdown(false);
  };

  // ── Barcode scan submit ──────────────────────────────────────────────────
  // USB scanners emit the code as fast keystrokes terminated by Enter. When
  // that happens, skip the "click a dropdown row" step entirely: hit the
  // same search API and add the matching product immediately.
  const handleScanSubmit = async (val: string) => {
    const query = val.trim();
    if (!query) return;

    setIsScanning(true);
    try {
      const { data } = await axiosSecure.get(
        `/sales/get-sales-products?q=${encodeURIComponent(query)}`,
      );
      const results: SearchResult[] = data?.data || [];

      if (results.length === 0) {
        toast.error(`No product found for "${query}"`);
        setShowDropdown(false);
        return;
      }

      const exactMatch =
        results.find(
          (p) => p.barCode === query || p.sku === query,
        ) || results[0];

      selectProduct(exactMatch);

      if (results.length > 1 && !exactMatch) {
        toast(`Multiple matches for "${query}" — added the closest match.`, {
          icon: "⚠️",
        });
      }
    } catch (error) {
      showApiError(error, "Barcode lookup failed. Please try again.");
    } finally {
      setIsScanning(false);
      setShowDropdown(false);
      focusSearchInput();
    }
  };

  const handleSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();

    if (searchResults.length > 0 && isLikelyCode(searchQuery)) {
      const exactMatch = searchResults.find(
        (p) => p.barCode === searchQuery || p.sku === searchQuery,
      );
      if (exactMatch) {
        selectProduct(exactMatch);
        return;
      }
    }

    handleScanSubmit(searchQuery);
  };

  const handleProductChange = (
    index: number,
    field: keyof TableProduct,
    value: string | number,
  ) => {
    const updated = [...tableProducts];
    if (field === "size" || field === "color") {
      updated[index][field] =
        typeof value === "string"
          ? value
              .split(",")
              .map((v) => v.trim())
              .filter(Boolean)
          : [];
    } else {
      (updated[index] as any)[field] = value;
    }
    setTableProducts(updated);
  };

  const removeRow = (index: number) => {
    setTableProducts(tableProducts.filter((_, i) => i !== index));
  };

  // ---------- Submit ----------
  const handleSubmit = async () => {
    if (!validateRequiredFields()) return;

    if (tableProducts.length === 0) {
      toast.error("Please add at least one product!");
      return;
    }

    for (const product of tableProducts) {
      if (!product.purchasePrice || product.purchasePrice === "") {
        toast.error("All products must have a purchase price!");
        return;
      }
      if (!product.quantity || product.quantity <= 0) {
        toast.error("All products must have a valid quantity!");
        return;
      }
    }

    setSubmitLoading(true);
    try {
      const allproduct = tableProducts.map((product) => {
        const base = {
          purchasePrice:
            typeof product.purchasePrice === "string"
              ? parseFloat(product.purchasePrice)
              : product.purchasePrice,
          wholesalePrice:
            typeof product.wholesalePrice === "string"
              ? parseFloat(product.wholesalePrice) || 0
              : product.wholesalePrice || 0,
          retailPrice:
            typeof product.retailPrice === "string"
              ? parseFloat(product.retailPrice) || 0
              : product.retailPrice || 0,
          quantity: product.quantity,
          size: product.size.join(", "),
          color: product.color.join(", "),
        };
        return product.variantType === "multipleVariant"
          ? { ...base, variant: product.variantId }
          : { ...base, product: product.productId };
      });

      const payload = {
        invoiceNumber: formData.invoiceNumber,
        supplierId: formData.supplierId,
        date: formData.date,
        cashType: formData.cashType || undefined,
        allproduct,
        subTotal,
        commission: formData.commission,
        shipping: formData.shipping,
        payable: formData.payable,
        dueamount: formData.dueamount,
        paid: formData.paid,
      };

      await axiosSecure.post("/purchase/add-purchase", payload);
      toast.success("Purchase created successfully!");
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["account-transaction-history"] });
      // A purchase touches most dashboard widgets (Purchase Items, Inventory
      // Value, Stock Cost, Outflow, Accounts Balance, Overview KPIs) — the
      // backend already cascades its cache bump to every dashboard box on
      // write, so invalidate every "dashboard-*" query here too instead of
      // naming just one and leaving the rest stale until their own TTL.
      queryClient.invalidateQueries({
        predicate: (query) =>
          typeof query.queryKey[0] === "string" &&
          query.queryKey[0].startsWith("dashboard-"),
      });
      setTableProducts([]);
      setFormData({
        invoiceNumber: "",
        supplierId: "",
        date: getTodayDate(),
        cashType: "",
        commission: 0,
        shipping: 0,
        payable: 0,
        dueamount: 0,
        paid: 0,
      });
      setErrors({});
    } catch (error: any) {
      showApiError(error, "Failed to create purchase!");
    } finally {
      setSubmitLoading(false);
    }
  };

  const fmt = (num: number) =>
    num % 1 === 0 ? num.toString() : num.toFixed(2);

  const isDropdownVisible =
    showDropdown &&
    searchQuery.trim().length > 0 &&
    (searchLoading ||
      searchResults.length > 0 ||
      debouncedQuery.trim().length > 0);

  return (
    <div className="space-y-5">
      {/* ── Section 1: Purchase Info ── */}
      <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="px-5 py-3.5 border-b border-gray-100 dark:border-gray-800">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
            Purchase Info
          </p>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <DatePicker
              label="Purchase Date"
              id="purchase-date"
              //@ts-ignore
              value={formData.date}
              defaultDate={formData.date}
              //@ts-ignore
              onChange={(date) => handleFormChange("date", date)}
            />
          </div>

          <div>
            <Label htmlFor="invoiceNumber">
              Invoice No. <span className="text-red-500">*</span>
            </Label>
            <Input
              id="invoiceNumber"
              placeholder="e.g. INV-2026-001"
              value={formData.invoiceNumber}
              onChange={(e) =>
                handleFormChange("invoiceNumber", e.target.value)
              }
              className={errors.invoiceNumber ? "border-red-500" : ""}
            />
            {errors.invoiceNumber && (
              <p className="text-red-500 text-xs mt-1">
                {errors.invoiceNumber}
              </p>
            )}
          </div>

          <div>
            <Label>
              Supplier <span className="text-red-500">*</span>
            </Label>
            <SearchableSelect
              options={suppliers.map((s) => ({
                value: s._id,
                label: s.supplierName,
              }))}
              value={formData.supplierId}
              onChange={(val) => handleFormChange("supplierId", val)}
              placeholder={
                suppliers.length === 0 ? "Loading..." : "Select supplier"
              }
              searchPlaceholder="Search supplier..."
              hasError={!!errors.supplierId}
            />
            {errors.supplierId && (
              <p className="text-red-500 text-xs mt-1">{errors.supplierId}</p>
            )}
          </div>

          <div>
            <Label>Cash Account</Label>
            <SearchableSelect
              options={accounts.map((a) => ({ value: a._id, label: a.name }))}
              value={formData.cashType}
              onChange={(val) => handleFormChange("cashType", val)}
              placeholder={
                accounts.length === 0 ? "Loading..." : "Select account"
              }
              searchPlaceholder="Search account..."
            />
          </div>
        </div>
      </div>

      {/* ── Section 2: Product Search + Table ── */}
      <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="px-5 py-3.5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
            Products
          </p>
          {tableProducts.length > 0 && (
            <span className="text-xs font-medium text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-500/10 px-2.5 py-0.5 rounded-full">
              {tableProducts.length} item{tableProducts.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Search bar */}
        <div
          className="px-5 py-4 border-b border-gray-50 dark:border-gray-800/60"
          ref={dropdownRef}
        >
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
              value={searchQuery}
              onChange={handleSearchChange}
              onFocus={() => searchQuery.trim() && setShowDropdown(true)}
              onBlur={handleSearchBlur}
              onKeyDown={handleSearchKeyDown}
              autoComplete="off"
              disabled={isScanning}
              placeholder="Scan barcode or search by product name…"
              className="w-full pl-10 pr-10 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white placeholder:text-gray-400 outline-none focus:bg-white dark:focus:bg-gray-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all duration-200"
            />
            {searchLoading && (
              <FaSpinner className="absolute right-3.5 top-1/2 -translate-y-1/2 text-brand-500 size-3.5 animate-spin" />
            )}

            {/* Dropdown */}
            {isDropdownVisible && (
              <div className="absolute top-full left-0 right-0 z-50 mt-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden">
                {searchLoading ? (
                  <div className="flex items-center gap-3 px-4 py-4 text-sm text-gray-400">
                    <FaSpinner className="animate-spin text-brand-500 size-4 shrink-0" />
                    <span>Searching products…</span>
                  </div>
                ) : searchResults.length > 0 ? (
                  <div className="max-h-72 overflow-y-auto divide-y divide-gray-50 dark:divide-gray-800">
                    {searchResults.map((item) => {
                      const displayName =
                        item._type === "variant"
                          ? item.productName
                            ? `${item.productName} — ${item.variantName || ""}`
                            : item.variantName || "Unnamed Variant"
                          : item.name || "Unnamed Product";
                      const stock =
                        item._type === "variant"
                          ? (item.stockVariant ?? 0)
                          : (item.stock ?? 0);
                      const img =
                        Array.isArray(item.image) && item.image.length > 0
                          ? item.image[0].url
                          : null;

                      return (
                        <button
                          key={item._id}
                          type="button"
                          onClick={() => selectProduct(item)}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
                        >
                          {img ? (
                            <img
                              src={img}
                              alt={displayName}
                              className="size-10 rounded-lg object-cover shrink-0 border border-gray-100 dark:border-gray-700"
                            />
                          ) : (
                            <div className="size-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
                              <FaBoxOpen className="size-4 text-gray-300 dark:text-gray-600" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate leading-tight">
                              {displayName}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              {item.barCode && (
                                <span className="text-[11px] text-gray-400 font-mono">
                                  #{item.barCode}
                                </span>
                              )}
                              {item.size && item.size !== "N/A" && (
                                <span className="text-[11px] text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                                  {item.size}
                                </span>
                              )}
                              {item.color && item.color !== "N/A" && (
                                <span className="text-[11px] text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                                  {item.color}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-semibold text-brand-600 dark:text-brand-400">
                              ৳{item.purchasePrice ?? 0}
                            </p>
                            <p className="text-[11px] text-gray-400 mt-0.5">
                              Stock: {stock}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : debouncedQuery.trim() && !searchLoading ? (
                  <div className="flex flex-col items-center gap-2 px-4 py-8 text-gray-400">
                    <FaBoxOpen className="size-7 opacity-40" />
                    <p className="text-sm">
                      No products found for "{debouncedQuery}"
                    </p>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>

        {/* Product table */}
        <div className="overflow-x-auto rounded-b-2xl">
          <table className="w-full text-sm min-w-225">
            <thead>
              <tr className="bg-gray-50/80 dark:bg-gray-800/50">
                {[
                  "#",
                  "Product",
                  "Barcode",
                  "Size",
                  "Color",
                  "Buy Rate",
                  "Qty",
                  "WS Price",
                  "Retail",
                  "Total",
                  "",
                ].map((h, i) => (
                  <th
                    key={i}
                    className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider whitespace-nowrap border-b border-gray-100 dark:border-gray-800"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60">
              {tableProducts.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-14 text-center">
                    <div className="flex flex-col items-center gap-2.5 text-gray-300 dark:text-gray-600">
                      <FaBoxOpen className="size-10" />
                      <p className="text-sm text-gray-400 dark:text-gray-500">
                        Search and add products above
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                tableProducts.map((product, index) => {
                  const purchasePrice =
                    typeof product.purchasePrice === "string"
                      ? parseFloat(product.purchasePrice) || 0
                      : product.purchasePrice || 0;
                  const totalPrice = purchasePrice * product.quantity;

                  return (
                    <tr
                      key={product.id}
                      className="group hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition-colors"
                    >
                      <td className="px-3 py-2.5 w-8">
                        <span className="text-[11px] text-gray-400 font-medium tabular-nums">
                          {index + 1}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2 max-w-40">
                          {product.image ? (
                            <img
                              src={product.image}
                              alt={product.name}
                              className="size-7 rounded-md object-cover shrink-0 border border-gray-100 dark:border-gray-700"
                            />
                          ) : (
                            <div className="size-7 rounded-md bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
                              <FaBoxOpen className="size-3 text-gray-300 dark:text-gray-600" />
                            </div>
                          )}
                          <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">
                            {product.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-[11px] text-gray-400 font-mono tabular-nums">
                          {product.barcode || "—"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {product.size.join(", ") || "—"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {product.color.join(", ") || "—"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <input
                          type="number"
                          value={product.purchasePrice}
                          onChange={(e) =>
                            handleProductChange(
                              index,
                              "purchasePrice",
                              e.target.value,
                            )
                          }
                          onWheel={blurOnWheel}
                          className="w-20 px-2 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-white outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20 transition-all tabular-nums"
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <input
                          type="number"
                          min={1}
                          value={product.quantity}
                          onChange={(e) =>
                            handleProductChange(
                              index,
                              "quantity",
                              parseInt(e.target.value) || 1,
                            )
                          }
                          onWheel={blurOnWheel}
                          className="w-14 px-2 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-white outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20 transition-all tabular-nums"
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <input
                          type="number"
                          value={product.wholesalePrice}
                          onChange={(e) =>
                            handleProductChange(
                              index,
                              "wholesalePrice",
                              e.target.value,
                            )
                          }
                          onWheel={blurOnWheel}
                          className="w-20 px-2 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-white outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20 transition-all tabular-nums"
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <input
                          type="number"
                          value={product.retailPrice}
                          onChange={(e) =>
                            handleProductChange(
                              index,
                              "retailPrice",
                              e.target.value,
                            )
                          }
                          onWheel={blurOnWheel}
                          className="w-20 px-2 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-white outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20 transition-all tabular-nums"
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-xs font-semibold text-gray-800 dark:text-white tabular-nums">
                          ৳{fmt(totalPrice)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <button
                          type="button"
                          onClick={() => removeRow(index)}
                          className="size-7 flex items-center justify-center rounded-lg bg-red-500 text-gray-300 dark:text-gray-600 hover:text-white hover:bg-red-500/80 dark:hover:bg-red-500 transition-all duration-200 "
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

      {/* ── Section 3: Payment Summary ── */}
      <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 dark:border-gray-800">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
            Payment Summary
          </p>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {/* Subtotal — read-only */}
            <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 px-4 py-3 space-y-1">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                Subtotal
              </p>
              <p className="text-base font-bold text-gray-800 dark:text-white tabular-nums">
                ৳{fmt(subTotal)}
              </p>
            </div>

            {/* Commission — editable */}
            <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 px-4 py-3 space-y-1">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                Commission
              </p>
              <div className="relative">
                <span className="absolute left-0 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-medium">
                  ৳
                </span>
                <input
                  type="number"
                  value={formData.commission}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) =>
                    handleFormChange(
                      "commission",
                      parseFloat(e.target.value) || 0,
                    )
                  }
                  onWheel={blurOnWheel}
                  className="w-full pl-4 pr-0 py-0 text-base font-bold bg-transparent text-gray-800 dark:text-white outline-none tabular-nums border-0 border-b border-gray-200 dark:border-gray-700 rounded-none focus:border-brand-500 transition-colors"
                />
              </div>
            </div>

            {/* Shipping — editable */}
            <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 px-4 py-3 space-y-1">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                Shipping
              </p>
              <div className="relative">
                <span className="absolute left-0 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-medium">
                  ৳
                </span>
                <input
                  type="number"
                  value={formData.shipping}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) =>
                    handleFormChange(
                      "shipping",
                      parseFloat(e.target.value) || 0,
                    )
                  }
                  onWheel={blurOnWheel}
                  className="w-full pl-4 pr-0 py-0 text-base font-bold bg-transparent text-gray-800 dark:text-white outline-none tabular-nums border-0 border-b border-gray-200 dark:border-gray-700 rounded-none focus:border-brand-500 transition-colors"
                />
              </div>
            </div>

            {/* Payable — read-only, accent */}
            <div className="rounded-xl bg-brand-50 dark:bg-brand-500/10 px-4 py-3 space-y-1">
              <p className="text-[10px] font-semibold text-brand-500 dark:text-brand-400 uppercase tracking-wider">
                Payable
              </p>
              <p className="text-base font-bold text-brand-600 dark:text-brand-400 tabular-nums">
                ৳{fmt(formData.payable)}
              </p>
            </div>

            {/* Paid — editable */}
            <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 px-4 py-3 space-y-1">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                Paid
              </p>
              <div className="relative">
                <span className="absolute left-0 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-medium">
                  ৳
                </span>
                <input
                  type="number"
                  value={formData.paid}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) =>
                    handleFormChange("paid", parseFloat(e.target.value) || 0)
                  }
                  onWheel={blurOnWheel}
                  className="w-full pl-4 pr-0 py-0 text-base font-bold bg-transparent text-gray-800 dark:text-white outline-none tabular-nums border-0 border-b border-gray-200 dark:border-gray-700 rounded-none focus:border-brand-500 transition-colors"
                />
              </div>
            </div>

            {/* Due — colored */}
            <div
              className={`rounded-xl px-4 py-3 space-y-1 ${
                formData.dueamount > 0
                  ? "bg-red-50 dark:bg-red-500/10"
                  : "bg-green-50 dark:bg-green-500/10"
              }`}
            >
              <p
                className={`text-[10px] font-semibold uppercase tracking-wider ${
                  formData.dueamount > 0
                    ? "text-red-500"
                    : "text-green-600 dark:text-green-400"
                }`}
              >
                Due
              </p>
              <p
                className={`text-base font-bold tabular-nums ${
                  formData.dueamount > 0
                    ? "text-red-500"
                    : "text-green-600 dark:text-green-400"
                }`}
              >
                ৳{fmt(formData.dueamount)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Submit ── */}
      <div className="flex items-center justify-end gap-3 pt-1">
        <Button
          onClick={handleSubmit}
          disabled={submitLoading}
            className="bg-[#DCE8FF] hover:bg-[#C7DAFF] text-[#1D4ED8] px-7 py-2.5 rounded-xl font-medium text-sm transition-all disabled:opacity-60 min-w-36"
        >
          {submitLoading ? (
            <span className="flex items-center justify-center gap-2">
              <FaSpinner className="animate-spin size-3.5" />
              Creating…
            </span>
          ) : (
            "Create Purchase"
          )}
        </Button>
      </div>
    </div>
  );
};

export default CreatePurchaseForm;
