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
  TbChartLine,
} from "react-icons/tb";

export interface ReportItem {
  name: string;
  description: string;
  path: string;
}

export interface ReportCategory {
  key: string;
  label: string;
  icon: React.ReactNode;
  chipBg: string;
  chipText: string;
  reports: ReportItem[];
}

export const reportCategories: ReportCategory[] = [
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
      {
        name: "Top Salesman",
        description: "Salesmen ranked by sales, with invoices, customers, discount, payable, paid & due",
        path: "/top-salesman",
      },
      {
        name: "Upcoming Delivery Order",
        description: "Pending sales by delivery date, with customer, products and remarks",
        path: "/upcoming-delivery-order",
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

// Keep only reports the user may view, then drop categories left empty.
export const allowedReportCategories = (
  can: (module: string, action: string) => boolean,
  isSuperAdmin: boolean,
): ReportCategory[] => {
  if (isSuperAdmin) return reportCategories;
  return reportCategories
    .map((c) => ({
      ...c,
      reports: c.reports.filter((r) => {
        const module = REPORT_MODULES[r.path];
        return module ? can(module, "view") : false;
      }),
    }))
    .filter((c) => c.reports.length > 0);
};
