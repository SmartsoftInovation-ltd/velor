import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  FaSearch,
  FaTimes,
  FaBoxOpen,
  FaUndoAlt,
  FaSpinner,
} from "react-icons/fa";
import { MdDelete } from "react-icons/md";
import axiosSecure from "../../hooks/useAxiosSecure";
import Label from "../form/Label";
import SearchableSelect from "../form/SearchableSelect";
import Button from "../ui/button/Button";
import MobileActionBar from "../common/MobileActionBar";
import DatePicker from "../form/date-picker";
import PageMeta from "../common/PageMeta";
import PageBreadcrumb from "../common/PageBreadCrumb";
import ComponentCard from "../common/ComponentCard";
import { showApiError } from "../../utils/apiError";

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

const PurchaseReturnUpdate = () => {
  const { slug: id } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // ── Supplier state ──────────────────────────────────────────────────────────
  const [supplierQuery, setSupplierQuery] = useState("");
  const [allSuppliers, setAllSuppliers] = useState<Supplier[]>([]);
  const [supplierResults, setSupplierResults] = useState<Supplier[]>([]);
  const [showSupplierDrop, setShowSupplierDrop] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const supplierRef = useRef<HTMLDivElement>(null);

  // ── Product search state ────────────────────────────────────────────────────
  const [productQuery, setProductQuery] = useState("");
  const [debouncedProductQuery, setDebouncedProductQuery] = useState("");
  const [showProductDrop, setShowProductDrop] = useState(false);
  const productRef = useRef<HTMLDivElement>(null);
  const productDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Return items ────────────────────────────────────────────────────────────
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);

  // ── Form fields ─────────────────────────────────────────────────────────────
  // Account the supplier's refund is paid into. Changing it moves the refund
  // to the newly chosen account — the backend reverses the old credit first.
  const [cashType, setCashType] = useState("");

  const [returnDate, setReturnDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [remarks, setRemarks] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ── Fetch existing record ───────────────────────────────────────────────────
  const { data: existing, isLoading: isFetching } = useQuery({
    queryKey: ["purchase-return", id],
    queryFn: async () => {
      const { data } = await axiosSecure.get(`/purchase-return/${id}`);
      return data?.data?.purchaseReturn;
    },
    enabled: !!id,
  });

  // ── Load all suppliers once ─────────────────────────────────────────────────
  useEffect(() => {
    axiosSecure
      .get("/supplier/getsuppliers")
      .then(({ data }) => setAllSuppliers(data.data || []))
      .catch(() => {});
  }, []);

  // ── Populate form from existing record ─────────────────────────────────────
  useEffect(() => {
    if (!existing || allSuppliers.length === 0) return;

    const sup = allSuppliers.find(
      (s) => s._id === (existing.supplier?._id ?? existing.supplier),
    );
    if (sup) {
      setSelectedSupplier(sup);
      setSupplierQuery(sup.supplierName);
    }

    setReturnDate(
      existing.returnDate
        ? existing.returnDate.split("T")[0]
        : new Date().toISOString().split("T")[0],
    );
    setRemarks(existing.remarks || "");
    // cashType may come back populated or as a bare id depending on the route.
    setCashType(existing.cashType?._id ?? existing.cashType ?? "");

    const items: ReturnItem[] = (existing.products || []).map((p: any) => {
      const isVariant = !!p.variant;
      return {
        id: isVariant ? (p.variant?._id ?? p.variant) : (p.product?._id ?? p.product),
        displayName: isVariant
          ? (p.variant?.variantName ?? "Variant")
          : (p.product?.name ?? "Product"),
        product: isVariant
          ? (p.product?._id ?? p.product ?? null)
          : (p.product?._id ?? p.product),
        variant: isVariant ? (p.variant?._id ?? p.variant) : null,
        purchasePrice: p.purchasePrice,
        availableStock:
          p.variant?.stockVariant ?? p.product?.stock ?? p.quantity,
        quantity: p.quantity,
        subtotal: p.subtotal,
        image: "",
      };
    });
    setReturnItems(items);
  }, [existing, allSuppliers]);

  // ── Filter suppliers ────────────────────────────────────────────────────────
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

  // ── Outside click handlers ──────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (supplierRef.current && !supplierRef.current.contains(e.target as Node))
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

  // ── Product search ──────────────────────────────────────────────────────────
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
    queryKey: ["return-product-search-update", debouncedProductQuery],
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

    setReturnItems((prev) => [
      ...prev,
      {
        id: item._id,
        displayName,
        product: isVariant ? (item.product ?? null) : item._id,
        variant: isVariant ? item._id : null,
        purchasePrice,
        availableStock: stock,
        quantity: 1,
        subtotal: purchasePrice,
        image: img,
      },
    ]);
    setProductQuery("");
    setDebouncedProductQuery("");
    setShowProductDrop(false);
    setErrors((prev) => ({ ...prev, items: "" }));
  };

  const updateQuantity = (id: string, rawVal: string) => {
    const qty = Math.max(1, parseInt(rawVal) || 1);
    setReturnItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, quantity: qty, subtotal: item.purchasePrice * qty }
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
        errs.items = `"${item.displayName}" — qty (${item.quantity}) exceeds stock (${item.availableStock}).`;
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
      await axiosSecure.put(`/purchase-return/${id}`, payload);
      toast.success("Purchase return updated successfully!");
      queryClient.invalidateQueries({ queryKey: ["purchase-returns-v2"] });
      queryClient.invalidateQueries({ queryKey: ["purchase-return", id] });
      // The return moves the supplier's due and an account balance.
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["supplier"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({
        predicate: (query) =>
          typeof query.queryKey[0] === "string" &&
          query.queryKey[0].startsWith("dashboard-"),
      });
      setTimeout(() => navigate("/purchase-return-list"), 50);
    } catch (error: any) {
      showApiError(error, "Failed to update purchase return.");
    } finally {
      setIsLoading(false);
    }
  };

  const fmt = (n: number) =>
    n.toLocaleString("en-BD", { minimumFractionDigits: 0 });

  if (isFetching) {
    return (
      <div className="flex justify-center min-h-[400px] items-center">
        <div className="size-10 border-4 border-accent-500/20 border-t-accent-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <PageMeta
        title="Update Purchase Return - Baig Ecommerce"
        description="Update purchase return"
      />
      <PageBreadcrumb pageTitle="Update Purchase Return" />
      <div className="space-y-6">
        <ComponentCard
          title={
            <div className="flex justify-between items-center">
              <h2 className="text-md font-medium">Update Purchase Return</h2>
              <Link to="/purchase-return-list">
                <Button className="!bg-accent-500 hover:!bg-accent-600 !text-white font-semibold px-4 py-2 rounded">
                  Return List
                </Button>
              </Link>
            </div>
          }
        >
          <div className="space-y-5">
            {/* ── Return Info ───────────────────────────────────────────────── */}
            <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-gray-100 dark:border-gray-800">
                <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                  Return Info
                </p>
              </div>
              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
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
                        if (selectedSupplier) setSelectedSupplier(null);
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
                          ? "border-red-400"
                          : selectedSupplier
                            ? "border-accent-400 bg-accent-50/30 dark:bg-accent-500/5"
                            : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:bg-white dark:focus:bg-gray-900 focus:border-accent-500 focus:ring-accent-500/20"
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
                    <p className="text-red-500 text-xs mt-1">
                      {errors.supplier}
                    </p>
                  )}
                  {showSupplierDrop && (
                    <div className="absolute z-50 w-full mt-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden">
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
                            {s.supplierId && (
                              <p className="text-xs text-gray-400 mt-0.5">
                                {s.supplierId}
                              </p>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Date + remarks */}
                <div className="space-y-4">
                  <div>
                    <DatePicker
                      label="Return Date *"
                      id="update-return-date"
                      defaultDate={returnDate}
                      // @ts-ignore
                      onChange={(d) => setReturnDate(d)}
                    />
                    {errors.returnDate && (
                      <p className="text-red-500 text-xs mt-1">
                        {errors.returnDate}
                      </p>
                    )}
                  </div>
                  {/* Refund Account — the full return value is credited here */}
                  <div>
                    <Label>
                      Refund Account <span className="text-red-500">*</span>
                    </Label>
                    <SearchableSelect
                      options={accounts.map((a) => ({
                        value: a._id,
                        label: a.name,
                      }))}
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
                      <p className="text-red-500 text-xs mt-1">
                        {errors.cashType}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label>Remarks</Label>
                    <textarea
                      rows={3}
                      placeholder="Optional notes…"
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white outline-none focus:bg-white dark:focus:bg-gray-900 focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 transition-all placeholder:text-gray-400 resize-y"
                    />
                  </div>
                </div>
              </div>

              {/* Due preview */}
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

            {/* ── Products ─────────────────────────────────────────────────── */}
            <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                  Return Products
                </p>
                {returnItems.length > 0 && (
                  <span className="text-xs font-medium text-accent-600 dark:text-accent-400 bg-accent-50 dark:bg-accent-500/10 px-2.5 py-0.5 rounded-full">
                    {returnItems.length} item
                    {returnItems.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>

              {/* Search */}
              <div
                ref={productRef}
                className="relative px-5 py-4 border-b border-gray-50 dark:border-gray-800/60"
              >
                <div className="relative">
                  <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 size-3.5 pointer-events-none" />
                  <input
                    type="text"
                    value={productQuery}
                    onChange={handleProductQueryChange}
                    onFocus={() =>
                      productQuery.trim() && setShowProductDrop(true)
                    }
                    placeholder="Add more products to return…"
                    autoComplete="off"
                    className="w-full pl-10 pr-10 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white placeholder:text-gray-400 outline-none focus:bg-white dark:focus:bg-gray-900 focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 transition-all duration-200"
                  />
                  {productSearching ? (
                    <FaSpinner className="absolute right-3.5 top-1/2 -translate-y-1/2 text-accent-500 size-3.5 animate-spin" />
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

                {showProductDrop && productQuery.trim() && (
                  <div className="absolute z-50 left-5 right-5 mt-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden">
                    {productSearching ? (
                      <div className="flex items-center gap-3 px-4 py-4 text-sm text-gray-400">
                        <FaSpinner className="animate-spin text-accent-500 size-4 shrink-0" />
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
                                  ? "opacity-40 cursor-not-allowed"
                                  : "hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                              }`}
                            >
                              {img ? (
                                <img
                                  src={img}
                                  alt={displayName}
                                  className="size-9 rounded-lg object-cover shrink-0"
                                />
                              ) : (
                                <div className="size-9 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
                                  <FaBoxOpen className="size-3.5 text-gray-300" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-800 dark:text-white truncate">
                                  {displayName}
                                </p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-sm font-semibold text-accent-600 dark:text-accent-400 tabular-nums">
                                  ৳{item.purchasePrice ?? 0}
                                </p>
                                <p className="text-[11px] text-gray-400">
                                  Stock: {stock}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>

              {errors.items && (
                <div className="mx-5 mt-4 px-4 py-3 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-xl text-red-600 dark:text-red-400 text-sm">
                  {errors.items}
                </div>
              )}

              {/* Table */}
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
                        <td colSpan={7} className="px-4 py-12 text-center">
                          <div className="flex flex-col items-center gap-2.5 text-gray-300 dark:text-gray-600">
                            <FaBoxOpen className="size-9" />
                            <p className="text-sm text-gray-400 dark:text-gray-500">
                              No products added
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      returnItems.map((item, idx) => {
                        const isOverStock =
                          item.quantity > item.availableStock;
                        return (
                          <tr
                            key={item.id}
                            className="group hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition-colors"
                          >
                            <td className="px-3 py-3 w-8">
                              <span className="text-[11px] text-gray-400 tabular-nums">
                                {idx + 1}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-2">
                                {item.image ? (
                                  <img
                                    src={item.image}
                                    alt={item.displayName}
                                    className="size-8 rounded-lg object-cover shrink-0"
                                  />
                                ) : (
                                  <div className="size-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
                                    <FaBoxOpen className="size-3 text-gray-300" />
                                  </div>
                                )}
                                <span className="text-xs font-medium text-gray-800 dark:text-white">
                                  {item.displayName}
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 tabular-nums">
                                ৳{fmt(item.purchasePrice)}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 tabular-nums">
                                {item.availableStock}
                              </span>
                            </td>
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
                                    : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-white focus:ring-accent-500/20 focus:border-accent-500"
                                }`}
                              />
                              {isOverStock && (
                                <p className="text-[10px] text-red-500 mt-0.5 whitespace-nowrap">
                                  Max {item.availableStock}
                                </p>
                              )}
                            </td>
                            <td className="px-3 py-3">
                              <span className="text-xs font-bold text-gray-800 dark:text-white tabular-nums">
                                ৳{fmt(item.subtotal)}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              <button
                                type="button"
                                onClick={() => removeItem(item.id)}
                                aria-label="Remove item"
                                className="shine size-8 flex items-center justify-center rounded bg-error-50 text-error-600 hover:bg-error-100 dark:bg-error-500/15 dark:text-error-400 dark:hover:bg-error-500/25 transition-all active:scale-90"
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

            {/* Total */}
            {returnItems.length > 0 && (
              <div className="flex items-center justify-end gap-4 px-1">
                <div className="rounded-xl bg-orange-50 dark:bg-orange-500/10 border border-orange-100 dark:border-orange-500/20 px-5 py-3">
                  <p className="text-[10px] font-semibold text-orange-500 uppercase tracking-wider">
                    Total Return Amount
                  </p>
                  <p className="text-xl font-bold text-orange-600 dark:text-orange-400 tabular-nums">
                    ৳{fmt(totalReturnAmount)}
                  </p>
                </div>
              </div>
            )}

            {/* Submit */}
            <MobileActionBar>
<div className="flex items-center justify-end gap-3 pt-1">
              <Button
                onClick={handleSubmit}
                disabled={isLoading}
                  className="!bg-accent-500 hover:!bg-accent-600 !text-white font-semibold px-7 py-2.5 rounded-xl text-sm transition-all disabled:opacity-60 min-w-40"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Updating…
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <FaUndoAlt className="size-3" />
                    Update Return
                  </span>
                )}
              </Button>
            </div>
</MobileActionBar>
          </div>
        </ComponentCard>
      </div>
    </>
  );
};

export default PurchaseReturnUpdate;
