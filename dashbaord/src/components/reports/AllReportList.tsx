import { useMemo, useState, type CSSProperties } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useAuth } from "../../context/AuthContext";
import { REPORT_MODULES } from "../../config/permissions";
import {
  TbShoppingCartPlus,
  TbTruckDelivery,
  TbReceipt2,
  TbWallet,
  TbUsers,
  TbUserDollar,
  TbTruck,
  TbBox,
  TbChevronRight,
  TbSearch,
  TbChartLine,
} from "react-icons/tb";

interface ReportItem {
  name: string;
  description: string;
  path: string;
}

interface ReportCategory {
  key: string;
  label: string;
  icon: React.ReactNode;
  chipBg: string;
  chipText: string;
  reports: ReportItem[];
}

const categories: ReportCategory[] = [
  {
    key: "purchase",
    label: "Purchase",
    icon: <TbTruckDelivery className="size-[18px]" />,
    chipBg: "bg-blue-50 dark:bg-blue-500/10",
    chipText: "text-blue-500",
    reports: [
      {
        name: "Purchase Invoice",
        description: "Invoice-wise purchase records with supplier filter",
        path: "/purchase-invoice",
      },
      {
        name: "Purchase Product",
        description: "Product-wise purchased items with buy rate & qty",
        path: "/purchase-product",
      },
      {
        name: "Purchase Summary",
        description: "Product-wise totals with average buy rate",
        path: "/purchase-summary",
      },
      {
        name: "Purchase Return",
        description: "Item-wise returns with buy rate, qty & total",
        path: "/purchase-return-invoice",
      },
      {
        name: "Purchase Return Summary",
        description: "Item-wise return totals with average buy rate",
        path: "/purchase-return-summary",
      },
    ],
  },
  {
    key: "order",
    label: "Order",
    icon: <TbShoppingCartPlus className="size-[18px]" />,
    chipBg: "bg-purple-50 dark:bg-purple-500/10",
    chipText: "text-purple-500",
    reports: [
      {
        name: "Order Invoice",
        description: "Order-wise invoice breakdown",
        path: "/order-invoice",
      },
      {
        name: "Order Status Report",
        description: "Order counts grouped by fulfilment status",
        path: "/order-status-report",
      },
    ],
  },
  {
    key: "sales",
    label: "Sales",
    icon: <TbReceipt2 className="size-[18px]" />,
    chipBg: "bg-emerald-50 dark:bg-emerald-500/10",
    chipText: "text-emerald-500",
    reports: [
      {
        name: "Sales Invoice",
        description: "Invoice-wise sales with type & customer filter",
        path: "/sales-invoice",
      },
      {
        name: "Sales Product",
        description: "Product-wise sold items with category & brand filter",
        path: "/sales-product",
      },
      {
        name: "Sales Summary",
        description: "Product-wise totals with weighted average buy price",
        path: "/sales-summary",
      },
      {
        name: "Top Sales Product",
        description: "Best-selling products with buy price, sales price, qty, total & profit",
        path: "/top-sales-product",
      },
      {
        name: "Push Sales Product",
        description: "In-stock products that are not selling, with buy, sales & profit stock value",
        path: "/push-sales-product",
      },
      {
        name: "Product Sales Return",
        description: "Returned products with buy, WS & RS price, discount and refunded total",
        path: "/product-sales-return",
      },
      {
        name: "Product Sales Return Summary",
        description: "Product-wise returned qty, prices, discount and refunded total",
        path: "/product-sales-return-summary",
      },
      {
        name: "User Sales Invoice",
        description: "Your own sale invoices with return, discount, VAT, payable, paid & due",
        path: "/user-sales-invoice",
      },
      {
        name: "User Sales Product",
        description: "Product lines on your own sales with buy, WS & RS price, discount and total",
        path: "/user-sales-product",
      },
      {
        name: "Top User",
        description: "Users ranked by sales, with invoices, customers, discount, payable, paid & due",
        path: "/top-user",
      },
      {
        name: "Salesman Sales Invoice",
        description: "Invoice-wise sales by salesman with discount, VAT, payable, paid & due",
        path: "/salesman-sales-invoice",
      },
      {
        name: "Salesman Sales Product",
        description: "Product lines by salesman with buy, WS & RS price, discount and total",
        path: "/salesman-sales-product",
      },
    ],
  },
  {
    key: "profit",
    label: "Profit",
    icon: <TbChartLine className="size-[18px]" />,
    chipBg: "bg-lime-50 dark:bg-lime-500/10",
    chipText: "text-lime-600",
    reports: [
      {
        name: "Invoice Profit",
        description: "Invoice-wise total, discount, delivery, payable, paid, due & profit",
        path: "/invoice-profit",
      },
      {
        name: "Product Profit",
        description: "Product-wise quantity, sales price, total, discount & profit per sold line",
        path: "/product-profit",
      },
    ],
  },
  {
    key: "customer",
    label: "Customer",
    icon: <TbUserDollar className="size-[18px]" />,
    chipBg: "bg-indigo-50 dark:bg-indigo-500/10",
    chipText: "text-indigo-500",
    reports: [
      {
        name: "Customer Sales Invoice",
        description: "Invoice-wise customer sales with name & payment status filter",
        path: "/customer-sales-invoice",
      },
      {
        name: "Customer Invoice Profit",
        description: "Invoice-wise buy price, sales total, discount & profit",
        path: "/customer-invoice-profit",
      },
      {
        name: "Top Customer",
        description: "Listed customers ranked by sales total, with profit & last sale",
        path: "/top-customer",
      },
      {
        name: "Customer Sales Product",
        description: "Item-wise customer sales with WS/RS price and sub. total",
        path: "/customer-sales-product",
      },
      {
        name: "Customer Sales Summary",
        description: "Product-wise totals with qty, sales price & amount",
        path: "/customer-sales-summary",
      },
      {
        name: "Customer Payment",
        description:
          "Due & advance payments with trx ref, category, paid, less & cashback",
        path: "/customer-payment-report",
      },
      {
        name: "Customer Balance Summary",
        description:
          "Opening balance + total sales - paid = balance, per customer",
        path: "/customer-balance-summary",
      },
      {
        name: "Customer Ledger",
        description:
          "Date-ordered statement with received, payment & running balance",
        path: "/customer-ledger",
      },
      {
        name: "Customer Due List",
        description:
          "Outstanding dues with due invoice count, last sale & last payment",
        path: "/customer-due-list",
      },
    ],
  },
  {
    key: "supplier",
    label: "Supplier",
    icon: <TbTruck className="size-[18px]" />,
    chipBg: "bg-orange-50 dark:bg-orange-500/10",
    chipText: "text-orange-500",
    reports: [
      {
        name: "Supplier Purchase Invoice",
        description: "Invoice-wise purchases with supplier & payment status filter",
        path: "/supplier-purchase-invoice",
      },
      {
        name: "Supplier Payment",
        description: "Due payments with trx id, method, paid & less",
        path: "/supplier-payment-report",
      },
      {
        name: "Supplier Ledger",
        description: "Opening, purchases, returns & payments with received, payment & balance",
        path: "/supplier-ledger",
      },
      {
        name: "Supplier Balance Summary",
        description: "Opening balance + total purchase - paid = balance, per supplier",
        path: "/supplier-balance-summary",
      },
      {
        name: "Supplier Dues",
        description: "Suppliers still owed, with purchase count & last purchase date",
        path: "/supplier-dues",
      },
    ],
  },
  {
    key: "stock",
    label: "Stock",
    icon: <TbBox className="size-[18px]" />,
    chipBg: "bg-teal-50 dark:bg-teal-500/10",
    chipText: "text-teal-500",
    reports: [
      {
        name: "Stock Report",
        description: "Overall stock with buy rate, quantity & stock value",
        path: "/stock-report",
      },
      {
        name: "Stock Details",
        description: "Opening, purchases, adjustments, sales & returns per item",
        path: "/stock-details-report",
      },
      {
        name: "Product Ledger",
        description: "Every stock in/out movement for one item, with balance",
        path: "/product-ledger",
      },
      {
        name: "Size & Color Stock",
        description: "Size-wise stock per product colour, with total value",
        path: "/size-color-stock-report",
      },
      {
        name: "Size Wise Stock",
        description: "Size-wise stock per product, with total value",
        path: "/size-wise-stock-report",
      },
      {
        name: "Stock Adjustment",
        description: "Manual adjustments with per-product adjustment counts",
        path: "/stock-adjustment-report",
      },
      {
        name: "Low Stock Alert",
        description: "Items at or below their alert quantity",
        path: "/low-stock-report",
      },
    ],
  },
  {
    key: "account",
    label: "Account",
    icon: <TbWallet className="size-[18px]" />,
    chipBg: "bg-amber-50 dark:bg-amber-500/10",
    chipText: "text-amber-500",
    reports: [
      {
        name: "Transaction Report",
        description: "Manual transactions with receive, payment & balance",
        path: "/transaction-report",
      },
      {
        name: "Transaction Summary",
        description: "Category-wise receive & payment totals with entry count",
        path: "/transaction-summary",
      },
      {
        name: "All Transaction Summary",
        description: "Every transaction incl. sales, purchases & payments, per line",
        path: "/all-transaction-summary",
      },
      {
        name: "Accounts Ledger",
        description: "Every transaction row-wise, incl. sales, purchases & payments",
        path: "/accounts-ledger",
      },
      {
        name: "Account Day Transaction",
        description: "Day-wise received, paid & balance per account",
        path: "/account-day-transaction",
      },
      {
        name: "Account Transaction Summary",
        description: "Account-wise total received, paid & balance",
        path: "/account-transaction-summary",
      },
      {
        name: "Account Balance",
        description: "Balance of every account as of a chosen date",
        path: "/account-balance",
      },
      {
        name: "Fund Handover",
        description: "Money handovers with giver/receiver, voucher & payment mode",
        path: "/fund-handover",
      },
    ],
  },
  {
    key: "employee",
    label: "Employee",
    icon: <TbUsers className="size-[18px]" />,
    chipBg: "bg-rose-50 dark:bg-rose-500/10",
    chipText: "text-rose-500",
    reports: [
      {
        name: "Employee List",
        description: "Full employee roster with contact, designation & salary details",
        path: "/employee-list-report",
      },
      {
        name: "Employee Payment",
        description: "Advance/salary payment history with salary, paid & balance",
        path: "/employee-payment-report",
      },
    ],
  },
];

// Rows per column in the two-column report grid. Reports fill the left column
// top to bottom first, six to a column, so a category of 9 reads 6 left and
// 3 right; small categories split evenly and large ones grow both columns.
const MAX_ROWS = 6;
const columnRows = (count: number) =>
  count > MAX_ROWS ? Math.max(MAX_ROWS, Math.ceil(count / 2)) : Math.ceil(count / 2);

const AllReportList = () => {
  const navigate = useNavigate();
  const { can, isSuperAdmin, isLoading } = useAuth();
  // The open tab lives in the URL (?category=supplier) rather than in state, so
  // Back from a report returns to the tab it was opened from instead of
  // resetting to the first one.
  const [searchParams, setSearchParams] = useSearchParams();
  const activeCategory = searchParams.get("category") ?? categories[0].key;
  const setActiveCategory = (key: string) =>
    setSearchParams({ category: key }, { replace: true });
  const [search, setSearch] = useState("");

  // Keep only reports the user may view, then drop categories left empty.
  const allowedCategories = useMemo(() => {
    if (isLoading) return [];
    if (isSuperAdmin) return categories;
    return categories
      .map((c) => ({
        ...c,
        reports: c.reports.filter((r) => {
          const module = REPORT_MODULES[r.path];
          return module ? can(module, "view") : false;
        }),
      }))
      .filter((c) => c.reports.length > 0);
  }, [can, isSuperAdmin, isLoading]);

  const active =
    allowedCategories.find((c) => c.key === activeCategory) ??
    allowedCategories[0];

  const visibleReports = useMemo(() => {
    if (!active) return [];
    if (!search.trim()) return active.reports;
    const q = search.trim().toLowerCase();
    return active.reports.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q),
    );
  }, [active, search]);

  const totalReports = allowedCategories.reduce(
    (sum, c) => sum + c.reports.length,
    0,
  );

  if (isLoading || !active) {
    if (isLoading) {
      return (
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="size-10 animate-spin rounded-full border-4 border-brand-500/20 border-t-brand-500" />
        </div>
      );
    }
    return (
      <div className="rounded-2xl border border-gray-100 bg-white px-6 py-16 text-center dark:border-gray-800 dark:bg-gray-900">
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
          You do not have permission to view any reports.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-brand-500 px-6 py-7 sm:px-8">
        <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white">
              <TbReceipt2 className="size-6" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">Reports</h1>
              <p className="text-sm text-brand-100">
                Generate and review business reports across every module
              </p>
            </div>
          </div>
          <div className="relative w-full sm:w-72">
            <TbSearch className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/70" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search reports..."
              className="w-full rounded-lg border border-white/20 bg-white/10 py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-white/70 outline-none focus:border-white/40 focus:bg-white/15"
            />
          </div>
        </div>
        <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-14 right-24 size-32 rounded-full bg-white/10" />
      </div>

      {/* Body */}
      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Categories */}
        <div className="w-full shrink-0 lg:w-64">
          <div className="rounded-2xl border border-gray-100 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
            <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
              Categories
            </p>
            <div className="flex flex-col gap-1.5">
              {allowedCategories.map((c) => {
                const isActive = c.key === active.key;
                return (
                  <button
                    key={c.key}
                    onClick={() => {
                      setActiveCategory(c.key);
                      setSearch("");
                    }}
                    className={`relative flex items-center justify-between rounded-xl py-2 pl-3 pr-3 text-sm font-medium transition-colors ${
                      isActive
                        ? `${c.chipBg} ${c.chipText}`
                        : "text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/[0.03]"
                    }`}
                  >
                    {isActive && (
                      <span
                        className={`absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full ${c.chipText.replace("text-", "bg-")}`}
                      />
                    )}
                    <span className="flex items-center gap-3">
                      <span
                        className={`flex size-8 items-center justify-center rounded-lg ${
                          isActive
                            ? "bg-white/70 dark:bg-white/10"
                            : `${c.chipBg} ${c.chipText}`
                        }`}
                      >
                        {c.icon}
                      </span>
                      <span className={isActive ? "" : "text-gray-700 dark:text-gray-200"}>
                        {c.label}
                      </span>
                    </span>
                    <span
                      className={`text-xs font-semibold tabular-nums ${
                        isActive ? "" : "text-gray-400 dark:text-gray-500"
                      }`}
                    >
                      {c.reports.length}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-gray-100 px-2 pt-3 text-xs text-gray-400 dark:border-gray-800 dark:text-gray-500">
              <span>{allowedCategories.length} groups</span>
              <span>{totalReports} total</span>
            </div>
          </div>
        </div>

        {/* Reports list */}
        <div className="flex-1 rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-2.5 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
            <span className={`flex size-8 items-center justify-center rounded-lg ${active.chipBg} ${active.chipText}`}>
              {active.icon}
            </span>
            <h2 className="text-sm font-semibold text-gray-800 dark:text-white/90">
              {active.label} Reports
            </h2>
            <span className="text-xs text-gray-400 dark:text-gray-500">
              · {active.reports.length} reports
            </span>
          </div>

          {visibleReports.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-gray-400 dark:text-gray-500">
              No reports match “{search}”.
            </div>
          ) : (
            <div
              className="grid gap-3 p-4 md:grid-flow-col md:grid-cols-2 md:[grid-template-rows:repeat(var(--report-rows),auto)]"
              style={{ "--report-rows": columnRows(visibleReports.length) } as CSSProperties}
            >
              {visibleReports.map((report) => (
                <button
                  key={report.path}
                  onClick={() => navigate(report.path)}
                  className="group flex w-full items-center gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3.5 text-left shadow-theme-xs transition-all hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-theme-sm dark:border-gray-800 dark:bg-white/[0.02] dark:hover:border-brand-500/30"
                >
                  <span
                    className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${active.chipBg} ${active.chipText}`}
                  >
                    <TbReceipt2 className="size-[18px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-gray-800 dark:text-white/90">
                      {report.name}
                    </span>
                    <span className="mt-0.5 block text-xs text-gray-400 dark:text-gray-500">
                      {report.description}
                    </span>
                  </span>
                  <TbChevronRight className="size-4 shrink-0 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-500 dark:text-gray-600" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AllReportList;
