import { useState } from "react";
import { Link } from "react-router";
import axios from "axios";
import {
  FiRefreshCw,
  FiAlertTriangle,
  FiPackage,
  FiShoppingBag,
  FiFileText,
  FiCreditCard,
  FiArrowDownCircle,
  FiArrowUpCircle,
  FiTruck,
  FiCheckSquare,
  FiUserCheck,
} from "react-icons/fi";
import { GroupIcon, BoxIconLine } from "../../../icons";
import {
  useDashboard,
  useInvoiceStats,
  useSalesSummary,
  useTransactionSummary,
  useInventorySummary,
  useCustomerSummary,
  useSupplierSummary,
  useEmployeeSummary,
  usePurchaseSummary,
  useSoldItemsSummary,
  useInventoryValueSummary,
  useStockCostSummary,
  useProductStatusSummary,
  useSupplierPaymentSummary,
  useCustomerDuePaymentSummary,
  useInflowTransactionSummary,
  useOutflowTransactionSummary,
  useTopSellingProducts,
  type TopSellingMonths,
  useDayCashSummary,
  useAccountsBalanceSummary,
  DashboardRange,
  type DailyPoint,
  formatCurrency,
  formatCurrencyExact,
  formatCompact,
  formatNumber,
} from "./useDashboard";
import { useAuth } from "../../../context/AuthContext";
import {
  PERMISSIONS,
  DASHBOARD_BOX_MODULES,
} from "../../../config/permissions";
import KpiCard from "./KpiCard";
import RangeSelector from "./RangeSelector";
import WelcomeBar from "./WelcomeBar";
import RevenueTrendChart from "./RevenueTrendChart";
import SalesTypeDonut from "./SalesTypeDonut";
import TopProductsChart from "./TopProductsChart";
import PushSellingProducts from "./PushSellingProducts";

// Why the overview failed, in words the user can act on
const loadErrorText = (error: unknown, rangeLabel: string) => {
  const status = axios.isAxiosError(error) ? error.response?.status : undefined;
  if (status === 429) {
    return {
      title: "Too many requests",
      body: "The dashboard was reloaded too often in a short time. Wait about a minute, then try again.",
    };
  }
  if (status === 403) {
    return {
      title: "No access to the dashboard summary",
      body: "Your role cannot view this data. Ask the store owner to give you the dashboard permission.",
    };
  }
  if (axios.isAxiosError(error) && !error.response) {
    return {
      title: "Cannot reach the server",
      body: "Check your internet connection, then try again.",
    };
  }
  return {
    title: `Could not load data for ${rangeLabel}`,
    body: "Something went wrong on the server while preparing this period. Try again, or pick a shorter period.",
  };
};

const DashboardLoadError = ({
  error,
  rangeLabel,
  retrying,
  onRetry,
  onShowDefault,
}: {
  error: unknown;
  rangeLabel: string;
  retrying: boolean;
  onRetry: () => void;
  onShowDefault?: () => void;
}) => {
  const { title, body } = loadErrorText(error, rangeLabel);
  return (
    <div
      role="alert"
      className="flex flex-col items-center rounded-2xl border border-gray-200 bg-white px-6 py-14 text-center dark:border-gray-800 dark:bg-white/[0.03]"
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-400">
        <FiAlertTriangle className="size-6" aria-hidden />
      </span>
      <h3 className="mt-4 text-base font-semibold text-gray-800 dark:text-white/90">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-gray-500 dark:text-gray-400">{body}</p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className="shine inline-flex items-center gap-2 rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-600 disabled:opacity-60"
        >
          <FiRefreshCw className={`size-4 ${retrying ? "animate-spin" : ""}`} aria-hidden />
          {retrying ? "Trying…" : "Try again"}
        </button>
        {onShowDefault && (
          <button
            type="button"
            onClick={onShowDefault}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
          >
            Show last 30 days
          </button>
        )}
      </div>
    </div>
  );
};

// Five boxes a row on a desktop. On narrower screens the last box takes up the
// space left in its row, so no row ends in a hole.
const KPI_GRID =
  "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 sm:max-lg:[&>*:last-child:nth-child(odd)]:col-span-2 lg:max-xl:[&>*:last-child:nth-child(3n+2)]:col-span-2 lg:max-xl:[&>*:last-child:nth-child(3n+1)]:col-span-3";

const RANGE_LABEL: Record<DashboardRange, string> = {
  today: "today",
  "7d": "last 7 days",
  "30d": "last 30 days",
  "90d": "last 90 days",
  "12m": "last 12 months",
  all: "all time",
};

const paymentBadge = (status: string) => {
  switch (status) {
    case "paid":
      return "bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-400";
    case "partial":
      return "bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-400";
    default:
      return "bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-400";
  }
};

const Card = ({
  title,
  action,
  children,
  className = "",
}: {
  title?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) => (
  <div
    className={`rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] ${className}`}
  >
    {(title || action) && (
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        {typeof title === "string" ? (
          <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">
            {title}
          </h3>
        ) : (
          title
        )}
        {action}
      </div>
    )}
    {children}
  </div>
);

type SalesProgressRange = Extract<DashboardRange, "7d" | "30d" | "90d">;

const SALES_PROGRESS_RANGES: { value: SalesProgressRange; label: string; title: string }[] = [
  { value: "7d", label: "1 Week", title: "Last 7 days" },
  { value: "30d", label: "1 Month", title: "Last 30 days" },
  { value: "90d", label: "3 Months", title: "Last 90 days" },
];

const SALES_PROGRESS_DAYS: Record<SalesProgressRange, number> = { "7d": 7, "30d": 30, "90d": 90 };

// The API only returns days that had sales; fill the rest of the window with
// zeros so a quiet day shows as a dip instead of vanishing from the axis.
// Keys are UTC dates, matching the backend's $dateToString grouping.
const fillDailySeries = (series: DailyPoint[], days: number): DailyPoint[] => {
  const byDate = new Map(series.map((p) => [p.date, p]));
  const today = new Date();
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - (days - 1 - i));
    const date = d.toISOString().slice(0, 10);
    return byDate.get(date) ?? { date, revenue: 0, orders: 0 };
  });
};

export default function InteractiveDashboard() {
  const { can, isSuperAdmin, isLoading: isAuthLoading } = useAuth();
  const [range, setRange] = useState<DashboardRange>("today");
  const [topMonths, setTopMonths] = useState<TopSellingMonths>(1);
  const { data: topSelling, isLoading: isTopSellingLoading } =
    useTopSellingProducts(topMonths);

  const { data, isLoading, isFetching, isError, error, refetch } = useDashboard(range);
  // Sales Progress chart keeps its own window (default last 7 days) so the
  // dashboard's "today" range does not collapse it to a single point.
  const [trendRange, setTrendRange] = useState<SalesProgressRange>("7d");
  const {
    data: trendData,
    isLoading: isTrendLoading,
    isFetching: isTrendFetching,
    refetch: refetchTrend,
  } = useDashboard(trendRange);
  const {
    data: invoiceStats,
    isLoading: isInvoiceLoading,
    isFetching: isInvoiceFetching,
    refetch: refetchInvoices,
  } = useInvoiceStats(range);
  const {
    data: salesSummaryData,
    isLoading: isSalesSummaryLoading,
    isFetching: isSalesSummaryFetching,
    refetch: refetchSalesSummary,
  } = useSalesSummary(range);
  const {
    // Kept for the "Refresh all" button: the Total Transaction box now reads
    // the Inflow/Outflow feeds instead of this endpoint's own figures.
    isFetching: isTransactionSummaryFetching,
    refetch: refetchTransactionSummary,
  } = useTransactionSummary(range);
  const {
    data: inventorySummaryData,
    isLoading: isInventorySummaryLoading,
    isFetching: isInventorySummaryFetching,
    refetch: refetchInventorySummary,
  } = useInventorySummary(range);
  // Customer/Supplier/Employee counts are always all-time — they don't need
  // a range filter, so "all" is passed regardless of the selected range.
  const {
    data: customerSummaryData,
    isLoading: isCustomerSummaryLoading,
    isFetching: isCustomerSummaryFetching,
    refetch: refetchCustomerSummary,
  } = useCustomerSummary("all");
  const {
    data: supplierSummaryData,
    isLoading: isSupplierSummaryLoading,
    isFetching: isSupplierSummaryFetching,
    refetch: refetchSupplierSummary,
  } = useSupplierSummary("all");
  const {
    data: employeeSummaryData,
    isLoading: isEmployeeSummaryLoading,
    isFetching: isEmployeeSummaryFetching,
    refetch: refetchEmployeeSummary,
  } = useEmployeeSummary("all");
  const {
    data: purchaseSummaryData,
    isLoading: isPurchaseSummaryLoading,
    isFetching: isPurchaseSummaryFetching,
    refetch: refetchPurchaseSummary,
  } = usePurchaseSummary(range);
  const {
    data: soldItemsSummaryData,
    isLoading: isSoldItemsSummaryLoading,
    isFetching: isSoldItemsSummaryFetching,
    refetch: refetchSoldItemsSummary,
  } = useSoldItemsSummary(range);
  const {
    data: inventoryValueSummaryData,
    isLoading: isInventoryValueSummaryLoading,
    isFetching: isInventoryValueSummaryFetching,
    refetch: refetchInventoryValueSummary,
  } = useInventoryValueSummary(range);
  const {
    data: stockCostSummaryData,
    isLoading: isStockCostSummaryLoading,
    isFetching: isStockCostSummaryFetching,
    refetch: refetchStockCostSummary,
  } = useStockCostSummary(range);
  const {
    data: productStatusSummaryData,
    isLoading: isProductStatusSummaryLoading,
    isFetching: isProductStatusSummaryFetching,
    refetch: refetchProductStatusSummary,
  } = useProductStatusSummary(range);
  const {
    data: supplierPaymentSummaryData,
    isLoading: isSupplierPaymentSummaryLoading,
    isFetching: isSupplierPaymentSummaryFetching,
    refetch: refetchSupplierPaymentSummary,
  } = useSupplierPaymentSummary(range);
  const {
    data: customerDuePaymentSummaryData,
    isLoading: isCustomerDuePaymentSummaryLoading,
    isFetching: isCustomerDuePaymentSummaryFetching,
    refetch: refetchCustomerDuePaymentSummary,
  } = useCustomerDuePaymentSummary(range);
  const {
    data: inflowTransactionSummaryData,
    isLoading: isInflowTransactionSummaryLoading,
    isFetching: isInflowTransactionSummaryFetching,
    refetch: refetchInflowTransactionSummary,
  } = useInflowTransactionSummary(range);
  const {
    data: outflowTransactionSummaryData,
    isLoading: isOutflowTransactionSummaryLoading,
    isFetching: isOutflowTransactionSummaryFetching,
    refetch: refetchOutflowTransactionSummary,
  } = useOutflowTransactionSummary(range);
  const {
    data: dayCashSummaryData,
    isLoading: isDayCashSummaryLoading,
    refetch: refetchDayCashSummary,
  } = useDayCashSummary();
  const {
    data: accountsBalanceSummaryData,
    isLoading: isAccountsBalanceSummaryLoading,
    refetch: refetchAccountsBalanceSummary,
  } = useAccountsBalanceSummary();

  const inv = invoiceStats?.invoices;
  const salesSummary = salesSummaryData?.sales;
  const inventorySummary = inventorySummaryData?.inventory;
  const customerSummary = customerSummaryData?.customer;
  const supplierSummary = supplierSummaryData?.supplier;
  const employeeSummary = employeeSummaryData?.employee;
  const purchaseSummary = purchaseSummaryData?.purchase;
  const soldItemsSummary = soldItemsSummaryData?.soldItems;
  const inventoryValueSummary = inventoryValueSummaryData?.inventoryValue;
  const stockCostSummary = stockCostSummaryData?.stockCost;
  const acc = data?.accountsBalance;
  const productStatus = productStatusSummaryData?.productStatus;
  const supplierPayment = supplierPaymentSummaryData?.supplierPayment;
  const customerDuePayment = customerDuePaymentSummaryData?.customerDuePayment;
  const inflowTransactionSummary = inflowTransactionSummaryData;
  const outflowTransactionSummary = outflowTransactionSummaryData;

  // The Total Transaction box reads the same two feeds shown further down the
  // page, so the headline figure always matches the Inflow and Outflow grand
  // totals a user can scroll to and check. Its own endpoint counted a
  // different set of sources and disagreed with them.
  const totalTransactionReceived = inflowTransactionSummary?.grandTotal ?? 0;
  const totalTransactionPaid = outflowTransactionSummary?.grandTotal ?? 0;
  const totalTransactionBalance = totalTransactionReceived - totalTransactionPaid;

  // Each box is gated by its own permission. Superadmin sees everything;
  // anyone else sees only the boxes explicitly granted to them.
  const showBox = (module: string): boolean => {
    if (isAuthLoading) return false;
    if (isSuperAdmin) return true;
    return can(module, "view");
  };


  const hasAnyBox = DASHBOARD_BOX_MODULES.some((m) => showBox(m));

  if (isAuthLoading) {
    return (
      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <div className="h-6 w-40 animate-pulse rounded-lg bg-gray-100 dark:bg-white/[0.03]" />
            <div className="h-4 w-56 animate-pulse rounded-lg bg-gray-100 dark:bg-white/[0.03]" />
          </div>
          <div className="h-9 w-48 animate-pulse rounded-xl bg-gray-100 dark:bg-white/[0.03]" />
        </div>
        <div className={KPI_GRID}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-[168px] animate-pulse rounded-2xl bg-gray-100 dark:bg-white/[0.03]"
            />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="h-[320px] animate-pulse rounded-2xl bg-gray-100 dark:bg-white/[0.03]"
            />
          ))}
        </div>
      </div>
    );
  }

  if (!hasAnyBox) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white px-6 py-16 text-center dark:border-gray-800 dark:bg-gray-900">
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
          No dashboard widgets have been assigned to your account.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Header: welcome, quick actions, period and refresh ── */}
      <WelcomeBar
        subtitle={`Performance for ${RANGE_LABEL[range]}`}
        toolbar={
          <>
            <RangeSelector value={range} onChange={setRange} />
            <button
              onClick={() =>
                Promise.all([
                  refetch(),
                  refetchTrend(),
                  refetchInvoices(),
                  refetchSalesSummary(),
                  refetchTransactionSummary(),
                  refetchInventorySummary(),
                  refetchCustomerSummary(),
                  refetchSupplierSummary(),
                  refetchEmployeeSummary(),
                  refetchPurchaseSummary(),
                  refetchSoldItemsSummary(),
                  refetchInventoryValueSummary(),
                  refetchStockCostSummary(),
                  refetchProductStatusSummary(),
                  refetchSupplierPaymentSummary(),
                  refetchCustomerDuePaymentSummary(),
                  refetchInflowTransactionSummary(),
                  refetchOutflowTransactionSummary(),
                  refetchDayCashSummary(),
                  refetchAccountsBalanceSummary(),
                ])
              }
              disabled={
                isFetching ||
                isTrendFetching ||
                isInvoiceFetching ||
                isSalesSummaryFetching ||
                isTransactionSummaryFetching ||
                isInventorySummaryFetching ||
                isCustomerSummaryFetching ||
                isSupplierSummaryFetching ||
                isEmployeeSummaryFetching ||
                isPurchaseSummaryFetching ||
                isSoldItemsSummaryFetching ||
                isInventoryValueSummaryFetching ||
                isStockCostSummaryFetching ||
                isProductStatusSummaryFetching ||
                isSupplierPaymentSummaryFetching ||
                isCustomerDuePaymentSummaryFetching ||
                isInflowTransactionSummaryFetching ||
                isOutflowTransactionSummaryFetching
              }
              title="Refresh"
              aria-label="Refresh"
              className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-accent-100 bg-white text-accent-600 shadow-theme-xs transition-all hover:-translate-y-0.5 hover:bg-accent-50 active:translate-y-0 disabled:opacity-40 dark:border-accent-500/20 dark:bg-white/[0.03] dark:text-accent-400 dark:hover:bg-accent-500/15"
            >
              <FiRefreshCw
                size={15}
                className={
                  isFetching ||
                  isTrendFetching ||
                  isInvoiceFetching ||
                  isSalesSummaryFetching ||
                  isTransactionSummaryFetching ||
                  isInventorySummaryFetching ||
                  isCustomerSummaryFetching ||
                  isSupplierSummaryFetching ||
                  isEmployeeSummaryFetching ||
                  isPurchaseSummaryFetching ||
                  isSoldItemsSummaryFetching ||
                  isInventoryValueSummaryFetching ||
                  isStockCostSummaryFetching ||
                  isProductStatusSummaryFetching ||
                  isSupplierPaymentSummaryFetching ||
                  isCustomerDuePaymentSummaryFetching ||
                  isInflowTransactionSummaryFetching ||
                  isOutflowTransactionSummaryFetching
                    ? "animate-spin"
                    : ""
                }
              />
            </button>
          </>
        }
      />

      {isError ? (
        <DashboardLoadError
          error={error}
          rangeLabel={RANGE_LABEL[range]}
          retrying={isFetching}
          onRetry={() => refetch()}
          onShowDefault={range === "30d" ? undefined : () => setRange("30d")}
        />
      ) : (
        <>
          {/* ── Row 1 — Invoices / Sale / Transaction / Accounts / Inventory ── */}
          <div className={KPI_GRID}>
            {showBox(PERMISSIONS.DASHBOARD_TOTAL_INVOICES) && (
              <KpiCard
                title="Total Invoices"
                value={formatNumber(inv?.total ?? 0)}
                icon={<FiFileText className="size-5" />}
                iconAccent="brand"
                loading={isInvoiceLoading}
                stats={[
                  { label: "Complete", value: formatNumber(inv?.complete ?? 0), color: "success" },
                  { label: "Pending", value: formatNumber(inv?.pending ?? 0), color: "warning" },
                  { label: "Draft", value: formatNumber(inv?.draft ?? 0) },
                ]}
                progressSegments={[
                  { label: "Complete", value: inv?.complete ?? 0, color: "success" },
                  { label: "Pending", value: inv?.pending ?? 0, color: "warning" },
                  { label: "Draft", value: inv?.draft ?? 0, color: "default" },
                ]}
              />
            )}
            {showBox(PERMISSIONS.DASHBOARD_TOTAL_SALE) && (
              <KpiCard
                title="Total Sale"
                value={formatCurrency(salesSummary?.total ?? 0)}
                icon={<FiShoppingBag className="size-5" />}
                iconAccent="success"
                loading={isSalesSummaryLoading}
                stats={[
                  { label: "Receive", value: formatCurrency(salesSummary?.received ?? 0), color: "success" },
                  { label: "Due", value: formatCurrency(salesSummary?.due ?? 0), color: "error" },
                  // Exact formatter: profit carries 2 decimals from the API, and
                  // formatCurrency would drop them (1137.50 -> "1,137.5").
                  { label: "Profit", value: formatCurrencyExact(salesSummary?.profit ?? 0) },
                ]}
                progressSegments={[
                  { label: "Receive", value: salesSummary?.received ?? 0, color: "success" },
                  { label: "Due", value: salesSummary?.due ?? 0, color: "error" },
                  { label: "Profit", value: Math.max(salesSummary?.profit ?? 0, 0), color: "default" },
                ]}
              />
            )}
            {showBox(PERMISSIONS.DASHBOARD_TOTAL_TRANSACTION) && (
              <KpiCard
                title="Total Transaction"
                value={formatCurrencyExact(totalTransactionReceived)}
                icon={<FiCreditCard className="size-5" />}
                iconAccent="orange"
                loading={isInflowTransactionSummaryLoading || isOutflowTransactionSummaryLoading}
                stats={[
                  { label: "Total Payment", value: formatCurrencyExact(totalTransactionPaid) },
                  { label: "Total Balance", value: formatCurrencyExact(totalTransactionBalance) },
                ]}
                progressSegments={[
                  { label: "Total Payment", value: totalTransactionPaid, color: "warning" },
                  { label: "Total Balance", value: Math.max(totalTransactionBalance, 0), color: "success" },
                ]}
              />
            )}
            {showBox(PERMISSIONS.DASHBOARD_ACCOUNTS_BALANCE) && (
              <KpiCard
                title="Accounts Balance"
                value={formatCurrency(acc?.balance ?? 0)}
                icon={<FiCreditCard className="size-5" />}
                iconAccent="purple"
                loading={isLoading}
                stats={[
                  { label: "Payable", value: formatCurrency(acc?.payable ?? 0), color: "error" },
                  { label: "Receivable", value: formatCurrency(acc?.receivable ?? 0), color: "success" },
                ]}
              />
            )}
            {showBox(PERMISSIONS.DASHBOARD_INVENTORY_ITEMS) && (
              <KpiCard
                title="Inventory Items"
                value={formatNumber(inventorySummary?.totalStock ?? 0)}
                icon={<BoxIconLine className="size-5" />}
                iconAccent="teal"
                loading={isInventorySummaryLoading}
                stats={[
                  { label: "In Stock", value: formatNumber(inventorySummary?.inStock ?? 0), color: "success" },
                  { label: "Stock Out", value: formatNumber(inventorySummary?.stockOut ?? 0), color: "error" },
                  { label: "Low Stock", value: formatNumber(inventorySummary?.lowStockItems ?? 0), color: "warning" },
                ]}
                progressSegments={[
                  { label: "In Stock", value: inventorySummary?.inStock ?? 0, color: "success" },
                  { label: "Stock Out", value: inventorySummary?.stockOut ?? 0, color: "error" },
                ]}
              />
            )}
          </div>

          {/* ── Row 2 — Employee / Supplier / Supplier pay / Customer / Customer due ── */}
          <div className={KPI_GRID}>
            {showBox(PERMISSIONS.DASHBOARD_EMPLOYEE) && (
              <KpiCard
                title="Employee"
                value={formatNumber(employeeSummary?.totalEmployee ?? 0)}
                icon={<FiUserCheck className="size-5" />}
                iconAccent="brand"
                loading={isEmployeeSummaryLoading}
                stats={[
                  { label: "Advance Payment", value: formatCurrency(employeeSummary?.advancePayment ?? 0) },
                ]}
              />
            )}

            {showBox(PERMISSIONS.DASHBOARD_SUPPLIER) && (
              <KpiCard
                title="Supplier"
                value={formatNumber(supplierSummary?.totalSupplier ?? 0)}
                icon={<FiTruck className="size-5" />}
                iconAccent="warning"
                loading={isSupplierSummaryLoading}
                stats={[
                  { label: "Total Due Balance", value: formatCurrency(supplierSummary?.totalDue ?? 0), color: "error" },
                ]}
              />
            )}

            {showBox(PERMISSIONS.DASHBOARD_SUPPLIER_PAYMENT) && (
              <KpiCard
                title="Supplier Payment"
                value={formatCurrencyExact(supplierPayment?.paid ?? 0)}
                icon={<FiArrowUpCircle className="size-5" />}
                iconAccent="error"
                loading={isSupplierPaymentSummaryLoading}
                stats={[
                  { label: "Invoices", value: formatNumber(supplierPayment?.invoiceCount ?? 0) },
                  { label: "Paid", value: formatCurrencyExact(supplierPayment?.paid ?? 0), color: "success" },
                  { label: "Less", value: formatCurrencyExact(supplierPayment?.less ?? 0), color: "error" },
                ]}
              />
            )}

            {showBox(PERMISSIONS.DASHBOARD_CUSTOMER) && (
              <KpiCard
                title="Customer"
                value={formatNumber(customerSummary?.totalCustomer ?? 0)}
                icon={<GroupIcon className="size-5" />}
                iconAccent="pink"
                loading={isCustomerSummaryLoading}
                stats={[
                  { label: "Total Due Balance", value: formatCurrency(customerSummary?.totalDue ?? 0), color: "error" },
                ]}
              />
            )}

            {showBox(PERMISSIONS.DASHBOARD_CUSTOMER_DUE_PAYMENT) && (
              <KpiCard
                title="Customer Due Payment"
                value={formatCurrencyExact(customerDuePayment?.amount ?? 0)}
                icon={<FiArrowDownCircle className="size-5" />}
                iconAccent="success"
                loading={isCustomerDuePaymentSummaryLoading}
                stats={[
                  { label: "Transactions", value: formatNumber(customerDuePayment?.count ?? 0) },
                ]}
              />
            )}
          </div>

          {/* ── Row 3 — Purchase / Sold / Inventory value / Stock cost / Products ── */}
          <div className={KPI_GRID}>
            {showBox(PERMISSIONS.DASHBOARD_PURCHASE_ITEMS) && (
              <KpiCard
                title="Purchase Items"
                value={formatNumber(purchaseSummary?.quantity ?? 0)}
                icon={<FiPackage className="size-5" />}
                iconAccent="success"
                loading={isPurchaseSummaryLoading}
                stats={[
                  { label: "Invoices", value: formatNumber(purchaseSummary?.invoiceCount ?? 0) },
                  { label: "Payable", value: formatCurrency(purchaseSummary?.payable ?? 0) },
                  { label: "Paid", value: formatCurrency(purchaseSummary?.paid ?? 0), color: "success" },
                ]}
              />
            )}

            {showBox(PERMISSIONS.DASHBOARD_SOLD_ITEMS) && (
              <KpiCard
                title="Sold Items"
                value={formatNumber(soldItemsSummary?.quantity ?? 0)}
                icon={<FiCheckSquare className="size-5" />}
                iconAccent="orange"
                loading={isSoldItemsSummaryLoading}
                stats={[
                  { label: "Invoices", value: formatNumber(soldItemsSummary?.invoiceCount ?? 0) },
                  { label: "Total Sales", value: formatCurrency(soldItemsSummary?.totalAmount ?? 0), color: "success" },
                  { label: "Retail", value: formatCurrency(soldItemsSummary?.retailAmount ?? 0), color: "success" },
                  { label: "Wholesale", value: formatCurrency(soldItemsSummary?.wholesaleAmount ?? 0), color: "success" },
                ]}
              />
            )}

            {showBox(PERMISSIONS.DASHBOARD_INVENTORY_VALUE) && (
              <KpiCard
                title="Inventory Items"
                value={`${formatNumber(inventoryValueSummary?.units ?? 0)} PCS`}
                icon={<BoxIconLine className="size-5" />}
                iconAccent="purple"
                loading={isInventoryValueSummaryLoading}
                stats={[
                  { label: "Retail Value", value: formatCurrency(inventoryValueSummary?.retailValue ?? 0) },
                  { label: "Wholesale Value", value: formatCurrency(inventoryValueSummary?.wholesaleValue ?? 0) },
                ]}
              />
            )}

            {showBox(PERMISSIONS.DASHBOARD_STOCK_COST_VALUE) && (
              <KpiCard
                title="Stock Cost Value"
                value={formatCurrencyExact(stockCostSummary?.costValue ?? 0)}
                icon={<FiPackage className="size-5" />}
                iconAccent="teal"
                loading={isStockCostSummaryLoading}
                stats={[{ label: "At Purchase Price", value: formatCurrencyExact(stockCostSummary?.costValue ?? 0) }]}
              />
            )}

            {showBox(PERMISSIONS.DASHBOARD_TOTAL_PRODUCTS) && (
              <KpiCard
                title="Total Products"
                value={formatNumber(productStatus?.totalStock ?? 0)}
                icon={<BoxIconLine className="size-5" />}
                iconAccent="pink"
                loading={isProductStatusSummaryLoading}
                stats={[
                  { label: "Active", value: formatNumber(productStatus?.active ?? 0), color: "success" },
                  { label: "Inactive", value: formatNumber(productStatus?.inactive ?? 0), color: "error" },
                ]}
              />
            )}
          </div>

          {/* ── Sales progress ── */}
          {showBox(PERMISSIONS.DASHBOARD_REVENUE_TREND) && (
            <Card
              title="Sales Progress"
              action={
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-500 dark:bg-brand-500/15 dark:text-brand-400">
                    {formatCurrency(trendData?.kpis?.revenue ?? 0)}
                  </span>
                  <div className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white p-1 dark:border-gray-800 dark:bg-white/[0.03]">
                    {SALES_PROGRESS_RANGES.map((r) => (
                      <button
                        key={r.value}
                        onClick={() => setTrendRange(r.value)}
                        title={r.title}
                        className={`whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors sm:px-3 ${
                          trendRange === r.value
                            ? "bg-brand-500 text-white shadow-sm"
                            : "text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/[0.06]"
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>
              }
            >
              {isTrendLoading ? (
                <div className="h-[320px] animate-pulse rounded-xl bg-gray-50 dark:bg-white/[0.02]" />
              ) : (
                <RevenueTrendChart
                  series={fillDailySeries(trendData?.dailySeries ?? [], SALES_PROGRESS_DAYS[trendRange])}
                />
              )}
            </Card>
          )}

          {/* ── Recent sales + Sales by type ── */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {showBox(PERMISSIONS.DASHBOARD_RECENT_SALES) && (
              <Card
                title="Recent Sales"
                action={
                  <Link
                    to="/sales-history"
                    className="text-xs font-semibold text-brand-500 hover:underline"
                  >
                    View all
                  </Link>
                }
              >
                {isLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div
                        key={i}
                        className="h-11 animate-pulse rounded-lg bg-gray-50 dark:bg-white/[0.02]"
                      />
                    ))}
                  </div>
                ) : (data?.recentSales ?? []).length === 0 ? (
                  <p className="py-10 text-center text-sm text-gray-400">
                    No recent sales.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                          <th className="py-2 pr-3 font-medium">Invoice</th>
                          <th className="py-2 pr-3 font-medium">Customer</th>
                          <th className="py-2 pr-3 text-right font-medium">
                            Payable
                          </th>
                          <th className="py-2 pr-3 text-right font-medium">Paid</th>
                          <th className="py-2 pr-3 text-right font-medium">Due</th>
                          <th className="py-2 text-center font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(data?.recentSales ?? []).map((r) => (
                          <tr
                            key={r.invoiceNumber}
                            className="border-b border-gray-50 last:border-0 dark:border-gray-800/60"
                          >
                            <td className="py-2.5 pr-3 font-mono text-xs font-semibold text-gray-700 dark:text-gray-300">
                              {r.invoiceNumber}
                            </td>
                            <td className="max-w-[140px] truncate py-2.5 pr-3 text-gray-600 dark:text-gray-400">
                              {r.customerName}
                            </td>
                            <td className="py-2.5 pr-3 text-right font-semibold text-gray-800 dark:text-gray-200">
                              {formatCurrency(r.payable)}
                            </td>
                            <td className="py-2.5 pr-3 text-right font-medium text-success-600 dark:text-success-400">
                              {formatCurrency(r.paid)}
                            </td>
                            <td
                              className={`py-2.5 pr-3 text-right font-medium ${r.presentDue > 0
                                ? "text-error-500"
                                : "text-gray-400"
                                }`}
                            >
                              {formatCurrency(r.presentDue)}
                            </td>
                            <td className="py-2.5 text-center">
                              <span
                                className={`rounded-md px-2 py-0.5 text-[11px] font-semibold capitalize ${paymentBadge(
                                  r.paymentStatus,
                                )}`}
                              >
                                {r.paymentStatus}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            )}

            {showBox(PERMISSIONS.DASHBOARD_SALES_BY_TYPE) && (
              <Card title="Sales by Type">
                {isLoading ? (
                  <div className="h-[300px] animate-pulse rounded-xl bg-gray-50 dark:bg-white/[0.02]" />
                ) : (
                  <SalesTypeDonut data={data?.salesByType ?? []} />
                )}
              </Card>
            )}
          </div>

          {/* ── Top selling + Push selling ── */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {showBox(PERMISSIONS.DASHBOARD_TOP_SELLING_PRODUCTS) && (
              <Card
                title="Top Selling Products"
                action={
                  <div className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white p-1 dark:border-gray-800 dark:bg-white/[0.03]">
                    {([1, 2, 3] as TopSellingMonths[]).map((m) => (
                      <button
                        key={m}
                        onClick={() => setTopMonths(m)}
                        title={`Last ${m * 30} days`}
                        className={`whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors sm:px-3 ${
                          topMonths === m
                            ? "bg-brand-500 text-white shadow-sm"
                            : "text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/[0.06]"
                        }`}
                      >
                        {m} {m === 1 ? "Month" : "Months"}
                      </button>
                    ))}
                  </div>
                }
              >
                {isTopSellingLoading ? (
                  <div className="h-[300px] animate-pulse rounded-xl bg-gray-50 dark:bg-white/[0.02]" />
                ) : (
                  <TopProductsChart data={topSelling?.topProducts ?? []} />
                )}
              </Card>
            )}

            {showBox(PERMISSIONS.PUSH_SALES_PRODUCT_REPORT) && <PushSellingProducts />}
          </div>

          {/* ── Inflow / Outflow transactions ── */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {showBox(PERMISSIONS.DASHBOARD_INFLOW_TRANSACTIONS) && (
              <Card
                title={`Inflow Transactions (Received — ${RANGE_LABEL[range]})`}
                action={
                  <span className="flex items-center gap-1 rounded-lg bg-success-50 px-2 py-1 text-xs font-semibold text-success-600 dark:bg-success-500/15 dark:text-success-400">
                    <FiArrowDownCircle size={12} />
                    {formatCurrency(inflowTransactionSummary?.grandTotal ?? 0)}
                  </span>
                }
              >
                {isInflowTransactionSummaryLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="h-10 animate-pulse rounded-lg bg-gray-50 dark:bg-white/[0.02]" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Flat merged feed — sales invoices, customer due payments,
                        customer advance payments, and cash-received account
                        transactions, one list, no section headings/subtotals */}
                    <div className="max-h-96 divide-y divide-gray-50 overflow-y-auto rounded-lg border border-gray-100 dark:divide-gray-800/60 dark:border-gray-800">
                      {(inflowTransactionSummary?.salesInvoices ?? []).map((s, i) => (
                        <div
                          key={`sales-${s.invoiceNumber}-${i}`}
                          className="flex items-center justify-between px-3 py-2"
                        >
                          <p className="min-w-0 truncate text-sm text-gray-600 dark:text-gray-300">
                            <span className="font-semibold text-gray-800 dark:text-gray-100">
                              {s.invoiceNumber}
                            </span>
                            <span className="ml-2 capitalize">
                              Sales invoice of {s.customerName || "Walking Customer"}
                            </span>
                          </p>
                          <span className="ml-2 shrink-0 text-sm font-bold text-success-600 dark:text-success-400">
                            {formatCurrency(s.amount)}
                          </span>
                        </div>
                      ))}

                      {(inflowTransactionSummary?.customerDuePayments ?? []).map((p, i) => (
                        <div
                          key={`due-${p.paymentId}-${i}`}
                          className="flex items-center justify-between px-3 py-2"
                        >
                          <p className="min-w-0 truncate text-sm text-gray-600 dark:text-gray-300">
                            <span className="font-semibold text-gray-800 dark:text-gray-100">
                              {p.paymentId}
                            </span>
                            <span className="ml-2 capitalize">
                              Customer Due Payment Receive of {p.customerName || "Customer"}
                            </span>
                          </p>
                          <span className="ml-2 shrink-0 text-sm font-bold text-success-600 dark:text-success-400">
                            {formatCurrency(p.amount)}
                          </span>
                        </div>
                      ))}

                      {(inflowTransactionSummary?.customerAdvancePayments ?? []).map((p, i) => (
                        <div
                          key={`advance-${p.paymentId}-${i}`}
                          className="flex items-center justify-between px-3 py-2"
                        >
                          <p className="min-w-0 truncate text-sm text-gray-600 dark:text-gray-300">
                            <span className="font-semibold text-gray-800 dark:text-gray-100">
                              {p.paymentId}
                            </span>
                            <span className="ml-2 capitalize">
                              Customer Advance Payment of {p.customerName || "Customer"}
                            </span>
                          </p>
                          <span className="ml-2 shrink-0 text-sm font-bold text-success-600 dark:text-success-400">
                            {formatCurrency(p.amount)}
                          </span>
                        </div>
                      ))}

                      {(inflowTransactionSummary?.purchaseReturns ?? []).map((p, i) => (
                        <div
                          key={`purchase-return-${p.serial}-${i}`}
                          className="flex items-center justify-between px-3 py-2"
                        >
                          <p className="min-w-0 truncate text-sm text-gray-600 dark:text-gray-300">
                            <span className="font-semibold text-gray-800 dark:text-gray-100">
                              {p.serial || "—"}
                            </span>
                            <span className="ml-2 capitalize">
                              Purchase Return{p.supplierName ? ` of ${p.supplierName}` : ""}
                            </span>
                          </p>
                          <span className="ml-2 shrink-0 text-sm font-bold text-success-600 dark:text-success-400">
                            {formatCurrency(p.amount)}
                          </span>
                        </div>
                      ))}

                      {(inflowTransactionSummary?.accountTransactions ?? []).map((t, i) => (
                        <div
                          key={`cash-${t.transactionId}-${i}`}
                          className="flex items-center justify-between px-3 py-2"
                        >
                          <p className="min-w-0 truncate text-sm text-gray-600 dark:text-gray-300">
                            <span className="font-semibold text-gray-800 dark:text-gray-100">
                              {t.transactionId || "—"}
                            </span>
                            <span className="ml-2 capitalize">
                              {t.categoryName || t.description || "Cash Received"}
                            </span>
                          </p>
                          <span className="ml-2 shrink-0 text-sm font-bold text-success-600 dark:text-success-400">
                            {formatCurrency(t.amount)}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Grand total */}
                    <div className="flex items-center justify-between rounded-lg bg-success-50 px-3 py-2.5 dark:bg-success-500/10">
                      <span className="text-sm font-semibold text-success-700 dark:text-success-300">
                        Grand Total Inflow
                      </span>
                      <span className="text-base font-bold text-success-700 dark:text-success-300">
                        {formatCurrency(inflowTransactionSummary?.grandTotal ?? 0)}
                      </span>
                    </div>
                  </div>
                )}
              </Card>
            )}

            {showBox(PERMISSIONS.DASHBOARD_OUTFLOW_TRANSACTIONS) && (
              <Card
                title={`Outflow Transactions (Payment — ${RANGE_LABEL[range]})`}
                action={
                  <span className="flex items-center gap-1 rounded-lg bg-error-50 px-2 py-1 text-xs font-semibold text-error-600 dark:bg-error-500/15 dark:text-error-400">
                    <FiArrowUpCircle size={12} />
                    {formatCurrency(outflowTransactionSummary?.grandTotal ?? 0)}
                  </span>
                }
              >
                {isOutflowTransactionSummaryLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="h-10 animate-pulse rounded-lg bg-gray-50 dark:bg-white/[0.02]" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Flat merged feed — purchase payments, supplier due
                        payments, and cash-payment account transactions, one
                        list, no section headings/subtotals */}
                    <div className="max-h-96 divide-y divide-gray-50 overflow-y-auto rounded-lg border border-gray-100 dark:divide-gray-800/60 dark:border-gray-800">
                      {(outflowTransactionSummary?.purchasePayments ?? []).map((p, i) => (
                        <div
                          key={`purchase-${p.invoiceNumber}-${i}`}
                          className="flex items-center justify-between px-3 py-2"
                        >
                          <p className="min-w-0 truncate text-sm text-gray-600 dark:text-gray-300">
                            <span className="font-semibold text-gray-800 dark:text-gray-100">
                              {p.invoiceNumber}
                            </span>
                            <span className="ml-2 capitalize">
                              Purchase Payment of {p.supplierName || "Supplier"}
                            </span>
                          </p>
                          <span className="ml-2 shrink-0 text-sm font-bold text-error-600 dark:text-error-400">
                            -{formatCurrency(p.amount)}
                          </span>
                        </div>
                      ))}

                      {(outflowTransactionSummary?.supplierPayments ?? []).map((p, i) => (
                        <div
                          key={`supplier-${p.paymentId}-${i}`}
                          className="flex items-center justify-between px-3 py-2"
                        >
                          <p className="min-w-0 truncate text-sm text-gray-600 dark:text-gray-300">
                            <span className="font-semibold text-gray-800 dark:text-gray-100">
                              {p.paymentId}
                            </span>
                            <span className="ml-2 capitalize">
                              Supplier Payment of {p.supplierName || "Supplier"}
                            </span>
                          </p>
                          <span className="ml-2 shrink-0 text-sm font-bold text-error-600 dark:text-error-400">
                            -{formatCurrency(p.amount)}
                          </span>
                        </div>
                      ))}

                      {(outflowTransactionSummary?.salesReturns ?? []).map((s, i) => (
                        <div
                          key={`sales-return-${s.returnId}-${i}`}
                          className="flex items-center justify-between px-3 py-2"
                        >
                          <p className="min-w-0 truncate text-sm text-gray-600 dark:text-gray-300">
                            <span className="font-semibold text-gray-800 dark:text-gray-100">
                              {s.returnId || "—"}
                            </span>
                            <span className="ml-2 capitalize">
                              Sales Return{s.invoiceNumber ? ` of ${s.invoiceNumber}` : ""}
                            </span>
                          </p>
                          <span className="ml-2 shrink-0 text-sm font-bold text-error-600 dark:text-error-400">
                            -{formatCurrency(s.amount)}
                          </span>
                        </div>
                      ))}

                      {(outflowTransactionSummary?.accountTransactions ?? []).map((t, i) => (
                        <div
                          key={`cash-${t.transactionId}-${i}`}
                          className="flex items-center justify-between px-3 py-2"
                        >
                          <p className="min-w-0 truncate text-sm text-gray-600 dark:text-gray-300">
                            <span className="font-semibold text-gray-800 dark:text-gray-100">
                              {t.transactionId || "—"}
                            </span>
                            <span className="ml-2 capitalize">
                              {t.categoryName || t.description || "Cash Payment"}
                            </span>
                          </p>
                          <span className="ml-2 shrink-0 text-sm font-bold text-error-600 dark:text-error-400">
                            -{formatCurrency(t.amount)}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Grand total */}
                    <div className="flex items-center justify-between rounded-lg bg-error-50 px-3 py-2.5 dark:bg-error-500/10">
                      <span className="text-sm font-semibold text-error-700 dark:text-error-300">
                        Grand Total Outflow
                      </span>
                      <span className="text-base font-bold text-error-700 dark:text-error-300">
                        {formatCurrency(outflowTransactionSummary?.grandTotal ?? 0)}
                      </span>
                    </div>
                  </div>
                )}
              </Card>
            )}
          </div>

          {/* ── Day summary + Accounts balance ── */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {showBox(PERMISSIONS.DASHBOARD_DAY_CASH_SUMMARY) && (
              <Card title="Day Summary">
                {isDayCashSummaryLoading ? (
                  <div className="h-[140px] animate-pulse rounded-xl bg-gray-50 dark:bg-white/[0.02]" />
                ) : (
                  <div className="divide-y divide-gray-50 dark:divide-gray-800/60">
                    <div className="flex items-center justify-between py-2.5">
                      <span className="text-sm text-gray-500 dark:text-gray-400">Opening Balance</span>
                      <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                        {formatCurrency(dayCashSummaryData?.openingBalance ?? 0)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-2.5">
                      <span className="text-sm text-gray-500 dark:text-gray-400">Total Receive Today</span>
                      <span className="text-sm font-bold text-success-600 dark:text-success-400">
                        +{formatCurrency(dayCashSummaryData?.totalReceive ?? 0)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-2.5">
                      <span className="text-sm text-gray-500 dark:text-gray-400">Total Payment Today</span>
                      <span className="text-sm font-bold text-error-600 dark:text-error-400">
                        -{formatCurrency(dayCashSummaryData?.totalPayment ?? 0)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-brand-50 px-3 py-2.5 dark:bg-brand-500/10">
                      <span className="text-sm font-semibold text-brand-700 dark:text-brand-300">
                        Closing Balance
                      </span>
                      <span className="text-base font-bold text-brand-700 dark:text-brand-300">
                        {formatCurrency(dayCashSummaryData?.closingBalance ?? 0)}
                      </span>
                    </div>
                  </div>
                )}
              </Card>
            )}

            {showBox(PERMISSIONS.DASHBOARD_ACCOUNTS_BALANCE_LIST) && (
              <Card title="Accounts Balance">
                {isAccountsBalanceSummaryLoading ? (
                  <div className="h-[140px] animate-pulse rounded-xl bg-gray-50 dark:bg-white/[0.02]" />
                ) : (accountsBalanceSummaryData?.accounts ?? []).length === 0 ? (
                  <p className="py-6 text-center text-sm text-gray-400">
                    No accounts yet.
                  </p>
                ) : (
                  <div className="divide-y divide-gray-50 dark:divide-gray-800/60">
                    {(accountsBalanceSummaryData?.accounts ?? []).map((a) => (
                      <div
                        key={a._id}
                        className="grid grid-cols-[1fr_auto] items-center gap-4 py-2.5"
                      >
                        <span className="truncate text-sm text-gray-500 dark:text-gray-400">
                          {a.name}
                        </span>
                        <span
                          className={`w-28 text-right font-mono text-sm font-semibold tabular-nums ${
                            a.balance < 0
                              ? "text-error-600 dark:text-error-400"
                              : "text-gray-800 dark:text-gray-100"
                          }`}
                        >
                          {formatCurrency(a.balance)}
                        </span>
                      </div>
                    ))}
                    <div className="grid grid-cols-[1fr_auto] items-center gap-4 pt-2.5">
                      <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                        Total
                      </span>
                      <span className="w-28 text-right font-mono text-sm font-bold tabular-nums text-gray-900 dark:text-white">
                        {formatCurrency(accountsBalanceSummaryData?.totalBalance ?? 0)}
                      </span>
                    </div>
                  </div>
                )}
              </Card>
            )}
          </div>

          {/* ── Low stock alert + Payment status ── */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {showBox(PERMISSIONS.DASHBOARD_LOW_STOCK_ALERT) && (
              <Card
                title="Low Stock Alert"
                action={
                  <span className="flex items-center gap-1 rounded-lg bg-error-50 px-2 py-1 text-xs font-semibold text-error-600 dark:bg-error-500/15 dark:text-error-400">
                    <FiAlertTriangle size={12} />
                    {formatNumber(data?.lowStock?.length ?? 0)}
                  </span>
                }
              >
                {isLoading ? (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div
                        key={i}
                        className="h-16 animate-pulse rounded-lg bg-gray-50 dark:bg-white/[0.02]"
                      />
                    ))}
                  </div>
                ) : (data?.lowStock ?? []).length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-10 text-center">
                    <div className="flex size-10 items-center justify-center rounded-full bg-success-50 text-success-500 dark:bg-success-500/15">
                      <FiPackage size={18} />
                    </div>
                    <p className="text-sm text-gray-400">
                      All products well stocked.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {(data?.lowStock ?? []).map((p, i) => (
                      <div
                        key={`${p.barCode}-${i}`}
                        className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 dark:border-gray-800"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-gray-700 dark:text-gray-300">
                            {[p.name, p.variantName, p.color, p.size].filter(Boolean).join(" · ")}
                          </p>
                          <p className="text-xs text-gray-400">
                            {[p.barCode, formatCurrency(p.retailPrice), `Alert at ${p.alertQty}`].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                        <span
                          className={`ml-2 shrink-0 rounded-md px-2 py-1 text-xs font-bold ${
                            p.stock === 0
                              ? "bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-400"
                              : "bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-400"
                          }`}
                        >
                          {p.stock} left
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}

            {showBox(PERMISSIONS.DASHBOARD_PAYMENT_STATUS) && (
              <Card title="Payment Status">
                {isLoading ? (
                  <div className="h-[140px] animate-pulse rounded-xl bg-gray-50 dark:bg-white/[0.02]" />
                ) : (
                  <div className="space-y-3">
                    {(data?.paymentSplit ?? []).length === 0 && (
                      <p className="py-6 text-center text-sm text-gray-400">
                        No payment data.
                      </p>
                    )}
                    {(data?.paymentSplit ?? []).map((p) => {
                      const total = (data?.paymentSplit ?? []).reduce(
                        (s, x) => s + x.amount,
                        0,
                      );
                      const pct = total ? Math.round((p.amount / total) * 100) : 0;
                      return (
                        <div key={p.status}>
                          <div className="mb-1 flex items-center justify-between text-xs">
                            <span
                              className={`rounded-md px-2 py-0.5 font-semibold capitalize ${paymentBadge(
                                p.status,
                              )}`}
                            >
                              {p.status}
                            </span>
                            <span className="font-semibold text-gray-700 dark:text-gray-300">
                              {formatCompact(p.amount)}
                              <span className="ml-1 text-gray-400">
                                ({p.count})
                              </span>
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-white/[0.06]">
                            <div
                              className={`h-full rounded-full ${
                                p.status === "paid"
                                  ? "bg-success-500"
                                  : p.status === "partial"
                                    ? "bg-warning-500"
                                    : "bg-error-500"
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  );
}
