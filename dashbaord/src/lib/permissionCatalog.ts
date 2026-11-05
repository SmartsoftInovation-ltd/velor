// The module catalog the Role & Permission screens show: every permission,
// grouped as the sidebar groups the screens, and which actions each one has.
// Shared by Assign Role Permission and Create User Permission so the two can
// never list different modules. A permission only shows once it exists in the
// platform's catalog (backend/src/seeder/permissionSeeder.js).
import { MdOutlineInventory2, MdSecurity, MdDashboard } from "react-icons/md";
import { TbBrandBootstrap, TbRosetteDiscount, TbRulerMeasure, TbReportAnalytics, TbPackage, TbSettings } from "react-icons/tb";
import { HiOutlineAdjustments } from "react-icons/hi";

export type Action = "view" | "add" | "edit" | "delete" | "print";

const ALL_ACTIONS: Action[] = ["view", "add", "edit", "delete"];
const REPORT_ACTIONS: Action[] = ["view", "print"];
const PRINTABLE_ACTIONS: Action[] = ["view", "add", "edit", "delete", "print"];
// Dashboard boxes are read-only widgets — the only meaningful action is view.
const VIEW_ONLY_ACTIONS: Action[] = ["view"];

// Modules where a Print button was added on their list page — these get a Print toggle
// alongside the standard CRUD actions.
const PRINTABLE_MODULES = new Set([
  "Purchase",
  "Purchase Return",
  "Employee",
  "Supplier",
  "Supplier Payment",
  "Customer Payment",
  "Advance Payment",
  "Add Transaction",
  "Money Transfer",
]);

// Every report on the /all-reports hub, grouped as the hub groups them. Each
// is its own permission, so a role can be given any mix of reports.
const REPORT_GROUPS: { label: string; modules: string[] }[] = [
  {
    label: "Purchase Report",
    modules: ["Purchase Invoice", "Purchase Product Report", "Purchase Summary", "Purchase Return Report", "Purchase Return Summary"],
  },
  { label: "Order Report", modules: ["Order Invoice", "Order Status Report"] },
  {
    label: "Sales Report",
    modules: [
      "Sales Invoice Report", "Sales Product Report", "Sales Summary Report", "Top Sales Product Report",
      "Push Sales Product Report", "Product Sales Return Report", "Product Sales Return Summary Report",
      "User Sales Invoice Report", "User Sales Product Report", "Top User Report",
      "Salesman Sales Invoice Report", "Salesman Sales Product Report", "Top Salesman Report",
      "Upcoming Delivery Order Report",
    ],
  },
  { label: "Profit Report", modules: ["Invoice Profit Report", "Product Profit Report"] },
  {
    label: "Customer Report",
    modules: [
      "Customer Sales Invoice Report", "Customer Sales Product Report", "Customer Sales Summary Report",
      "Customer Payment Report", "Customer Balance Summary Report", "Customer Ledger Report", "Customer Due List Report",
      "Customer Invoice Profit Report", "Top Customer Report",
    ],
  },
  {
    label: "Supplier Report",
    modules: [
      "Supplier Purchase Invoice Report", "Supplier Payment Report", "Supplier Ledger Report",
      "Supplier Balance Summary Report", "Supplier Dues Report",
    ],
  },
  {
    label: "Stock Report",
    modules: [
      "Stock Report", "Stock Details Report", "Product Ledger Report", "Size Color Stock Report",
      "Size Wise Stock Report", "Stock Adjustment Report", "Low Stock Report",
    ],
  },
  {
    label: "Accounts Report",
    modules: [
      "Transaction Report", "Transaction Summary", "All Transaction Summary", "Accounts Ledger", "Account Day Transaction", "Cash Ledger", "Transaction Account Wise",
      "Account Transaction Summary", "Account Balance", "Fund Handover",
    ],
  },
  { label: "Employee Report", modules: ["Employee List Report", "Employee Payment Report"] },
];

const REPORT_MODULES = new Set([
  ...REPORT_GROUPS.flatMap((g) => g.modules),
  "Barcode Print",
]);

const DASHBOARD_MODULES = [
  "Dashboard",
  "Dashboard Total Invoices",
  "Dashboard Total Sale",
  "Dashboard Total Transaction",
  "Dashboard Accounts Balance",
  "Dashboard Inventory Items",
  "Dashboard Customer",
  "Dashboard Supplier",
  "Dashboard Employee",
  "Dashboard Purchase Items",
  "Dashboard Sold Items",
  "Dashboard Inventory Value",
  "Dashboard Stock Cost Value",
  "Dashboard Total Products",
  "Dashboard Supplier Payment",
  "Dashboard Customer Due Payment",
  "Dashboard Revenue Trend",
  "Dashboard Sales By Type",
  "Dashboard Accounts Balance List",
  "Dashboard Recent Sales",
  "Dashboard Top Selling Products",
  "Dashboard Inflow Transactions",
  "Dashboard Outflow Transactions",
  "Dashboard Day Cash Summary",
  "Dashboard Payment Status",
  "Dashboard Low Stock Alert",
];

const DASHBOARD_MODULE_SET = new Set(DASHBOARD_MODULES);

// The parent "Dashboard" permission gates the page itself; the rest are the
// individual widgets on it. Granting a widget without the page would hide the
// widget anyway, so the parent is switched on alongside it.
export const DASHBOARD_PARENT = "Dashboard";
export const isDashboardWidget = (name: string): boolean =>
  DASHBOARD_MODULE_SET.has(name) && name !== DASHBOARD_PARENT;

export const actionsForModule = (name: string): Action[] => {
  if (DASHBOARD_MODULE_SET.has(name)) return VIEW_ONLY_ACTIONS;
  if (REPORT_MODULES.has(name)) return REPORT_ACTIONS;
  if (PRINTABLE_MODULES.has(name)) return PRINTABLE_ACTIONS;
  return ALL_ACTIONS;
};

// ---------- Module groups ----------
// The same sections, menus and order as the sidebar (layout/AppSidebar.tsx):
// each group is one sidebar menu, and `section` is the sidebar heading it sits
// under. Keep the two in step when a menu moves.
export interface ModuleGroup {
  section: string;
  label: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: React.ComponentType<any>;
  color: string;
  modules: string[];
}

export const MODULE_GROUPS: ModuleGroup[] = [
  // Menu
  { section: "Menu", label: "Dashboard", icon: MdDashboard, color: "from-slate-500 to-gray-700", modules: DASHBOARD_MODULES },

  // Sales Purchase
  { section: "Sales Purchase", label: "Product", icon: MdOutlineInventory2, color: "from-blue-500 to-blue-600", modules: ["Product", "Barcode Print", "Category", "Sub Category", "Brand"] },
  { section: "Sales Purchase", label: "Variant", icon: HiOutlineAdjustments, color: "from-cyan-500 to-teal-600", modules: ["Variant"] },
  { section: "Sales Purchase", label: "Purchase", icon: TbBrandBootstrap, color: "from-orange-500 to-amber-600", modules: ["Purchase", "Purchase Return"] },
  {
    section: "Sales Purchase", label: "Sales", icon: MdSecurity, color: "from-emerald-500 to-green-700",
    modules: ["Retail Sales", "Wholesale Sales", "Sales History", "Retail Sale Order", "Whole Sale Order", "Draft Order", "Sales Return"],
  },

  // Discount Management
  { section: "Discount Management", label: "Discount & Coupon", icon: TbRosetteDiscount, color: "from-pink-500 to-rose-600", modules: ["Discount", "Coupon"] },

  // Stock Management
  {
    section: "Stock Management", label: "Stock", icon: TbPackage, color: "from-yellow-500 to-orange-500",
    modules: ["View All Stock", "Category Stock Details", "Size & Color Wise Stock", "Size Wise Stock", "Low Stock", "Stock Adjustment"],
  },

  // Website Management
  { section: "Website Management", label: "Order", icon: TbBrandBootstrap, color: "from-green-500 to-emerald-600", modules: ["Order", "Incomplete Order", "Chat"] },
  { section: "Website Management", label: "Courier", icon: TbBrandBootstrap, color: "from-indigo-500 to-blue-700", modules: ["Courier Merchant", "Courier Delivery", "Courier Return"] },
  { section: "Website Management", label: "Delivery Charge", icon: TbBrandBootstrap, color: "from-indigo-400 to-sky-600", modules: ["Delivery Charge"] },
  { section: "Website Management", label: "Banner", icon: TbRulerMeasure, color: "from-gray-500 to-slate-600", modules: ["Create Banner"] },
  { section: "Website Management", label: "Limited Offer", icon: TbRosetteDiscount, color: "from-rose-400 to-pink-600", modules: ["Limited Offer"] },
  { section: "Website Management", label: "Promo Banner", icon: TbRulerMeasure, color: "from-fuchsia-400 to-pink-600", modules: ["Discount Banner"] },
  { section: "Website Management", label: "Flash Sale", icon: TbRosetteDiscount, color: "from-amber-400 to-orange-600", modules: ["Flash Sale"] },
  { section: "Website Management", label: "Size Chart", icon: HiOutlineAdjustments, color: "from-teal-400 to-cyan-600", modules: ["Size Chart"] },

  // Profile
  { section: "Profile", label: "Customer", icon: MdSecurity, color: "from-red-500 to-rose-600", modules: ["Customer Type", "Customer", "Customer Payment", "Advance Payment"] },
  { section: "Profile", label: "Supplier", icon: MdSecurity, color: "from-lime-500 to-green-600", modules: ["Supplier", "Supplier Payment"] },
  { section: "Profile", label: "Employee Management", icon: MdSecurity, color: "from-sky-500 to-blue-600", modules: ["Employee", "Designation", "Department", "Section"] },

  // Accounts Management
  {
    section: "Accounts Management", label: "All Accounts", icon: TbPackage, color: "from-teal-500 to-cyan-600",
    modules: ["Add Transaction", "Transaction Category", "Add Account", "Money Transfer", "Money Handover"],
  },

  // Analytics & Users: Reports & Analytics (one group per report category), SMS, Role & Permission
  ...REPORT_GROUPS.map((g) => ({
    section: "Analytics & Users", label: g.label, icon: TbReportAnalytics, color: "from-slate-500 to-gray-700", modules: g.modules,
  })),
  { section: "Analytics & Users", label: "SMS Notification", icon: MdSecurity, color: "from-fuchsia-500 to-purple-600", modules: ["Send SMS", "Send Bulk SMS", "SMS Info", "Due SMS"] },
  { section: "Analytics & Users", label: "Role & Permission", icon: MdDashboard, color: "from-violet-500 to-purple-600", modules: ["Create User", "Create Role", "Create Permission", "Assign Role", "Audit Log"] },

  // General Settings
  { section: "General Settings", label: "Settings", icon: TbSettings, color: "from-zinc-500 to-neutral-700", modules: ["Site Information", "Outlet Information", "Store Information"] },
];
