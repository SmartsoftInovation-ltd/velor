import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../../context/AuthContext";
import { REPORT_MODULES } from "../../config/permissions";
import {
  TbShoppingCartPlus,
  TbTruckDelivery,
  TbReceipt2,
  TbWallet,
  TbBox,
  TbChevronRight,
  TbSearch,
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
        description: "Full transaction ledger for a date range",
        path: "/transaction-report",
      },
      {
        name: "Transaction Summary",
        description: "Inflow vs outflow summary by date",
        path: "/transaction-summary",
      },
      {
        name: "Cash Ledger",
        description: "Cash account movement, opening to closing balance",
        path: "/cash-ledger",
      },
      {
        name: "Transaction Account Wise",
        description: "Transactions grouped per account",
        path: "/transaction-account-wise",
      },
      {
        name: "Account Transaction Summary",
        description: "Per-account running summary",
        path: "/account-transaction-summary",
      },
      {
        name: "Account Balance",
        description: "Live balance across all accounts",
        path: "/account-balance",
      },
      {
        name: "Fund Handover",
        description: "Cash handover records between shifts",
        path: "/fund-handover",
      },
    ],
  },
];

const AllReportList = () => {
  const navigate = useNavigate();
  const { can, isSuperAdmin, isLoading } = useAuth();
  const [activeCategory, setActiveCategory] = useState(categories[0].key);
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
                const isActive = c.key === activeCategory;
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
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {visibleReports.map((report) => (
                <button
                  key={report.path}
                  onClick={() => navigate(report.path)}
                  className="group flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.03]"
                >
                  <span className="mt-0.5 size-2 shrink-0 rounded-full bg-emerald-500" />
                  <span className="flex-1">
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
