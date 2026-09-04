import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import axiosSecure from "../../../hooks/useAxiosSecure";

export type DashboardRange = "today" | "7d" | "30d" | "90d" | "12m" | "all";

export interface DashboardKpis {
  revenue: number;
  collected: number;
  dues: number;
  orders: number;
  itemsSold: number;
  avgOrderValue: number;
  totalCustomers: number;
  activeProducts: number;
  totalProducts: number;
  inventoryUnits: number;
  inventoryRetailValue: number;
  inventoryWholesaleValue: number;
  inventoryCostValue: number;
  outstandingDues: number;
  grossProfit: number;
  stockOutCount: number;
}

export interface DashboardSummary {
  profile: {
    totalCustomer: number;
    totalSupplier: number;
    totalEmployee: number;
  };
  salesToday: {
    totalSales: number;
    cashSales: number;
    duesSales: number;
  };
  cashToday: {
    cashReceive: number;
    cashPayment: number;
    cashBalance: number;
  };
  overallBalance: {
    supplierDues: number;
    customerDues: number;
    liabilityBalance: number;
  };
}

export interface SalesByType {
  type: string;
  revenue: number;
  count: number;
}

export interface PaymentSplit {
  status: string;
  count: number;
  amount: number;
}

export interface DailyPoint {
  date: string;
  revenue: number;
  orders: number;
}

export interface TopProduct {
  name: string;
  quantity: number;
  revenue: number;
}

export interface RecentSale {
  invoiceNumber: string;
  payable: number;
  paid: number;
  presentDue: number;
  paymentStatus: string;
  salesType: string;
  customerName: string;
  createdAt: string;
}

export interface LowStockItem {
  name: string;
  stock: number;
  retailPrice: number;
  barCode: string;
  color: string;
  size: string;
}

export interface DashboardCashTransaction {
  description: string;
  amount: number;
  serialId?: string;
  createdAt: string;
}

export interface DashboardInvoices {
  total: number;
  complete: number;
  pending: number;
  draft: number;
}

export interface DashboardAccountsBalance {
  balance: number;
  payable: number;
  receivable: number;
}

export interface DashboardItemsSummary {
  invoiceCount: number;
  quantity: number;
  total: number;
}

export interface DashboardProductStatus {
  active: number;
  inactive: number;
  total: number;
}

export interface DashboardAmountCount {
  amount: number;
  count: number;
}

export interface DashboardData {
  range: string;
  kpis: DashboardKpis;
  summary: DashboardSummary;
  salesByType: SalesByType[];
  paymentSplit: PaymentSplit[];
  dailySeries: DailyPoint[];
  topProducts: TopProduct[];
  recentSales: RecentSale[];
  lowStock: LowStockItem[];
  invoices: DashboardInvoices;
  accountsBalance: DashboardAccountsBalance;
  purchaseItems: DashboardItemsSummary;
  soldItems: DashboardItemsSummary;
  productStatus: DashboardProductStatus;
  supplierPayment: DashboardAmountCount;
  customerDuePayment: DashboardAmountCount;
  inflowTransactions: DashboardCashTransaction[];
  outflowTransactions: DashboardCashTransaction[];
  employeeAdvance: DashboardAmountCount;
  cashReceiveTodayList?: DashboardCashTransaction[];
  cashPaymentTodayList?: DashboardCashTransaction[];
}

// A box the user lacks permission for answers 403. That is a settled answer,
// not a transient failure, so never retry it.
const noRetryOnDenied = (failureCount: number, error: unknown): boolean => {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    if (status === 401 || status === 403) return false;
  }
  return failureCount < 2;
};

// A per-box date filter (YYYY-MM-DD), independent of the shared range
// selector. When set it overrides `range` on the backend for that one query.
export interface CustomDateRange {
  startDate: string;
  endDate: string;
}

// Builds the query string for any range-driven endpoint: a custom date wins
// over the preset range, matching how `resolveRange` on the backend prefers
// startDate/endDate over range when both could apply.
const rangeParams = (
  range: DashboardRange,
  customDate?: CustomDateRange,
): string =>
  customDate
    ? `startDate=${customDate.startDate}&endDate=${customDate.endDate}`
    : `range=${range}`;

export const useDashboard = (range: DashboardRange) =>
  useQuery<DashboardData>({
    queryKey: ["dashboard-overview", range],
    queryFn: async () => {
      const { data } = await axiosSecure.get(
        `/dashboard/overview?range=${range}`,
      );
      return data.data as DashboardData;
    },
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
    retry: noRetryOnDenied,
  });

export interface InvoiceStatsData {
  range: string;
  invoices: DashboardInvoices;
}

export const useInvoiceStats = (
  range: DashboardRange,
  customDate?: CustomDateRange,
) =>
  useQuery<InvoiceStatsData>({
    queryKey: ["dashboard-invoices", range, customDate],
    queryFn: async () => {
      const { data } = await axiosSecure.get(
        `/dashboard/invoices?${rangeParams(range, customDate)}`,
      );
      return data.data as InvoiceStatsData;
    },
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
    retry: noRetryOnDenied,
  });

export interface DashboardSalesSummary {
  total: number;
  received: number;
  due: number;
  profit: number;
  orders: number;
}

export interface SalesSummaryData {
  range: string;
  sales: DashboardSalesSummary;
}

// customDate, when set, filters the Total Sale box by the sale's own `date`
// field instead of the range preset — it wins over `range` on the backend.
export const useSalesSummary = (
  range: DashboardRange,
  customDate?: CustomDateRange,
) =>
  useQuery<SalesSummaryData>({
    queryKey: ["dashboard-sales-summary", range, customDate],
    queryFn: async () => {
      const { data } = await axiosSecure.get(
        `/dashboard/sales-summary?${rangeParams(range, customDate)}`,
      );
      return data.data as SalesSummaryData;
    },
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
    retry: noRetryOnDenied,
  });

export interface DashboardTransactionSummary {
  totalTransaction: number;
  totalPayment: number;
  totalBalance: number;
}

export interface TransactionSummaryData {
  range: string;
  transaction: DashboardTransactionSummary;
}

export const useTransactionSummary = (
  range: DashboardRange,
  customDate?: CustomDateRange,
) =>
  useQuery<TransactionSummaryData>({
    queryKey: ["dashboard-transaction-summary", range, customDate],
    queryFn: async () => {
      const { data } = await axiosSecure.get(
        `/dashboard/transaction-summary?${rangeParams(range, customDate)}`,
      );
      return data.data as TransactionSummaryData;
    },
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
    retry: noRetryOnDenied,
  });

export interface DashboardInventorySummary {
  totalStock: number;
  inStock: number;
  stockOut: number;
  balance: number;
}

export interface InventorySummaryData {
  range: string;
  inventory: DashboardInventorySummary;
}

export const useInventorySummary = (range: DashboardRange) =>
  useQuery<InventorySummaryData>({
    queryKey: ["dashboard-inventory-summary", range],
    queryFn: async () => {
      const { data } = await axiosSecure.get(
        `/dashboard/inventory-summary?range=${range}`,
      );
      return data.data as InventorySummaryData;
    },
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
    retry: noRetryOnDenied,
  });

export interface DashboardCustomerSummary {
  totalCustomer: number;
  totalDue: number;
}

export interface CustomerSummaryData {
  range: string;
  customer: DashboardCustomerSummary;
}

export const useCustomerSummary = (range: DashboardRange) =>
  useQuery<CustomerSummaryData>({
    queryKey: ["dashboard-customer-summary", range],
    queryFn: async () => {
      const { data } = await axiosSecure.get(
        `/dashboard/customer-summary?range=${range}`,
      );
      return data.data as CustomerSummaryData;
    },
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
    retry: noRetryOnDenied,
  });

export interface DashboardSupplierSummary {
  totalSupplier: number;
  totalDue: number;
}

export interface SupplierSummaryData {
  range: string;
  supplier: DashboardSupplierSummary;
}

export const useSupplierSummary = (range: DashboardRange) =>
  useQuery<SupplierSummaryData>({
    queryKey: ["dashboard-supplier-summary", range],
    queryFn: async () => {
      const { data } = await axiosSecure.get(
        `/dashboard/supplier-summary?range=${range}`,
      );
      return data.data as SupplierSummaryData;
    },
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
    retry: noRetryOnDenied,
  });

export interface DashboardEmployeeSummary {
  totalEmployee: number;
  advancePayment: number;
}

export interface EmployeeSummaryData {
  range: string;
  employee: DashboardEmployeeSummary;
}

export const useEmployeeSummary = (range: DashboardRange) =>
  useQuery<EmployeeSummaryData>({
    queryKey: ["dashboard-employee-summary", range],
    queryFn: async () => {
      const { data } = await axiosSecure.get(
        `/dashboard/employee-summary?range=${range}`,
      );
      return data.data as EmployeeSummaryData;
    },
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
    retry: noRetryOnDenied,
  });

export interface DashboardPurchaseSummary {
  invoiceCount: number;
  quantity: number;
  value: number;
}

export interface PurchaseSummaryData {
  range: string;
  purchase: DashboardPurchaseSummary;
}

export const usePurchaseSummary = (
  range: DashboardRange,
  customDate?: CustomDateRange,
) =>
  useQuery<PurchaseSummaryData>({
    queryKey: ["dashboard-purchase-summary", range, customDate],
    queryFn: async () => {
      const { data } = await axiosSecure.get(
        `/dashboard/purchase-summary?${rangeParams(range, customDate)}`,
      );
      return data.data as PurchaseSummaryData;
    },
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
    retry: noRetryOnDenied,
  });

export interface DashboardSoldItemsSummary {
  invoiceCount: number;
  quantity: number;
  wholesaleAmount: number;
  retailAmount: number;
}

export interface SoldItemsSummaryData {
  range: string;
  soldItems: DashboardSoldItemsSummary;
}

export const useSoldItemsSummary = (
  range: DashboardRange,
  customDate?: CustomDateRange,
) =>
  useQuery<SoldItemsSummaryData>({
    queryKey: ["dashboard-sold-items-summary", range, customDate],
    queryFn: async () => {
      const { data } = await axiosSecure.get(
        `/dashboard/sold-items-summary?${rangeParams(range, customDate)}`,
      );
      return data.data as SoldItemsSummaryData;
    },
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
    retry: noRetryOnDenied,
  });

export interface DashboardInventoryValueSummary {
  units: number;
  retailValue: number;
  wholesaleValue: number;
}

export interface InventoryValueSummaryData {
  range: string;
  inventoryValue: DashboardInventoryValueSummary;
}

export const useInventoryValueSummary = (range: DashboardRange) =>
  useQuery<InventoryValueSummaryData>({
    queryKey: ["dashboard-inventory-value-summary", range],
    queryFn: async () => {
      const { data } = await axiosSecure.get(
        `/dashboard/inventory-value-summary?range=${range}`,
      );
      return data.data as InventoryValueSummaryData;
    },
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
    retry: noRetryOnDenied,
  });

export interface DashboardStockCostSummary {
  costValue: number;
}

export interface StockCostSummaryData {
  range: string;
  stockCost: DashboardStockCostSummary;
}

export const useStockCostSummary = (range: DashboardRange) =>
  useQuery<StockCostSummaryData>({
    queryKey: ["dashboard-stock-cost-summary", range],
    queryFn: async () => {
      const { data } = await axiosSecure.get(
        `/dashboard/stock-cost-summary?range=${range}`,
      );
      return data.data as StockCostSummaryData;
    },
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
    retry: noRetryOnDenied,
  });

export interface DashboardProductStatusSummary {
  totalStock: number;
  active: number;
  inactive: number;
}

export interface ProductStatusSummaryData {
  range: string;
  productStatus: DashboardProductStatusSummary;
}

export const useProductStatusSummary = (range: DashboardRange) =>
  useQuery<ProductStatusSummaryData>({
    queryKey: ["dashboard-product-status-summary", range],
    queryFn: async () => {
      const { data } = await axiosSecure.get(
        `/dashboard/product-status-summary?range=${range}`,
      );
      return data.data as ProductStatusSummaryData;
    },
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
    retry: noRetryOnDenied,
  });

export interface DashboardSupplierPaymentSummary {
  invoiceCount: number;
  paid: number;
  less: number;
  amount: number;
}

export interface SupplierPaymentSummaryData {
  range: string;
  supplierPayment: DashboardSupplierPaymentSummary;
}

export const useSupplierPaymentSummary = (
  range: DashboardRange,
  customDate?: CustomDateRange,
) =>
  useQuery<SupplierPaymentSummaryData>({
    queryKey: ["dashboard-supplier-payment-summary", range, customDate],
    queryFn: async () => {
      const { data } = await axiosSecure.get(
        `/dashboard/supplier-payment-summary?${rangeParams(range, customDate)}`,
      );
      return data.data as SupplierPaymentSummaryData;
    },
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
    retry: noRetryOnDenied,
  });

export interface DashboardCustomerDuePaymentSummary {
  amount: number;
  count: number;
  customersWithDue: number;
}

export interface CustomerDuePaymentSummaryData {
  range: string;
  customerDuePayment: DashboardCustomerDuePaymentSummary;
}

export const useCustomerDuePaymentSummary = (
  range: DashboardRange,
  customDate?: CustomDateRange,
) =>
  useQuery<CustomerDuePaymentSummaryData>({
    queryKey: ["dashboard-customer-due-payment-summary", range, customDate],
    queryFn: async () => {
      const { data } = await axiosSecure.get(
        `/dashboard/customer-due-payment-summary?${rangeParams(range, customDate)}`,
      );
      return data.data as CustomerDuePaymentSummaryData;
    },
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
    retry: noRetryOnDenied,
  });

export interface InflowSource {
  key: string;
  label: string;
  amount: number;
  count: number;
}

export interface InflowAccountTransaction {
  transactionId: string;
  categoryName: string;
  description: string;
  amount: number;
  createdAt: string;
}

export interface InflowNetBreakdownLine {
  paidAmount: number;
  lessAmount?: number;
  cashBack: number;
  netAmount: number;
}

export interface InflowSalesInvoiceRow {
  invoiceNumber: string;
  customerName: string;
  customerId: string;
  amount: number;
  total: number;
  createdAt: string;
}

export interface InflowCustomerPaymentRow {
  paymentId: string;
  customerName: string;
  customerId: string;
  amount: number;
  createdAt: string;
}

export interface InflowTransactionSummary {
  sources: InflowSource[];
  accountTransactions: InflowAccountTransaction[];
  breakdown: {
    customerPaymentReceived: InflowNetBreakdownLine;
    customerAdvancePayment: InflowNetBreakdownLine;
  };
  grandTotal: number;
}

export interface InflowTransactionSummaryData {
  range: string;
  sources: InflowSource[];
  accountTransactions: InflowAccountTransaction[];
  salesInvoices: InflowSalesInvoiceRow[];
  salesInvoicesTotal: number;
  customerDuePayments: InflowCustomerPaymentRow[];
  customerDuePaymentsTotal: number;
  customerAdvancePayments: InflowCustomerPaymentRow[];
  customerAdvancePaymentsTotal: number;
  breakdown: InflowTransactionSummary["breakdown"];
  grandTotal: number;
}

export const useInflowTransactionSummary = (
  range: DashboardRange,
  customDate?: CustomDateRange,
) =>
  useQuery<InflowTransactionSummaryData>({
    queryKey: ["dashboard-inflow-transaction-summary", range, customDate],
    queryFn: async () => {
      const { data } = await axiosSecure.get(
        `/dashboard/inflow-transaction-summary?${rangeParams(range, customDate)}`,
      );
      return data.data as InflowTransactionSummaryData;
    },
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
    retry: noRetryOnDenied,
  });

export interface OutflowPurchasePaymentRow {
  invoiceNumber: string;
  supplierName: string;
  supplierId: string;
  amount: number;
  createdAt: string;
}

export interface OutflowSupplierPaymentRow {
  paymentId: string;
  supplierName: string;
  supplierId: string;
  amount: number;
  createdAt: string;
}

export interface OutflowTransactionSummaryData {
  range: string;
  sources: InflowSource[];
  accountTransactions: InflowAccountTransaction[];
  purchasePayments: OutflowPurchasePaymentRow[];
  purchasePaymentsTotal: number;
  supplierPayments: OutflowSupplierPaymentRow[];
  supplierPaymentsTotal: number;
  breakdown: {
    purchasePayment: InflowNetBreakdownLine;
    supplierPayment: InflowNetBreakdownLine;
  };
  grandTotal: number;
}

export const useOutflowTransactionSummary = (
  range: DashboardRange,
  customDate?: CustomDateRange,
) =>
  useQuery<OutflowTransactionSummaryData>({
    queryKey: ["dashboard-outflow-transaction-summary", range, customDate],
    queryFn: async () => {
      const { data } = await axiosSecure.get(
        `/dashboard/outflow-transaction-summary?${rangeParams(range, customDate)}`,
      );
      return data.data as OutflowTransactionSummaryData;
    },
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
    retry: noRetryOnDenied,
  });

export interface DayCashSummaryData {
  date: string;
  openingBalance: number;
  totalReceive: number;
  totalPayment: number;
  closingBalance: number;
}

export const useDayCashSummary = () =>
  useQuery<DayCashSummaryData>({
    queryKey: ["dashboard-day-cash-summary"],
    queryFn: async () => {
      const { data } = await axiosSecure.get(`/dashboard/day-cash-summary`);
      return data.data as DayCashSummaryData;
    },
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
    retry: noRetryOnDenied,
  });

export interface AccountBalanceRow {
  _id: string;
  name: string;
  slug: string;
  isActive: boolean;
  balance: number;
}

export interface AccountsBalanceSummaryData {
  accounts: AccountBalanceRow[];
  totalBalance: number;
}

// Not cached like the range-based summaries above — every transaction across
// the app mutates account balances, so this always refetches fresh.
export const useAccountsBalanceSummary = () =>
  useQuery<AccountsBalanceSummaryData>({
    queryKey: ["dashboard-accounts-balance-summary"],
    queryFn: async () => {
      const { data } = await axiosSecure.get(`/dashboard/accounts-balance-summary`);
      return data.data as AccountsBalanceSummaryData;
    },
    staleTime: 0,
    refetchOnWindowFocus: false,
    retry: noRetryOnDenied,
  });

// ── Formatting helpers ──────────────────────────────────────────────────────
export const formatCurrency = (n: number): string =>
  `৳${(n ?? 0).toLocaleString("en-IN")}`;

// Exact figure, no rounding to compact units — always 2 decimal places
export const formatCurrencyExact = (n: number): string =>
  `৳${(n ?? 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export const formatCompact = (n: number): string => {
  const v = n ?? 0;
  if (Math.abs(v) >= 10000000) return `৳${(v / 10000000).toFixed(2)}Cr`;
  if (Math.abs(v) >= 100000) return `৳${(v / 100000).toFixed(2)}L`;
  if (Math.abs(v) >= 1000) return `৳${(v / 1000).toFixed(1)}K`;
  return `৳${v.toLocaleString("en-IN")}`;
};

export const formatNumber = (n: number): string =>
  (n ?? 0).toLocaleString("en-IN");
