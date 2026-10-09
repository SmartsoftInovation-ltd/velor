import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import toast from "react-hot-toast";
import {
  FaSearch,
  FaTimes,
  FaBoxOpen,
  FaSpinner,
  FaFileInvoice,
  FaMinus,
  FaPlus,
  FaExclamationTriangle,
  FaExchangeAlt,
  FaRulerCombined,
  FaUserClock,
  FaHeartBroken,
  FaEllipsisH,
} from "react-icons/fa";
import type { IconType } from "react-icons";
import { HiOutlineReceiptRefund } from "react-icons/hi2";
import axiosSecure from "../../hooks/useAxiosSecure";
import Label from "../form/Label";
import InfiniteSearchList from "../product/barcodePrint/InfiniteSearchList";
import PickerSelect from "./PickerSelect";
import AccountSelect from "./AccountSelect";
import { useFormDraft, draftValue, clearDraft } from "../../hooks/useFormDraft";

// Unsaved input survives a reload or a trip to another page in this tab
// (sessionStorage, per store); cleared once the form is submitted.
const DRAFT_KEY = "sales-return";

// ---------- Types ----------
interface SalesListItem {
  _id: string;
  invoiceNumber: string;
  total: number;
  createdAt: string;
  customerType?: {
    type: "walking" | "listed";
    walking?: { customerName?: string };
    customerId?: { _id: string; fullName?: string; openingDues?: number };
  };
}

interface AccountItem {
  _id: string;
  name: string;
  balance?: number;
}

interface PopulatedProduct {
  _id: string;
  name: string;
  barCode?: string;
  sku?: string;
  image?: Array<{ url: string }>;
}

interface PopulatedVariant {
  _id: string;
  variantName: string;
  barCode?: string;
  sku?: string;
  size?: string;
  color?: string;
  product?: string;
  thumbnail?: { url: string };
  image?: Array<{ url: string }>;
}

interface SearchItem {
  productId?: PopulatedProduct | string | null;
  variantId?: PopulatedVariant | string | null;
  salesStatus?: string;
  productDescription?: string;
  color?: string;
  size?: string;
  quantity: number;
  salesRate: number;
  subtotal: number;
}

interface SaleDetail {
  _id: string;
  invoiceNumber: string;
  total: number;
  date?: string;
  customerType?: SalesListItem["customerType"];
  searchItem: SearchItem[];
  lessTaka?: number;
  discountPercent?: number;
}

interface ReturnItem {
  key: string;
  product: string | null;
  variant: string | null;
  displayName: string;
  parentProductName: string | null;
  meta: string;
  barCode: string;
  image: string;
  unitPrice: number;
  maxQuantity: number;
  selected: boolean;
  quantity: number;
}

const RETURN_REASONS = [
  "Product quality issues",
  "Wrong item delivered",
  "Size/fit issue",
  "Customer changed mind",
  "Damaged product",
  "Other",
];

const RETURN_REASON_ICONS: Record<string, IconType> = {
  "Product quality issues": FaExclamationTriangle,
  "Wrong item delivered": FaExchangeAlt,
  "Size/fit issue": FaRulerCombined,
  "Customer changed mind": FaUserClock,
  "Damaged product": FaHeartBroken,
  Other: FaEllipsisH,
};

const CreateSalesReturnForm = () => {
  const queryClient = useQueryClient();

  const [invoicePickerOpen, setInvoicePickerOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<SalesListItem | null>(() => draftValue<SalesListItem | null>(DRAFT_KEY, "selectedSale", null));

  const [selectedAccount, setSelectedAccount] = useState<AccountItem | null>(() => draftValue<AccountItem | null>(DRAFT_KEY, "selectedAccount", null));

  const [returnReasonOption, setReturnReasonOption] = useState(() => draftValue(DRAFT_KEY, "returnReasonOption", ""));
  const [returnReasonText, setReturnReasonText] = useState(() => draftValue(DRAFT_KEY, "returnReasonText", ""));
  const [remarks, setRemarks] = useState(() => draftValue(DRAFT_KEY, "remarks", ""));
  const [returnItems, setReturnItems] = useState<ReturnItem[]>(() => draftValue<ReturnItem[]>(DRAFT_KEY, "returnItems", []));

  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loadedForSaleId, setLoadedForSaleId] = useState<string | null>(() => draftValue<string | null>(DRAFT_KEY, "loadedForSaleId", null));
  useFormDraft(
    DRAFT_KEY,
    useMemo(() => ({ selectedSale, selectedAccount, returnReasonOption, returnReasonText, remarks, returnItems, loadedForSaleId }), [selectedSale, selectedAccount, returnReasonOption, returnReasonText, remarks, returnItems, loadedForSaleId]),
  );

  // ── Load full sale detail once an invoice is picked ────────────────────────
  const { data: saleDetail, isFetching: loadingDetail } = useQuery<SaleDetail | null>({
    queryKey: ["sale-detail", selectedSale?.invoiceNumber],
    queryFn: async () => {
      if (!selectedSale) return null;
      const { data } = await axiosSecure.get(
        `/sales/get-sales?invoiceNumber=${encodeURIComponent(selectedSale.invoiceNumber)}`,
      );
      const arr = data?.data;
      return Array.isArray(arr) ? arr[0] ?? null : null;
    },
    enabled: !!selectedSale,
    staleTime: 0,
  });

  // ── Refund accounts for the payment dropdown ───────────────────────────────
  const { data: accountList = [] } = useQuery<AccountItem[]>({
    queryKey: ["sales-return-accounts"],
    queryFn: async () => {
      const { data } = await axiosSecure.get("/account/all-account");
      return data?.data?.accounts ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // ── Build return item candidates from sale detail ──────────────────────────
  const buildReturnItems = (detail: SaleDetail): ReturnItem[] => {
    return (detail.searchItem || [])
      .filter((si) => si.salesStatus !== "return")
      .map((si) => {
        const productObj = typeof si.productId === "object" ? si.productId : null;
        const variantObj = typeof si.variantId === "object" ? si.variantId : null;
        const productId = productObj?._id ?? (typeof si.productId === "string" ? si.productId : null);
        const variantId = variantObj?._id ?? (typeof si.variantId === "string" ? si.variantId : null);

        const isVariant = !!variantId;
        const displayName =
          variantObj?.variantName ?? productObj?.name ?? si.productDescription ?? "Unnamed item";

        const metaParts = [
          si.color && si.color !== "N/A" ? si.color : null,
          si.size && si.size !== "N/A" ? si.size : null,
        ].filter(Boolean);

        const image =
          variantObj?.thumbnail?.url ??
          variantObj?.image?.[0]?.url ??
          productObj?.image?.[0]?.url ??
          "";

        return {
          key: variantId ?? productId ?? `${displayName}-${Math.random()}`,
          product: isVariant ? null : productId,
          variant: variantId,
          displayName,
          parentProductName: isVariant ? (productObj?.name ?? null) : null,
          meta: metaParts.join(" / "),
          barCode: variantObj?.barCode ?? productObj?.barCode ?? "",
          image,
          unitPrice: si.salesRate ?? 0,
          maxQuantity: si.quantity ?? 1,
          selected: false,
          quantity: 1,
        };
      });
  };

  // Populate return items table when sale detail resolves
  if (saleDetail && saleDetail._id !== loadedForSaleId) {
    setLoadedForSaleId(saleDetail._id);
    setReturnItems(buildReturnItems(saleDetail));
  }

  // ── Item selection handlers ─────────────────────────────────────────────────
  const toggleItem = (key: string) => {
    setReturnItems((prev) =>
      prev.map((it) => (it.key === key ? { ...it, selected: !it.selected } : it)),
    );
    setErrors((prev) => ({ ...prev, items: "" }));
  };

  const toggleSelectAll = () => {
    const allSelected = returnItems.length > 0 && returnItems.every((it) => it.selected);
    setReturnItems((prev) => prev.map((it) => ({ ...it, selected: !allSelected })));
  };

  const stepQuantity = (key: string, delta: number) => {
    setReturnItems((prev) =>
      prev.map((it) => {
        if (it.key !== key) return it;
        const qty = Math.max(1, Math.min(it.maxQuantity, it.quantity + delta));
        return { ...it, quantity: qty };
      }),
    );
  };

  // ── Totals ──────────────────────────────────────────────────────────────────
  const selectedItems = returnItems.filter((it) => it.selected);
  // Items at their sale price, then the invoice's deductions (the server
  // recomputes the same figures, so this is what gets saved):
  //  - less taka is spread equally over every unit sold on the invoice, and
  //    each returned unit gives back its share;
  //  - discount % comes off the returned value at the same percent.
  // "return" lines still count as sold units — returning one must not raise
  // the share left on the rest.
  const grossReturnAmount = selectedItems.reduce((sum, it) => sum + it.unitPrice * it.quantity, 0);
  const soldUnits = (saleDetail?.searchItem ?? [])
    .filter((si) => si.salesStatus !== "exchange")
    .reduce((sum, si) => sum + (Number(si.quantity) || 0), 0);
  const invoiceLessTaka = Number(saleDetail?.lessTaka) || 0;
  const invoiceDiscountPercent = Number(saleDetail?.discountPercent) || 0;
  const returnedUnits = selectedItems.reduce((sum, it) => sum + it.quantity, 0);
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const discountAmount = round2((grossReturnAmount * invoiceDiscountPercent) / 100);
  const lessTakaShare = soldUnits > 0 ? round2((invoiceLessTaka / soldUnits) * returnedUnits) : 0;
  const lessPerUnit = soldUnits > 0 ? round2(invoiceLessTaka / soldUnits) : 0;
  const totalReturnAmount = Math.max(0, round2(grossReturnAmount - discountAmount - lessTakaShare));

  const fmt = (n: number) => n.toLocaleString("en-BD", { minimumFractionDigits: 0 });

  // ── Invoice / Refund selection ──────────────────────────────────────────────
  const selectInvoice = (item: SalesListItem) => {
    setSelectedSale(item);
    setInvoicePickerOpen(false);
    setLoadedForSaleId(null);
    setReturnItems([]);
    setErrors((prev) => ({ ...prev, invoice: "" }));
  };

  const clearInvoice = () => {
    setSelectedSale(null);
    setLoadedForSaleId(null);
    setReturnItems([]);
  };

  const selectAccount = (id: string) => {
    setSelectedAccount(accountList.find((a) => a._id === id) ?? null);
    setErrors((prev) => ({ ...prev, refundMethod: "" }));
  };

  // ── Validation ──────────────────────────────────────────────────────────────
  const effectiveReason = (returnReasonText.trim() || returnReasonOption).trim();

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!selectedSale) errs.invoice = "Please select an invoice.";
    if (!selectedAccount) errs.refundMethod = "Please select a refund method.";
    if (!effectiveReason) errs.returnReason = "Return reason is required.";
    if (selectedItems.length === 0) errs.items = "Select at least one product to return.";
    for (const item of selectedItems) {
      if (item.quantity > item.maxQuantity) {
        errs.items = `"${item.displayName}" — return qty (${item.quantity}) exceeds sold quantity (${item.maxQuantity}).`;
        break;
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── Submit ──────────────────────────────────────────────────────────────────
  const resetForm = () => {
    clearInvoice();
    setSelectedAccount(null);
    setReturnReasonOption("");
    setReturnReasonText("");
    setRemarks("");
    setErrors({});
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    if (!selectedSale || !selectedAccount) return;

    const payload = {
      invoiceNumber: selectedSale._id,
      refundMethod: selectedAccount._id,
      returnReason: effectiveReason,
      totalReturnAmount,
      remarks: remarks.trim() || undefined,
      allproduct: selectedItems.map((item) => ({
        product: item.product,
        variant: item.variant,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.unitPrice * item.quantity,
      })),
    };

    setIsLoading(true);
    try {
      await axiosSecure.post("/sales-return/createsalesreturn", payload);
      toast.success("Sales return created successfully!");
      clearDraft(DRAFT_KEY);
      queryClient.invalidateQueries({ queryKey: ["sales-returns"] });
      // Every dashboard widget: a sale moves Total Invoices, Total Sale
      // and the cash boxes, and each is keyed by range, so a prefix
      // match is what refreshes the one on screen.
      queryClient.invalidateQueries({
        predicate: (query) =>
          typeof query.queryKey[0] === "string" &&
          query.queryKey[0].startsWith("dashboard-"),
      });
      resetForm();
    } catch (error) {
      if (axios.isAxiosError(error)) {
        toast.error(error.response?.data?.message || "Failed to create sales return.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const customerLabel = (s: SalesListItem) =>
    s.customerType?.type === "listed"
      ? (s.customerType?.customerId?.fullName ?? "Listed customer")
      : (s.customerType?.walking?.customerName || "Walking customer");

  return (
    // The whole form lives inside one viewport-height card: each column scrolls
    // on its own so the page itself never scrolls.
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-visible lg:overflow-hidden p-4 lg:grid-cols-3">
      {/* ══════════════════════ LEFT COLUMN ══════════════════════ */}
      <div className="no-scrollbar flex min-h-0 flex-col gap-4 overflow-y-auto lg:col-span-2">
        {/* ── Invoice Info ─────────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="grid grid-cols-1 gap-3 p-3.5 sm:grid-cols-2">
            {/* Invoice Number picker */}
            <div className="relative">
              <Label>
                Select Invoice <span className="text-red-500">*</span>
              </Label>
              {selectedSale ? (
                <div
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 text-sm rounded-xl border ${
                    errors.invoice ? "border-red-400" : "border-accent-500/40 bg-accent-50/60 dark:bg-accent-500/15"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FaFileInvoice className="size-3.5 text-accent-600 shrink-0" />
                    <span className="text-sm font-medium text-gray-800 dark:text-white truncate">
                      {selectedSale.invoiceNumber}
                    </span>
                    <span className="text-xs text-gray-400 truncate">
                      — {customerLabel(selectedSale)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={clearInvoice}
                    aria-label="Clear invoice"
                    className="text-gray-400 hover:text-red-500 transition-colors shrink-0 ml-2"
                  >
                    <FaTimes className="size-3" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setInvoicePickerOpen((v) => !v)}
                  aria-expanded={invoicePickerOpen}
                  className={`w-full flex items-center gap-2 px-3.5 py-2.5 text-sm rounded-xl border text-left ${
                    errors.invoice
                      ? "border-red-400"
                      : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:border-accent-500/50"
                  } text-gray-400 transition-all`}
                >
                  <FaSearch className="size-3.5 shrink-0" />
                  Select an invoice…
                </button>
              )}
              {errors.invoice && <p className="text-red-500 text-xs mt-1">{errors.invoice}</p>}

              {invoicePickerOpen && (
                <div className="absolute z-[9999] w-full mt-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-2">
                  <InfiniteSearchList<SalesListItem>
                    queryKey="sales-return-invoice-picker"
                    endpoint="/sales/get-sales"
                    limit={30}
                    rowHeight={64}
                    maxHeight={280}
                    searchPlaceholder="Search by invoice number…"
                    emptyLabel="No invoices found"
                    extractPage={(raw, page) => {
                      const d = raw?.data as { sales?: SalesListItem[]; hasNextPage?: boolean } | undefined;
                      return {
                        items: d?.sales ?? [],
                        page,
                        hasNextPage: Boolean(d?.hasNextPage),
                      };
                    }}
                    getKey={(item) => item._id}
                    isSelected={(item) => item._id === selectedSale?._id}
                    onSelect={selectInvoice}
                    renderRow={(item) => (
                      <div className="flex items-center justify-between px-3 py-2.5">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-800 dark:text-white truncate">
                            {item.invoiceNumber}
                          </p>
                          <p className="text-xs text-gray-400 truncate">{customerLabel(item)}</p>
                        </div>
                        <span className="text-sm font-bold text-accent-600 dark:text-accent-400 tabular-nums shrink-0 ml-2">
                          ৳{fmt(item.total || 0)}
                        </span>
                      </div>
                    )}
                  />
                </div>
              )}
            </div>

            {/* Customer + Total (readonly summary of picked invoice) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Customer</Label>
                <div className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 truncate">
                  {selectedSale ? customerLabel(selectedSale) : "—"}
                </div>
              </div>
              <div>
                <Label>Invoice Total</Label>
                <div className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-semibold tabular-nums">
                  {selectedSale ? `৳${fmt(selectedSale.total || 0)}` : "—"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Items to Return ──────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <FaBoxOpen className="size-3.5 text-accent-600" />
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">Items to Return</p>
              {selectedItems.length > 0 && (
                <span className="text-xs font-bold text-accent-600 dark:text-accent-400 bg-accent-50 dark:bg-accent-500/15 size-5 rounded-full flex items-center justify-center">
                  {selectedItems.length}
                </span>
              )}
            </div>
            {returnItems.length > 0 && (
              <button
                type="button"
                onClick={toggleSelectAll}
                className="text-xs font-medium text-accent-600 dark:text-accent-400 hover:underline"
              >
                {returnItems.every((it) => it.selected) ? "Deselect All" : "Select All"}
              </button>
            )}
          </div>

          {errors.items && (
            <div className="mx-5 mt-4 px-4 py-3 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-xl text-red-600 dark:text-red-400 text-sm">
              {errors.items}
            </div>
          )}

          <div className="p-3 space-y-2.5">
            {!selectedSale ? (
              <div className="flex flex-col items-center justify-center gap-3 px-4 py-10">
                <div className="relative">
                  <span className="absolute inset-0 rounded-full bg-accent-500/10 blur-md" />
                  <span className="relative flex size-14 items-center justify-center rounded-full border border-dashed border-accent-500/30 bg-accent-50 text-accent-600 dark:border-accent-500/40 dark:bg-accent-500/15 dark:text-accent-400">
                    <FaFileInvoice className="size-6" />
                  </span>
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-gray-700 dark:text-gray-200">
                    No invoice selected
                  </p>
                  <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                    Pick an invoice to load the items you can return.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <span className="flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                    <FaSearch className="size-3 text-accent-600 dark:text-accent-400" />
                    Search by invoice number
                  </span>
                  <span className="flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                    <FaBoxOpen className="size-3 text-accent-600 dark:text-accent-400" />
                    Only unreturned items load
                  </span>
                </div>
              </div>
            ) : loadingDetail ? (
              <div className="py-8 text-center">
                <FaSpinner className="animate-spin text-accent-600 size-6 mx-auto" />
              </div>
            ) : returnItems.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <span className="flex size-12 items-center justify-center rounded-full border border-dashed border-gray-200 bg-gray-50 text-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-600">
                  <FaBoxOpen className="size-5" />
                </span>
                <p className="text-sm font-bold text-gray-700 dark:text-gray-200">
                  Nothing left to return
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  Every item on this invoice has already been returned.
                </p>
              </div>
            ) : (
              returnItems.map((item, idx) => {
                const isOverQty = item.quantity > item.maxQuantity;
                return (
                  <div
                    key={item.key}
                    onClick={() => toggleItem(item.key)}
                    // The whole list arrives at once when an invoice is picked,
                    // so rows are staggered slightly instead of animating one
                    // "new" row. Capped so a long invoice does not crawl in.
                    style={{ animationDelay: `${Math.min(idx, 12) * 40}ms` }}
                    className={`animate-row-in flex items-center gap-3 rounded-xl border-l-4 px-3 py-3 cursor-pointer transition-colors ${
                      item.selected
                        ? "border-l-accent-500 bg-accent-50/60 dark:bg-accent-500/15"
                        : "border-l-transparent bg-gray-50 dark:bg-gray-800/40 hover:bg-gray-100 dark:hover:bg-gray-800/70"
                    }`}
                  >
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={item.selected}
                      onChange={() => toggleItem(item.key)}
                      onClick={(e) => e.stopPropagation()}
                      className="size-4 rounded border-gray-300 text-accent-600 focus:ring-accent-500/30 shrink-0"
                    />

                    {/* Image */}
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.displayName}
                        className="size-10 rounded-lg object-cover shrink-0 border border-gray-200 dark:border-gray-700"
                      />
                    ) : (
                      <div className="size-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
                        <FaBoxOpen className="size-4 text-gray-300 dark:text-gray-600" />
                      </div>
                    )}

                    {/* Name + meta */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 dark:text-white truncate">
                        {item.displayName}
                      </p>
                      <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                        {item.parentProductName && (
                          <span className="text-[11px] text-gray-500 dark:text-gray-400">
                            of {item.parentProductName}
                          </span>
                        )}
                        {item.barCode && (
                          <span className="text-[11px] font-mono bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded">
                            #{item.barCode}
                          </span>
                        )}
                        {item.meta && <span className="text-[11px] text-gray-400">{item.meta}</span>}
                      </div>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        Returnable: {item.maxQuantity} × ৳{fmt(item.unitPrice)}
                      </p>
                    </div>

                    {/* Qty stepper */}
                    <div
                      className="flex items-center gap-2 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        disabled={!item.selected || item.quantity <= 1}
                        onClick={() => stepQuantity(item.key, -1)}
                        aria-label="Decrease quantity"
                        className="shine size-7 flex items-center justify-center rounded-lg bg-red-50 dark:bg-red-500/10 text-red-500 hover:bg-red-100 dark:hover:bg-red-500/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <FaMinus className="size-2.5" />
                      </button>
                      <span className="text-sm font-semibold text-gray-800 dark:text-white w-5 text-center tabular-nums">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        disabled={!item.selected || item.quantity >= item.maxQuantity}
                        onClick={() => stepQuantity(item.key, 1)}
                        aria-label="Increase quantity"
                        className="shine size-7 flex items-center justify-center rounded-lg bg-accent-50 dark:bg-accent-500/15 text-accent-600 dark:text-accent-400 hover:bg-accent-100 dark:hover:bg-accent-500/25 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <FaPlus className="size-2.5" />
                      </button>
                    </div>

                    {/* Subtotal */}
                    <div className="text-right w-20 shrink-0">
                      <p
                        className={`text-sm font-bold tabular-nums ${
                          isOverQty ? "text-red-500" : "text-accent-600 dark:text-accent-400"
                        }`}
                      >
                        ৳{fmt(item.selected ? item.unitPrice * item.quantity : 0)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ══════════════════════ RIGHT COLUMN — SUMMARY ══════════════════════ */}
      <div className="no-scrollbar flex min-h-0 flex-col gap-4 overflow-y-auto">
        {/* Summary */}
        <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
          <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-2.5 dark:border-gray-800">
            <HiOutlineReceiptRefund className="size-4 text-accent-600" />
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">Summary</p>
          </div>
          <div className="space-y-3 p-3.5">
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <p className="text-gray-500 dark:text-gray-400">Return Value</p>
                <p className="font-semibold text-gray-800 dark:text-gray-100 tabular-nums">
                  ৳{fmt(grossReturnAmount)}
                </p>
              </div>
              {invoiceDiscountPercent > 0 && (
                <div className="flex items-center justify-between">
                  <p className="text-gray-500 dark:text-gray-400">
                    Invoice Discount ({invoiceDiscountPercent}%)
                  </p>
                  <p className="font-semibold text-error-600 dark:text-error-400 tabular-nums">
                    −৳{fmt(discountAmount)}
                  </p>
                </div>
              )}
              {invoiceLessTaka > 0 && (
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Less Taka Share</p>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500">
                      ৳{fmt(invoiceLessTaka)} ÷ {soldUnits} unit{soldUnits === 1 ? "" : "s"} = ৳{fmt(lessPerUnit)}/unit × {returnedUnits}
                    </p>
                  </div>
                  <p className="font-semibold text-error-600 dark:text-error-400 tabular-nums">
                    −৳{fmt(lessTakaShare)}
                  </p>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-accent-500/15 bg-accent-50 px-4 py-3 text-center dark:border-accent-500/20 dark:bg-accent-500/15">
              <p className="text-[11px] font-bold uppercase tracking-wide text-accent-600/70 dark:text-accent-400/80">
                Refund to Customer
              </p>
              <p className="mt-0.5 text-2xl font-bold tabular-nums text-accent-600 dark:text-accent-400">
                ৳{fmt(totalReturnAmount)}
              </p>
            </div>

            {selectedSale?.customerType?.type === "listed" &&
              selectedSale.customerType.customerId && (
                <div className="rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                  <div className="px-3.5 py-2 bg-gray-50 dark:bg-gray-800/40 border-b border-gray-100 dark:border-gray-700">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                      Customer Due Impact
                    </p>
                  </div>
                  <div className="grid grid-cols-2 divide-x divide-gray-100 dark:divide-gray-700">
                    <div className="px-3.5 py-2.5">
                      <p className="text-[10px] text-gray-400 mb-0.5">Current Due</p>
                      <p className="text-sm font-bold text-red-500 tabular-nums">
                        ৳{fmt(selectedSale.customerType.customerId.openingDues ?? 0)}
                      </p>
                    </div>
                    <div className="px-3.5 py-2.5">
                      <p className="text-[10px] text-gray-400 mb-0.5">After Return</p>
                      <p className="text-sm font-bold text-accent-600 dark:text-accent-400 tabular-nums">
                        ৳
                        {fmt(
                          Math.max(
                            0,
                            (selectedSale.customerType.customerId.openingDues ?? 0) -
                              totalReturnAmount,
                          ),
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              )}
          </div>
        </div>

        {/* Refund Method + Reason */}
        <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="rounded-t-2xl border-b border-gray-100 px-4 py-2.5 dark:border-gray-800">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">Refund Method</p>
          </div>
          <div className="space-y-3 p-3.5">
            {/* Refund account picker */}
            <div>
              <AccountSelect
                accounts={accountList}
                value={selectedAccount?._id ?? ""}
                onChange={(id) => selectAccount(id)}
                placeholder="Select refund account…"
                size="md"
                placement="bottom"
                className={errors.refundMethod ? "rounded-xl ring-1 ring-red-400" : ""}
              />
              {errors.refundMethod && (
                <p className="text-red-500 text-xs mt-1">{errors.refundMethod}</p>
              )}
            </div>

            {/* Return Reason — dropdown + free text side by side */}
            <div>
              <Label>
                Return Reason <span className="text-red-500">*</span>
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <PickerSelect
                  options={RETURN_REASONS.map((r) => ({
                    value: r,
                    label: r,
                    icon: RETURN_REASON_ICONS[r],
                  }))}
                  value={returnReasonOption}
                  onChange={(val) => {
                    setReturnReasonOption(val);
                    setErrors((prev) => ({ ...prev, returnReason: "" }));
                  }}
                  placeholder="Choose…"
                  size="md"
                  placement="bottom"
                  className={errors.returnReason ? "rounded-xl ring-1 ring-red-400" : ""}
                />
                <input
                  type="text"
                  placeholder="Or type reason…"
                  value={returnReasonText}
                  onChange={(e) => {
                    setReturnReasonText(e.target.value);
                    setErrors((prev) => ({ ...prev, returnReason: "" }));
                  }}
                  className={`w-full px-2.5 py-2.5 text-xs rounded-xl border ${
                    errors.returnReason ? "border-red-400" : "border-gray-200 dark:border-gray-700"
                  } bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white outline-none focus:bg-white dark:focus:bg-gray-900 focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 transition-all placeholder:text-gray-400`}
                />
              </div>
              {errors.returnReason && (
                <p className="text-red-500 text-xs mt-1">{errors.returnReason}</p>
              )}
            </div>
          </div>
        </div>

        {/* Total Return Amount (non-editable) + Notes */}
        <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
          <div className="space-y-3 p-3.5">
            <div>
              <Label>Total Return Amount</Label>
              <div className="w-full px-3.5 py-2.5 text-sm font-bold rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800/70 text-gray-700 dark:text-gray-300 tabular-nums cursor-not-allowed">
                ৳{fmt(totalReturnAmount)}
              </div>
              <p className="text-[11px] text-gray-400 mt-1">
                Auto-calculated from selected items.
              </p>
            </div>

            <div>
              <Label>Notes (Optional)</Label>
              <textarea
                placeholder="Additional notes…"
                rows={3}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white outline-none focus:bg-white dark:focus:bg-gray-900 focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 transition-all placeholder:text-gray-400 resize-none"
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="grid shrink-0 grid-cols-2 gap-3 [&_button]:min-h-11">
          <button
            type="button"
            onClick={resetForm}
            disabled={isLoading}
            className="shine rounded-xl border border-gray-200 bg-gray-50 px-5 py-2.5 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isLoading}
              className="shine rounded-xl bg-accent-500 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-accent-600 disabled:opacity-60"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <FaSpinner className="animate-spin size-3.5" />
                Submitting…
              </span>
            ) : (
              "Process Return"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateSalesReturnForm;
