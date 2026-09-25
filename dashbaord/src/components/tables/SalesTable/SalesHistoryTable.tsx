import { useEffect, useRef, useState } from "react";
import useIsMobile from "../../../hooks/useIsMobile";
import MobileCardList from "../../common/MobileCardList";
import MobileCardRow from "../../common/MobileCardRow";
import { useQueryClient } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../../ui/table";
import Button from "../../ui/button/Button";
import { useNavigate } from "react-router";
import { MdDelete } from "react-icons/md";
import { FaChevronDown, FaEdit, FaEye, FaSearch, FaTimes } from "react-icons/fa";
import {
  FiAlertTriangle,
  FiBox,
  FiCheckCircle,
  FiClock,
  FiDollarSign,
  FiFileText,
} from "react-icons/fi";
import { HiOutlineDocumentText } from "react-icons/hi";
import { IoIosPrint } from "react-icons/io";
import { usePermission } from "../../../hooks/usePermission";
import { toast } from "react-hot-toast";
import axiosSecure from "../../../hooks/useAxiosSecure";
import { invalidateStockQueries } from "../../../utils/invalidateStock";
import { Modal } from "../../ui/modal";
import { showApiError } from "../../../utils/apiError";

// ── Types ──────────────────────────────────────────────────────────────────
interface ListedCustomer {
  _id: string;
  fullName: string;
  mobileNumber: string;
}

interface WalkingCustomer {
  customerName: string;
  mobileNumber: string;
}

interface CustomerType {
  type: "listed" | "walking";
  walking: WalkingCustomer | null;
  customerId: ListedCustomer | null;
}

interface Sale {
  _id: string;
  invoiceNumber: string;
  date: string;
  createdAt?: string;
  salesType: string;
  customerType: CustomerType;
  payable: number;
  paid: number;
  presentDue: number;
  paymentStatus: string;
  invoiceStatus: string;
  paymentMethod?: {
    singlePayment?: { amount?: number; paymentTo?: { name?: string } | string } | null;
    multiplePayment?: { amount?: number; paymentTo?: { name?: string } | string }[];
  };
}

// ── Filter bar bits ────────────────────────────────────────────────────────
const statTones: Record<string, string> = {
  blue: "bg-blue-50 text-blue-500 dark:bg-blue-500/10",
  green: "bg-green-50 text-green-500 dark:bg-green-500/10",
  amber: "bg-amber-50 text-amber-500 dark:bg-amber-500/10",
  violet: "bg-violet-50 text-violet-500 dark:bg-violet-500/10",
  red: "bg-red-50 text-red-500 dark:bg-red-500/10",
};

const statValueTones: Record<string, string> = {
  blue: "text-gray-800 dark:text-gray-100",
  green: "text-green-600",
  amber: "text-amber-600",
  violet: "text-violet-600",
  red: "text-red-600",
};

function StatCard({
  icon,
  tone,
  label,
  value,
}: {
  icon: React.ReactNode;
  tone: keyof typeof statTones;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-200 dark:border-white/5 bg-white dark:bg-white/3 px-3.5 py-3">
      <span className={`size-8 flex items-center justify-center rounded-lg shrink-0 ${statTones[tone]}`}>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 truncate">{label}</p>
        <p className={`text-sm font-bold ${statValueTones[tone]}`}>{value}</p>
      </div>
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  label,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`h-9 pl-3 pr-8 rounded-lg border text-xs bg-white dark:bg-gray-800 outline-none appearance-none cursor-pointer transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 ${
          value
            ? "border-brand-500 text-gray-800 dark:text-gray-100 font-semibold"
            : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400"
        }`}
      >
        <option value="">{label}</option>
        {children}
      </select>
      <FaChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 size-2.5 text-gray-400" />
    </div>
  );
}

// ── Action menu ────────────────────────────────────────────────────────────
interface ActionMenuProps {
  canEdit: boolean;
  canDelete: boolean;
  onView: () => void;
  onInvoice: () => void;
  onReceipt: () => void;
  onChallan: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const MENU_WIDTH = 192;
const MENU_HEIGHT = 300;

function ActionMenu({ canEdit, canDelete, onView, onInvoice, onReceipt, onChallan, onEdit, onDelete }: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  // The table scrolls inside an overflow container, which would clip an
  // absolutely-positioned menu — so the menu is fixed and positioned from the
  // button's viewport rect instead.
  const openMenu = () => {
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) {
      const flipUp = rect.bottom + MENU_HEIGHT > window.innerHeight;
      setPos({
        top: flipUp ? rect.top - MENU_HEIGHT - 4 : rect.bottom + 4,
        left: Math.max(8, rect.right - MENU_WIDTH),
      });
    }
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const close = () => setOpen(false);
    document.addEventListener("mousedown", handler);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", handler);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  const run = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  return (
    <div ref={ref} className="inline-block">
      <button
        ref={btnRef}
        onClick={() => (open ? setOpen(false) : openMenu())}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-teal-500 hover:bg-teal-600 text-white text-xs font-bold transition-colors"
      >
        options
        <FaChevronDown className={`size-2.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          style={{ top: pos.top, left: pos.left, width: MENU_WIDTH }}
          className="fixed z-[9999] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden"
        >
          <MenuItem icon={<FaEye className="size-3.5 text-blue-500" />} onClick={() => run(onView)}>
            View Details
          </MenuItem>

          <MenuItem icon={<IoIosPrint className="size-3.5 text-gray-500" />} onClick={() => run(onReceipt)}>
            Print Receipt
          </MenuItem>

          <MenuItem icon={<HiOutlineDocumentText className="size-3.5 text-gray-500" />} onClick={() => run(onInvoice)}>
            Print Invoice
          </MenuItem>

          <MenuItem icon={<FiBox className="size-3.5 text-gray-500" />} onClick={() => run(onChallan)}>
            Print Challan
          </MenuItem>

          {canEdit && (
            <MenuItem
              icon={<FaEdit className="size-3.5 text-orange-400" />}
              onClick={() => run(onEdit)}
            >
              Edit Sale
            </MenuItem>
          )}

          {canDelete && (
            <MenuItem
              icon={<MdDelete className="size-3.5 text-red-500" />}
              danger
              onClick={() => run(onDelete)}
            >
              Delete
            </MenuItem>
          )}
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon,
  children,
  onClick,
  disabled,
  danger,
  title,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-medium text-left border-b border-gray-100 dark:border-gray-700 last:border-b-0 transition-colors ${
        disabled
          ? "text-gray-300 dark:text-gray-600 cursor-not-allowed"
          : danger
 ?"text-[#0A6B43] hover:bg-red-50 dark:hover:bg-[#B8E4CF]/10"
            : "text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
      }`}
    >
      <span className={disabled ? "opacity-40" : ""}>{icon}</span>
      {children}
    </button>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────
function getCustomerName(ct: CustomerType): string {
  if (ct.type === "listed" && ct.customerId) return ct.customerId.fullName;
  if (ct.type === "walking") return ct.walking?.customerName?.trim() || "Walking Customer";
  return "—";
}

function getMobile(ct: CustomerType): string {
  if (ct.type === "listed" && ct.customerId) return ct.customerId.mobileNumber;
  if (ct.type === "walking" && ct.walking) return ct.walking.mobileNumber;
  return "—";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB");
}

// The `date` field carries only the day the cashier picked (no time), so the
// clock time comes from createdAt — when the sale was actually recorded.
function formatTime(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

const money = (n = 0) => `৳${Number(n || 0).toLocaleString()}`;

// Every account a sale was paid into — single and multiple are storage shapes,
// and a sale can carry both.
function paymentAccounts(sale: Sale): string[] {
  const payments = [
    ...(sale.paymentMethod?.singlePayment ? [sale.paymentMethod.singlePayment] : []),
    ...(sale.paymentMethod?.multiplePayment ?? []),
  ].filter((p) => p && (p.amount ?? 0) > 0);

  return [
    ...new Set(
      payments.map((p) =>
        typeof p.paymentTo === "object" && p.paymentTo?.name ? p.paymentTo.name : "Cash",
      ),
    ),
  ];
}

function isToday(iso?: string): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  );
}

const salesTypeLabel: Record<string, string> = {
  wholesale: "Wholesale",
  retailsale: "Retail Sale",
  retailsaleorder: "Retail Sale Order",
  wholesaleorder: "Wholesale Order",
};

const statusColors: Record<string, string> = {
  paid: "bg-green-100 text-green-700",
  partial: "bg-yellow-100 text-yellow-700",
  due: "bg-red-100 text-red-700",
  complete: "bg-blue-100 text-blue-700",
  pending: "bg-orange-100 text-orange-700",
  draft: "bg-gray-100 text-gray-600",
};

function StatusBadge({ value }: { value: string }) {
  const cls = statusColors[value?.toLowerCase()] ?? "bg-gray-100 text-gray-600";
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold capitalize ${cls}`}>
      {value}
    </span>
  );
}

// ── Component ──────────────────────────────────────────────────────────────
// `salesType` / `invoiceStatus`, when given, restrict the list server-side (via
// ?salesType= / ?invoiceStatus=). The corresponding filter dropdown is hidden
// since that dimension is already fixed. Used by the order-list and draft-order
// list pages.
const SalesHistoryTable = ({
  salesType,
  invoiceStatus: invoiceStatusProp,
  defaultInvoiceStatus = "",
}: {
  salesType?: string;
  invoiceStatus?: string;
  // Which invoice status the status filter starts on. The fetch still brings
  // back everything invoiceStatus allows, so clearing the filter reveals the
  // rest instead of triggering another request.
  defaultInvoiceStatus?: string;
} = {}) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const canEdit   = usePermission("sales-history", "edit");
  const canDelete = usePermission("sales-history", "delete");
  const [salesList, setSalesList] = useState<Sale[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState(defaultInvoiceStatus);
  const [loading, setLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);

  const handleDeleteModal = (saleId: string) => {
    setSelectedSaleId(saleId);
    setShowDeleteModal(true);
  };

  const closeModal = () => {
    setShowDeleteModal(false);
    setSelectedSaleId(null);
  };

  const handleDelete = async () => {
    // Guard against a second click while the first request is still running.
    if (isDeleting) return;
    if (!selectedSaleId) return;
    setIsDeleting(true);

    try {
      await axiosSecure.delete(`/sales/delete-sales/${selectedSaleId}`);
      toast.success("Sale deleted successfully.");
      fetchSales();
      invalidateStockQueries(queryClient);
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["account-transaction-history"] });
      // Every dashboard widget, not just the balance box: deleting a sale moves
      // Total Invoices and Total Sale too, and each is keyed by range, so a
      // prefix match is what actually refreshes the one on screen.
      queryClient.invalidateQueries({
        predicate: (query) =>
          typeof query.queryKey[0] === "string" &&
          query.queryKey[0].startsWith("dashboard-"),
      });
    } catch (error) {
      showApiError(error, "Failed to delete.");
    } finally {
      setIsDeleting(false);
      closeModal();
    }
  };

  // salesType may name one type or several (comma-separated).
  const allowedTypes = (salesType || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const fetchSales = async () => {
    // Guard against a second click while the first request is still running.
    if (isSubmitting) return;
    setLoading(true);
    setIsError(false);
    setIsSubmitting(true);
    try {
      const params = new URLSearchParams();
      if (salesType) params.set("salesType", salesType);
      if (invoiceStatusProp) params.set("invoiceStatus", invoiceStatusProp);
      const qs = params.toString();
      const endpoint = qs ? `/sales/get-sales?${qs}` : "/sales/get-sales";
      const res = await axiosSecure.get(endpoint);
      setSalesList(res?.data?.data || []);
    } catch (error) {
      setIsError(true);
      showApiError(error, "Failed to load sales.");
    } finally {
      setIsSubmitting(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSales();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salesType, invoiceStatusProp]);

  const filtered = salesList.filter((s) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      s.invoiceNumber?.toLowerCase().includes(q) ||
      getCustomerName(s.customerType).toLowerCase().includes(q) ||
      getMobile(s.customerType).includes(q);

    const matchesStatus = !statusFilter || s.paymentStatus === statusFilter;
    const matchesType = !typeFilter || s.salesType === typeFilter;
    const matchesPayment = !paymentFilter || paymentAccounts(s).includes(paymentFilter);
    const matchesInvoiceStatus =
      !invoiceStatusFilter || s.invoiceStatus === invoiceStatusFilter;

    return (
      matchesSearch &&
      matchesStatus &&
      matchesType &&
      matchesPayment &&
      matchesInvoiceStatus
    );
  });

  // Stats reflect the whole dataset, not the current filter — they're a summary
  // of the business, not of what happens to be on screen.
  const todaySales = salesList.filter((s) => isToday(s.createdAt || s.date));
  const stats = {
    todayCount: todaySales.length,
    todayAmount: todaySales.reduce((sum, s) => sum + (s.payable || 0), 0),
    totalDue: salesList.reduce((sum, s) => sum + (s.presentDue || 0), 0),
    paidCount: salesList.filter((s) => s.paymentStatus === "paid").length,
    dueCount: salesList.filter((s) => s.paymentStatus !== "paid").length,
  };

  // Only offer accounts that actually appear in the data.
  const accountOptions = [...new Set(salesList.flatMap(paymentAccounts))].sort();
  // Include the default even when no loaded row carries it, so the filter can
  // always be switched back to it.
  const invoiceStatusOptions = [
    ...new Set(
      [...salesList.map((s) => s.invoiceStatus), defaultInvoiceStatus].filter(
        Boolean,
      ),
    ),
  ].sort();

  const hasFilters = Boolean(
    search ||
      statusFilter ||
      typeFilter ||
      paymentFilter ||
      invoiceStatusFilter !== defaultInvoiceStatus,
  );
  const clearFilters = () => {
    setSearch("");
    setStatusFilter("");
    setTypeFilter("");
    setPaymentFilter("");
    setInvoiceStatusFilter(defaultInvoiceStatus);
  };

  return (
    <div>
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
        <StatCard
          icon={<FiFileText className="size-4" />}
          tone="blue"
          label="TODAY"
          value={String(stats.todayCount)}
        />
        <StatCard
          icon={<FiDollarSign className="size-4" />}
          tone="green"
          label="TODAY_SALES"
          value={money(stats.todayAmount)}
        />
        <StatCard
          icon={<FiClock className="size-4" />}
          tone="amber"
          label="TOTAL DUE"
          value={money(stats.totalDue)}
        />
        <StatCard
          icon={<FiCheckCircle className="size-4" />}
          tone="violet"
          label="PAID INVOICES"
          value={String(stats.paidCount)}
        />
        <StatCard
          icon={<FiAlertTriangle className="size-4" />}
          tone="red"
          label="DUE INVOICES"
          value={String(stats.dueCount)}
        />
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 mb-5 rounded-xl border border-gray-200 dark:border-white/5 bg-white dark:bg-white/3 p-2.5">
        <div className="relative flex-1 min-w-56">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-3 text-gray-400" />
          <input
            placeholder="Search by invoice number or customer…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-8 pr-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-700 dark:text-gray-100 outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
          />
        </div>

        <FilterSelect value={statusFilter} onChange={setStatusFilter} label="All Status">
          <option value="paid">Paid</option>
          <option value="partial">Partial</option>
          <option value="due">Due</option>
        </FilterSelect>

        {/* A single fixed salesType needs no filter, but a comma-separated list
            holds more than one kind, so offer those as filter options. */}
        {allowedTypes.length !== 1 && (
          <FilterSelect value={typeFilter} onChange={setTypeFilter} label="All Types">
            {Object.entries(salesTypeLabel)
              .filter(([v]) => allowedTypes.length === 0 || allowedTypes.includes(v))
              .map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
          </FilterSelect>
        )}

        <FilterSelect value={paymentFilter} onChange={setPaymentFilter} label="All Payments">
          {accountOptions.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </FilterSelect>

        {/* Shown when the page can hold more than one invoice status. A page
            pinned to a single status (the draft list) needs no such filter, but
            one that merely opens on a default still does — otherwise the rows
            outside that default would be unreachable. */}
        {(invoiceStatusOptions.length > 1 || Boolean(defaultInvoiceStatus)) && (
          <FilterSelect
            value={invoiceStatusFilter}
            onChange={setInvoiceStatusFilter}
            label="All Invoices"
          >
            {invoiceStatusOptions.map((st) => (
              <option key={st} value={st}>
                {st.charAt(0).toUpperCase() + st.slice(1)}
              </option>
            ))}
          </FilterSelect>
        )}

        {hasFilters && (
          <button
            onClick={clearFilters}
            title="Clear filters"
            className="size-9 flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 text-gray-400 hover:text-red-500 hover:border-red-300 transition-colors"
          >
            <FaTimes className="size-3" />
          </button>
        )}
      </div>

      {hasFilters && (
        <p className="text-xs text-gray-400 mb-2">
          Showing {filtered.length} of {salesList.length} sales
        </p>
      )}

      {isMobile ? (
        <MobileCardList
          items={filtered}
          getKey={(sale) => sale._id}
          emptyMessage="No sales found"
          renderCard={(sale) => (
            <div className="space-y-1">
              <div className="mb-2 flex items-start justify-between gap-3 border-b border-gray-100 pb-2 dark:border-white/[0.05]">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-blue-600">
                    {sale.invoiceNumber}
                  </p>
                  <p className="text-xs text-gray-400">
                    {formatDate(sale.date)} · {formatTime(sale.createdAt)}
                  </p>
                </div>
                <ActionMenu
                  canEdit={canEdit}
                  canDelete={canDelete}
                  onView={() =>
                    navigate(`/sales-view/${encodeURIComponent(sale.invoiceNumber)}`)
                  }
                  onInvoice={() =>
                    navigate(`/sales-invoice-print/${encodeURIComponent(sale.invoiceNumber)}`)
                  }
                  onEdit={() =>
                    navigate(`/sales-edit/${encodeURIComponent(sale.invoiceNumber)}`)
                  }
                  onChallan={() =>
                    navigate(`/sales-challan-print/${encodeURIComponent(sale.invoiceNumber)}`)
                  }
                  onReceipt={() =>
                    navigate(`/sales-receipt-print/${encodeURIComponent(sale.invoiceNumber)}`)
                  }
                  onDelete={() => handleDeleteModal(sale._id)}
                />
              </div>
              <MobileCardRow label="Customer">
                {getCustomerName(sale.customerType)}
              </MobileCardRow>
              <MobileCardRow label="Mobile">
                {getMobile(sale.customerType)}
              </MobileCardRow>
              <MobileCardRow label="Payable">
                {money(sale.payable)}
              </MobileCardRow>
              <MobileCardRow label="Due">{money(sale.presentDue)}</MobileCardRow>
            </div>
          )}
        />
      ) : (
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/5 dark:bg-white/3">
        <div className="max-w-full overflow-x-auto">
          <Table>
            <TableHeader className="border-b border-gray-100 dark:border-white/5">
              <TableRow className="uppercase">
                {[
                  "Invoice No",
                  "Date",
                  "Sales Type",
                  "Customer Type",
                  "Customer Name",
                  "Mobile",
                  "Payable",
                  "Paid",
                  "Due",
                  "Payment Status",
                  "Invoice Status",
                  "Actions",
                ].map((h) => (
                  <TableCell
                    key={h}
                    isHeader
                    className="px-5 py-3 font-medium text-gray-500 text-center text-theme-xs dark:text-gray-400 whitespace-nowrap"
                  >
                    {h}
                  </TableCell>
                ))}
              </TableRow>
            </TableHeader>

            <TableBody className="divide-y divide-gray-100 dark:divide-white/5">
              {loading && (
                <TableRow>
                  <TableCell colSpan={12} className="px-4 py-6 text-center text-gray-400 text-theme-sm">
                    Loading…
                  </TableCell>
                </TableRow>
              )}

              {!loading && isError && (
                <TableRow>
                  <TableCell colSpan={12} className="px-4 py-0">
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                      <div className="size-20 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center mb-6">
                        <svg className="size-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Failed to load sales</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mb-8">
                        We encountered a problem while trying to fetch sales records. Please try again.
                      </p>
                      <Button
                        onClick={fetchSales}
                        disabled={isSubmitting}
                          className="px-8 py-2.5 bg-[#D5F0E3] hover:bg-[#B8E4CF] text-[#0A6B43] rounded-xl font-semibold shadow-lg transition-all active:scale-95 disabled:active:scale-100"
                      >
                        {isSubmitting ? (
                          <span className="flex items-center justify-center gap-2">
                            <span className="size-4 animate-spin rounded-full border-2 border-[#0A6B43]/30 border-t-[#0A6B43]" />
                            Saving...
                          </span>
                        ) : (
                          "Try Again"
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}

              {!loading && !isError && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={12} className="px-4 py-0">
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                      <div className="size-20 rounded-full bg-gray-50 dark:bg-gray-800/50 flex items-center justify-center mb-6">
                        <svg className="size-9 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
                        No Sales Records Found
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mb-8">
                        {search
                          ? <>No results for <span className="font-bold text-brand-500">"{search}"</span>. Try a different search term.</>
                          : salesList.length > 0
                            ? "No sales match the current filters."
                            : "No sales have been recorded yet."}
                      </p>
                      {search && (
                        <Button
                          onClick={() => setSearch("")}
                          variant="outline"
                          className="rounded-xl px-8 py-2.5 text-sm font-semibold"
                        >
                          Clear Search
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )}

              {!loading && !isError &&
                filtered.map((sale) => (
                  <TableRow key={sale._id} className="dark:text-gray-400">
                    <TableCell className="px-4 py-3 text-theme-sm font-semibold text-blue-600 text-center">
                      {sale.invoiceNumber}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-theme-sm whitespace-nowrap text-center">
                      <div>{formatDate(sale.date)}</div>
                      <div className="text-[11px] text-gray-400 dark:text-gray-500">
                        {formatTime(sale.createdAt)}
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-theme-sm capitalize text-center">
                      {sale.salesType}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-theme-sm capitalize text-center">
                      {sale.customerType?.type}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-theme-sm text-center">
                      {getCustomerName(sale.customerType)}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-theme-sm text-center">
                      {getMobile(sale.customerType)}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-theme-sm text-center">
                      ৳{sale.payable?.toLocaleString()}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-theme-sm text-center">
                      ৳{sale.paid?.toLocaleString()}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-theme-sm text-center">
                      ৳{sale.presentDue?.toLocaleString()}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-theme-sm text-center">
                      <StatusBadge value={sale.paymentStatus} />
                    </TableCell>
                    <TableCell className="px-4 py-3 text-theme-sm text-center">
                      <StatusBadge value={sale.invoiceStatus} />
                    </TableCell>
                    <TableCell className="px-4 py-3 text-theme-sm text-center">
                      <ActionMenu
                        canEdit={canEdit}
                        canDelete={canDelete}
                        onView={() =>
                          navigate(`/sales-view/${encodeURIComponent(sale.invoiceNumber)}`)
                        }
                        onInvoice={() =>
                          navigate(`/sales-invoice-print/${encodeURIComponent(sale.invoiceNumber)}`)
                        }
                        onEdit={() =>
                          navigate(`/sales-edit/${encodeURIComponent(sale.invoiceNumber)}`)
                        }
                        onChallan={() =>
                          navigate(`/sales-challan-print/${encodeURIComponent(sale.invoiceNumber)}`)
                        }
                        onReceipt={() =>
                          navigate(`/sales-receipt-print/${encodeURIComponent(sale.invoiceNumber)}`)
                        }
                        onDelete={() => handleDeleteModal(sale._id)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      </div>
      )}
      <Modal isOpen={showDeleteModal} onClose={closeModal}>
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <h2 className="text-lg font-bold">Confirm Deletion</h2>
          <p className="mt-2 text-gray-600">
            Are you sure you want to delete this sale?
          </p>
          <div className="flex justify-end mt-4 gap-x-2">
            <Button onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="size-4 animate-spin rounded-full border-2 border-[#0A6B43]/30 border-t-[#0A6B43]" />
                  Deleting...
                </span>
              ) : (
                "Yes"
              )}
            </Button>
            <Button
              onClick={closeModal}
                className="bg-[#D5F0E3] text-[#0A6B43] hover:bg-[#B8E4CF]"
            >
              No
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default SalesHistoryTable;
