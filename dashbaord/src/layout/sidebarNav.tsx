import { HiOutlineAdjustments } from "react-icons/hi";
import {
  MdOutlineInventory2,
  MdOutlineLocalShipping,
  MdOutlinePointOfSale,
  MdOutlineSms,
} from "react-icons/md";
import {
  TbRosetteDiscount,
  TbShoppingCartPlus,
  TbReportAnalytics,
  TbBuildingWarehouse,
  TbUsersGroup,
  TbBuildingStore,
  TbSettings,
  TbWorld,
  TbShieldLock,
  TbBuildingCommunity,
  TbBolt,
} from "react-icons/tb";
import { FiUsers } from "react-icons/fi";
import { LuClipboardList, LuWallet } from "react-icons/lu";
import { useAuth } from "../context/AuthContext";
import { usePlatformAuth } from "../platform/PlatformAuthContext";
import {
  canSeePlatformConsole,
  PLATFORM_WORKSPACES,
} from "../platform/visibility";
import { getWorkspace } from "../lib/session";
import { GridIcon } from "../icons";
import {
  PERMISSIONS,
  REPORT_MODULES,
  DASHBOARD_BOX_MODULES,
} from "../config/permissions";

// ---------- TYPES ----------
// `action` defaults to "view". Set to "add" for "Create/Add X" links so they
// only show when the user has add permission (not just view).
export type ItemAction = "view" | "add";

export type SubSubItem = {
  name: string;
  path: string;
  module?: string;
  action?: ItemAction;
  pro?: boolean;
  new?: boolean;
};

export type SubItem = {
  name: string;
  path?: string;
  // Platform Console page: only the platform store owner sees it
  platformOnly?: boolean;
  // Seller-side page that moves into the Platform Console for the platform store
  hideOnPlatform?: boolean;
  module?: string;
  // Page covering several modules — visible when the user has any one of them.
  anyOfModules?: string[];
  action?: ItemAction;
  pro?: boolean;
  new?: boolean;
  subSubItems?: SubSubItem[];
};

export type NavItem = {
  name: string;
  icon: React.ReactNode;
  path?: string;
  module?: string;
  action?: ItemAction;
  subItems?: SubItem[];
};

export type SubmenuType =
  | "main"
  | "salesPurchase"
  | "discountManagement"
  | "stockManagement"
  | "websiteManagement"
  | "profile"
  | "accountManagement"
  | "analyticsUsers"
  | "generalSettings"
  | "others"
  | "hrManage"
  | "platformConsole";

// ---------- NAV DATA ----------
const navItems: NavItem[] = [
  {
    icon: <GridIcon />,
    name: "Dashboard",
    path: "/",
  },
  {
    name: "Product",
    icon: <MdOutlineInventory2 />,
    subItems: [
      {
        name: "Create Product",
        path: "/create-product",
        module: PERMISSIONS.PRODUCT,
        action: "add",
        pro: false,
      },
      {
        name: "Product List",
        path: "/product-list",
        module: PERMISSIONS.PRODUCT,
        pro: false,
      },
      {
        name: "Barcode Print",
        path: "/barcode-print",
        module: PERMISSIONS.BARCODE_PRINT,
        pro: false,
      },
      {
        name: "Create Category",
        path: "/create-category",
        module: PERMISSIONS.CATEGORY,
        action: "add",
        pro: false,
      },
      {
        name: "Category List",
        path: "/category-list",
        module: PERMISSIONS.CATEGORY,
        pro: false,
      },
      {
        name: "Create SubCategory",
        path: "/create-subcategory",
        module: PERMISSIONS.SUB_CATEGORY,
        action: "add",
        pro: false,
      },
      {
        name: "SubCategory List",
        path: "/subcategory-list",
        module: PERMISSIONS.SUB_CATEGORY,
        pro: false,
      },
      {
        name: "Create Brand",
        path: "/create-brand",
        module: PERMISSIONS.BRAND,
        action: "add",
        pro: false,
      },
      {
        name: "Brand List",
        path: "/brand-list",
        module: PERMISSIONS.BRAND,
        pro: false,
      },
    ],
  },
  {
    name: "Variant",
    icon: <HiOutlineAdjustments />,
    subItems: [
      {
        name: "Create Variant",
        path: "/create-variant",
        module: PERMISSIONS.VARIANT,
        action: "add",
        pro: false,
      },
      {
        name: "Variant List",
        path: "/variant-list",
        module: PERMISSIONS.VARIANT,
        pro: false,
      },
    ],
  },
  {
    name: "Purchase",
    icon: <TbShoppingCartPlus />,
    subItems: [
      {
        name: "Create Purchase",
        path: "/add-purchase",
        module: PERMISSIONS.PURCHASE,
        action: "add",
        pro: false,
      },
      {
        name: "Purchase List",
        path: "/purchase-list",
        module: PERMISSIONS.PURCHASE,
        pro: false,
      },
      {
        name: "Purchase Return",
        path: "/purchase-return",
        module: PERMISSIONS.PURCHASE_RETURN,
        pro: false,
      },
      {
        name: "Purchase Return List",
        path: "/purchase-return-list",
        module: PERMISSIONS.PURCHASE_RETURN,
        pro: false,
      },
    ],
  },
  {
    name: "Discount & Coupon",
    icon: <TbRosetteDiscount />,
    subItems: [
      {
        name: "Create Discount",
        path: "/create-discount",
        module: PERMISSIONS.DISCOUNT,
        action: "add",
        pro: false,
      },
      {
        name: "Discount List",
        path: "/discount-list",
        module: PERMISSIONS.DISCOUNT,
        pro: false,
      },
      {
        name: "Create Coupon",
        path: "/create-coupon",
        module: PERMISSIONS.COUPON,
        action: "add",
        pro: false,
      },
      {
        name: "Coupon List",
        path: "/coupon-list",
        module: PERMISSIONS.COUPON,
        pro: false,
      },
    ],
  },
  {
    name: "Web Order",
    icon: <LuClipboardList />,
    subItems: [
      {
        name: "Create Web Order",
        path: "/create-order",
        module: PERMISSIONS.ORDER,
        pro: false,
      },
      {
        name: "Web Order List",
        path: "/order-list",
        module: PERMISSIONS.ORDER,
        pro: false,
      },
      {
        name: "Incomplete Order List",
        path: "/incomplete-order-list",
        module: PERMISSIONS.INCOMPLETE_ORDER,
        pro: false,
      },
    ],
  },
  {
    name: "Courier & Merchant",
    icon: <MdOutlineLocalShipping />,
    subItems: [
      {
        name: "Create Courier Merchant",
        path: "/courier",
        module: PERMISSIONS.COURIER_MERCHANT,
        pro: false,
      },
      {
        name: "Courier Merchant List",
        path: "/courier-merchant-list",
        module: PERMISSIONS.COURIER_MERCHANT,
        pro: false,
      },
      {
        name: "Create Courier Delivery",
        path: "/create-courier-delivery",
        module: PERMISSIONS.COURIER_DELIVERY,
        action: "add",
        pro: false,
      },
      {
        name: "Courier Return List",
        path: "/courier-return-list",
        module: PERMISSIONS.COURIER_RETURN,
        pro: false,
      },
    ],
  },
  {
    name: "Website Settings",
    icon: <TbWorld />,
    subItems: [
      {
        name: "Create Website Info",
        path: "/add-site-info",
        module: PERMISSIONS.SITE_INFORMATION,
        action: "add",
        pro: false,
      },
      {
        name: "Website Info List",
        path: "/site-info-list",
        module: PERMISSIONS.SITE_INFORMATION,
        pro: false,
      },
      {
        name: "Create Outlet Info",
        path: "/add-outlet",
        module: PERMISSIONS.OUTLET_INFORMATION,
        action: "add",
        pro: false,
      },
      {
        name: "Outlet Info List",
        path: "/outlet-list",
        module: PERMISSIONS.OUTLET_INFORMATION,
        pro: false,
      },
      {
        name: "Create Web Banner",
        path: "/add-banner",
        module: PERMISSIONS.CREATE_BANNER,
        action: "add",
        pro: false,
      },
      {
        name: "Web Banner List",
        path: "/banner-list",
        module: PERMISSIONS.CREATE_BANNER,
        pro: false,
      },
      { name: "Create Discount Banner", path: "/add-discount", module: PERMISSIONS.DISCOUNT_BANNER, action: "add", pro: false },
      { name: "Discount Banner List", path: "/discount-banner-list", module: PERMISSIONS.DISCOUNT_BANNER, pro: false },
      // The storefront's "Limited offers" section
      { name: "Limited Offer", path: "/limited-offer", module: PERMISSIONS.LIMITED_OFFER, pro: false },
      {
        name: "Create Size Chart",
        path: "/create-sizechart",
        module: PERMISSIONS.SIZE_CHART,
        action: "add",
        pro: false,
      },
      {
        name: "Size Chart List",
        path: "/sizechart-list",
        module: PERMISSIONS.SIZE_CHART,
        pro: false,
      },
      {
        name: "Create Delivery Charge",
        path: "/create-delivery-charge",
        module: PERMISSIONS.DELIVERY_CHARGE,
        action: "add",
        pro: false,
      },
      {
        name: "Delivery Charge List",
        path: "/delivery-charge-list",
        module: PERMISSIONS.DELIVERY_CHARGE,
        pro: false,
      },
    ],
  },
  {
    // Time-limited sale prices on the storefront
    name: "Flash Sale",
    icon: <TbBolt />,
    subItems: [
      { name: "Create Flash Sale", path: "/flash-sale/new", module: PERMISSIONS.FLASH_SALE, action: "add", pro: false },
      { name: "Flash Sale List", path: "/flash-sale", module: PERMISSIONS.FLASH_SALE, pro: false },
    ],
  },
  {
    name: "Stock",
    icon: <TbBuildingWarehouse />,
    subItems: [
      {
        name: "View All Stock",
        path: "/view-all-stock",
        module: PERMISSIONS.VIEW_ALL_STOCK,
        pro: false,
      },
      {
        name: "Category Stock Detail",
        path: "/category-stock-detail",
        module: PERMISSIONS.CATEGORY_STOCK_DETAILS,
        pro: false,
      },
      {
        name: "Color Wise Stock",
        path: "/size-color-wise-stock",
        module: PERMISSIONS.SIZE_COLOR_WISE_STOCK,
        pro: false,
      },
      {
        name: "Size Wise Stock",
        path: "/size-wise-stock",
        module: PERMISSIONS.SIZE_WISE_STOCK,
        pro: false,
      },
      {
        name: "Low Stock",
        path: "/low-stock",
        module: PERMISSIONS.LOW_STOCK,
        pro: false,
      },
      {
        name: "Stock Adjustment",
        path: "/stock-adjustment",
        module: PERMISSIONS.STOCK_ADJUSTMENT,
        pro: false,
      },
      {
        name: "Stock Adjustment List",
        path: "/stock-adjustment-list",
        module: PERMISSIONS.STOCK_ADJUSTMENT,
        pro: false,
      },
    ],
  },
  {
    name: "All Accounts ",
    icon: <LuWallet />,
    subItems: [
      {
        name: "Create Transaction",
        path: "/add-transaction",
        module: PERMISSIONS.ADD_TRANSACTION,
        action: "add",
        pro: false,
      },
      {
        name: "Transaction List",
        path: "/transaction-list",
        module: PERMISSIONS.ADD_TRANSACTION,
        pro: false,
      },
      {
        name: "Create Money Transfer",
        path: "/add-money-transfer",
        module: PERMISSIONS.MONEY_TRANSFER,
        action: "add",
        pro: false,
      },
      {
        name: "Money Transfer List",
        path: "/money-transfer-list",
        module: PERMISSIONS.MONEY_TRANSFER,
        pro: false,
      },
      {
        name: "Create Money Handover",
        path: "/money-handover-description",
        module: PERMISSIONS.MONEY_HANDOVER,
        pro: false,
      },
      {
        name: "Money Handover List",
        path: "/money-handover-list",
        module: PERMISSIONS.MONEY_HANDOVER,
        pro: false,
      },
      {
        name: "Create Transaction Category",
        path: "/add-transaction-category",
        module: PERMISSIONS.TRANSACTION_CATEGORY,
        action: "add",
        pro: false,
      },
      {
        name: "Transaction Category List",
        path: "/transaction-category-list",
        module: PERMISSIONS.TRANSACTION_CATEGORY,
        pro: false,
      },
      {
        name: "Create Account",
        path: "/add-account",
        module: PERMISSIONS.ADD_ACCOUNT,
        action: "add",
        pro: false,
      },
      {
        name: "Account List",
        path: "/account-list",
        module: PERMISSIONS.ADD_ACCOUNT,
        pro: false,
      },
    ],
  },
  {
    name: "Reports & Analytics",
    icon: <TbReportAnalytics />,
    subItems: [
      {
        name: "All Reports",
        path: "/all-reports",
        pro: false,
      },
    ],
  },
];

const othersItems: NavItem[] = [
  {
    icon: <MdOutlineSms />,
    name: "SMS Notifications",
    subItems: [
      {
        name: "Send SMS",
        path: "/sendsms",
        module: PERMISSIONS.SEND_SMS,
        pro: false,
      },
      {
        name: "Send Due SMS",
        path: "/due-sms",
        module: PERMISSIONS.DUE_SMS,
        pro: false,
      },
      {
        name: "Send Bulk SMS",
        path: "/sendbluksms",
        module: PERMISSIONS.SEND_BULK_SMS,
        pro: false,
      },
      {
        name: "SMS Info",
        path: "/smsinfo",
        module: PERMISSIONS.SMS_INFO,
        pro: false,
      },
    ],
  },
  {
    icon: <TbShieldLock />,
    name: "User Role & Permission",
    subItems: [
      {
        name: "Create User",
        path: "/add-user",
        module: PERMISSIONS.CREATE_USER,
        action: "add",
        pro: false,
      },
      {
        name: "User List",
        path: "/userlist",
        module: PERMISSIONS.CREATE_USER,
        pro: false,
      },
      {
        name: "Create Role",
        path: "/create-role",
        module: PERMISSIONS.CREATE_ROLE,
        action: "add",
        pro: false,
      },
      {
        name: "Role List",
        path: "/role-list",
        module: PERMISSIONS.CREATE_ROLE,
        pro: false,
      },
      {
        name: "Create User Permission",
        path: "/create-user-permission",
        module: PERMISSIONS.CREATE_PERMISSION,
        action: "add",
        pro: false,
      },
      {
        name: "Assign Role Permission",
        path: "/assign-role-permission",
        module: PERMISSIONS.ASSIGN_ROLE,
        pro: false,
      },
      {
        name: "Audit User Log",
        path: "/audit-log",
        module: PERMISSIONS.AUDIT_LOG,
        pro: false,
      },
    ],
  },
  {
    name: "Settings ",
    icon: <TbSettings />,
    subItems: [
      {
        name: "Create Store Information",
        path: "/add-store-info",
        module: PERMISSIONS.STORE_INFORMATION,
        action: "add",
        pro: false,
      },
      {
        name: "Store Information List",
        path: "/store-info-list",
        module: PERMISSIONS.STORE_INFORMATION,
        pro: false,
      },
    ],
  },
];

const hrManage: NavItem[] = [
  {
    icon: <TbUsersGroup />,
    name: "Employee",
    subItems: [
      {
        name: "Create Employee",
        path: "/create-employee",
        module: PERMISSIONS.EMPLOYEE,
        action: "add",
        pro: false,
      },
      {
        name: "Employee List",
        path: "/employee-list",
        module: PERMISSIONS.EMPLOYEE,
        pro: false,
      },
      {
        name: "Create Designation",
        path: "/create-designation",
        module: PERMISSIONS.DESIGNATION,
        action: "add",
        pro: false,
      },
      {
        name: "Designation List",
        path: "/designation-list",
        module: PERMISSIONS.DESIGNATION,
        pro: false,
      },
      {
        name: "Create Department",
        path: "/create-department",
        module: PERMISSIONS.DEPARTMENT,
        action: "add",
        pro: false,
      },
      {
        name: "Department List",
        path: "/department-list",
        module: PERMISSIONS.DEPARTMENT,
        pro: false,
      },
      {
        name: "Create Section",
        path: "/create-section",
        module: PERMISSIONS.SECTION,
        action: "add",
        pro: false,
      },
      {
        name: "Section List",
        path: "/section-list",
        module: PERMISSIONS.SECTION,
        pro: false,
      },
    ],
  },
  {
    icon: <TbBuildingStore />,
    name: "Supplier",
    subItems: [
      {
        name: "Create Supplier",
        path: "/create-supplier",
        module: PERMISSIONS.SUPPLIER,
        action: "add",
        pro: false,
      },
      {
        name: "Supplier List",
        path: "/supplier-list",
        module: PERMISSIONS.SUPPLIER,
        pro: false,
      },
      {
        name: "Create Supplier Payment",
        path: "/create-supplier-payment",
        module: PERMISSIONS.SUPPLIER_PAYMENT,
        action: "add",
        pro: false,
      },
      {
        name: "Supplier Payment List",
        path: "/supplier-payment-list",
        module: PERMISSIONS.SUPPLIER_PAYMENT,
        pro: false,
      },
    ],
  },
  {
    icon: <FiUsers />,
    name: "Customer",
    subItems: [
      {
        name: "Create Customer",
        path: "/create-customer",
        module: PERMISSIONS.CUSTOMER,
        action: "add",
        pro: false,
      },
      {
        name: "Customer List",
        path: "/customer-list",
        module: PERMISSIONS.CUSTOMER,
        pro: false,
      },
      {
        name: "Customer Payment Receive",
        path: "/customer-payment-receive",
        module: PERMISSIONS.CUSTOMER_PAYMENT,
        pro: false,
      },
      {
        name: "Customer Payment Receive List",
        path: "/customer-payment-receive-list",
        module: PERMISSIONS.CUSTOMER_PAYMENT,
        pro: false,
      },
      {
        name: "Customer Advance Payment",
        path: "/customer-advance-payment",
        module: PERMISSIONS.ADVANCE_PAYMENT,
        pro: false,
      },
      {
        name: "Customer Advance Payment List",
        path: "/advance-payment-list",
        module: PERMISSIONS.ADVANCE_PAYMENT,
        pro: false,
      },
      {
        name: "Create Customer Type",
        path: "/create-customer-type",
        module: PERMISSIONS.CUSTOMER_TYPE,
        action: "add",
        pro: false,
      },
      {
        name: "Customer Type List",
        path: "/customer-type-list",
        module: PERMISSIONS.CUSTOMER_TYPE,
        pro: false,
      },
    ],
  },
  {
    icon: <MdOutlinePointOfSale />,
    name: "Sales",
    subItems: [
      {
        name: "Add Retail Sales",
        path: "/create-retail-sales",
        module: PERMISSIONS.RETAIL_SALES,
        action: "add",
        pro: false,
      },
      {
        name: "Add Wholesale Sales",
        path: "/create-whole-sales",
        module: PERMISSIONS.WHOLESALE_SALES,
        action: "add",
        pro: false,
      },
      {
        name: "Sales History",
        path: "/sales-history",
        module: PERMISSIONS.SALES_HISTORY,
        pro: false,
      },
      {
        name: "Add Retailsale Order",
        path: "/retail-sale-order",
        module: PERMISSIONS.RETAIL_SALES_ORDER,
        action: "add",
        pro: false,
      },
      {
        name: "Add Wholesale Order",
        path: "/whole-sale-order",
        module: PERMISSIONS.WHOLE_SALES_ORDER,
        action: "add",
        pro: false,
      },
      {
        name: "Order List",
        path: "/sale-order-list",
        anyOfModules: [
          PERMISSIONS.RETAIL_SALES_ORDER,
          PERMISSIONS.WHOLE_SALES_ORDER,
        ],
        pro: false,
      },
      {
        name: "Draft Order List",
        path: "/draft-order-list",
        module: PERMISSIONS.DRAFT_ORDER,
        pro: false,
      },
      {
        name: "Sales Return",
        path: "/sales-return",
        module: PERMISSIONS.SALES_RETURN,
        action: "add",
        pro: false,
      },
      {
        name: "Sales Return List",
        path: "/sales-return-list",
        module: PERMISSIONS.SALES_RETURN,
        pro: false,
      },
    ],
  },
];

const salesPurchaseItems: NavItem[] = [
  ...navItems.filter(
    (item) =>
      item.name === "Product" ||
      item.name === "Variant" ||
      item.name === "Purchase",
  ),
  ...hrManage.filter((item) => item.name === "Sales"),
];

const discountManagementItems = navItems.filter(
  (item) => item.name === "Discount & Coupon",
);
const stockManagementItems = navItems.filter((item) => item.name === "Stock");
const websiteManagementItems: NavItem[] = navItems.filter(
  (item) =>
    item.name === "Web Order" ||
    item.name === "Courier & Merchant" ||
    item.name === "Website Settings" ||
    item.name === "Limited Offer" ||
    item.name === "Flash Sale",
);
const profileItems: NavItem[] = ["Customer", "Supplier", "Employee"].flatMap((name) =>
  hrManage.filter((item) => item.name === name),
);
const accountManagementItems = navItems.filter(
  (item) => item.name.trim() === "All Accounts",
);
const analyticsUsersItems: NavItem[] = [
  ...navItems.filter((item) => item.name === "Reports & Analytics"),
  ...othersItems.filter(
    (item) =>
      item.name === "SMS Notifications" ||
      item.name === "User Role & Permission",
  ),
];
const generalSettingsItems = othersItems.filter(
  (item) => item.name.trim() === "Settings",
);
const otherSidebarItems: NavItem[] = [
  ...othersItems.filter(
    (item) =>
      item.name !== "SMS Notifications" &&
      item.name !== "User Role & Permission" &&
      item.name.trim() !== "Settings",
  ),
];

const platformConsoleItems: NavItem[] = [
  {
    name: "Platform Console",
    icon: <TbBuildingCommunity />,
    subItems: [
      {
        name: "Dashboard",
        path: "/platform/dashboard",
        platformOnly: true,
        pro: false,
      },
      {
        name: "Sellers",
        path: "/platform/sellers",
        platformOnly: true,
        pro: false,
      },
      // No "Store Settings" page: a store's settings (integrations, webhook
      // URLs) are managed only by the platform, on that seller's own page
      // (Sellers → a seller), over the platform token via settingsApi.
      // Sellers have no settings page of their own.
      {
        name: "Operators",
        path: "/platform/operators",
        platformOnly: true,
        pro: false,
      },
    ],
  },
];

export type SidebarSection = {
  type: SubmenuType;
  label: string;
  items: NavItem[];
};

// ---------- VISIBLE SECTIONS ----------
// What the signed-in person may open. The sidebar renders it, and the header
// search looks through it, so neither can offer a page the other hides.
export const useSidebarSections = (): SidebarSection[] => {
  const { can, isSuperAdmin, isOwner, isLoading } = useAuth();
  const { operator } = usePlatformAuth();
  // An operator signed into the console sees it whatever store session sits
  // behind them — including none at all, which is how a platform-only sign-in
  // arrives here.
  const showPlatformPages =
    Boolean(operator) ||
    (!isLoading &&
      canSeePlatformConsole({
        workspace: getWorkspace(),
        isOwner,
        allowed: PLATFORM_WORKSPACES,
      }));

  // ---------- PERMISSION FILTER ----------
  const isItemVisible = (
    module?: string,
    action: ItemAction = "view",
  ): boolean => {
    if (isLoading) return false; // hide all until auth resolves — prevents unauthorized flash
    if (isSuperAdmin) return true;
    if (!module) return true; // items with no module (e.g. Dashboard) always show
    return can(module, action);
  };

  const filterSubSubItems = (items: SubSubItem[]): SubSubItem[] =>
    items.filter((i) => isItemVisible(i.module, i.action));

  const filterSubItems = (items: SubItem[]): SubItem[] =>
    items
      .map((item) => ({
        ...item,
        subSubItems: item.subSubItems
          ? filterSubSubItems(item.subSubItems)
          : undefined,
      }))
      .filter((item) => {
        if (item.platformOnly) return showPlatformPages;
        if (item.hideOnPlatform && showPlatformPages) return false;
        if (item.subSubItems !== undefined) return item.subSubItems.length > 0;
        if (item.anyOfModules)
          return item.anyOfModules.some((m) => isItemVisible(m, item.action));
        return isItemVisible(item.module, item.action);
      });

  const filterNavItems = (items: NavItem[]): NavItem[] =>
    items
      .map((item) => ({
        ...item,
        subItems: item.subItems ? filterSubItems(item.subItems) : undefined,
      }))
      .filter((item) => {
        if (item.subItems !== undefined) return item.subItems.length > 0;
        return isItemVisible(item.module, item.action);
      });

  // Dashboard is a hub of independently-granted boxes, so it has no single
  // module. Show it only when at least one box is visible to the user.
  const canViewDashboard = DASHBOARD_BOX_MODULES.some((m) =>
    isItemVisible(m, "view"),
  );

  const visibleNavItems = filterNavItems(
    navItems.filter(
      (item) =>
        (item.name !== "Dashboard" || canViewDashboard) &&
        item.name !== "Product" &&
        item.name !== "Variant" &&
        item.name !== "Purchase" &&
        item.name !== "Discount & Coupon" &&
        item.name !== "Stock" &&
        item.name !== "Courier & Merchant" &&
        item.name !== "Website Settings" &&
        item.name !== "Limited Offer" &&
        item.name !== "Flash Sale" &&
        item.name !== "Web Order" &&
        item.name.trim() !== "All Accounts" &&
        item.name !== "Reports & Analytics",
    ),
  );
  const visibleSalesPurchaseItems = filterNavItems(salesPurchaseItems);
  const visibleDiscountManagementItems = filterNavItems(
    discountManagementItems,
  );
  const visibleStockManagementItems = filterNavItems(stockManagementItems);
  const visibleWebsiteManagementItems = filterNavItems(websiteManagementItems);
  const visibleProfileItems = filterNavItems(profileItems);
  const visibleAccountManagementItems = filterNavItems(accountManagementItems);
  // "All Reports" has no single module — it is a hub. Show it only when the user
  // can view at least one report inside it, otherwise the group renders empty.
  const canViewAnyReport = Object.values(REPORT_MODULES).some((m) =>
    isItemVisible(m, "view"),
  );

  const visibleAnalyticsUsersItems = filterNavItems(analyticsUsersItems).filter(
    (item) => item.name !== "Reports & Analytics" || canViewAnyReport,
  );
  const visibleGeneralSettingsItems = filterNavItems(generalSettingsItems);
  const visiblePlatformConsoleItems = filterNavItems(platformConsoleItems);
  const visibleOthersItems = filterNavItems(otherSidebarItems);
  const visibleHrManage = filterNavItems(
    hrManage.filter(
      (item) =>
        item.name !== "Sales" &&
        item.name !== "Customer" &&
        item.name !== "Supplier" &&
        item.name !== "Employee",
    ),
  );

  // Section headings render only when the section has at least one visible item,
  // so a permission-limited user never sees an empty group label.
  const sidebarSections: SidebarSection[] = [
    { type: "main", label: "Menu", items: visibleNavItems },
    {
      type: "salesPurchase",
      label: "Sales Purchase",
      items: visibleSalesPurchaseItems,
    },
    {
      type: "discountManagement",
      label: "Discount Management",
      items: visibleDiscountManagementItems,
    },
    {
      type: "stockManagement",
      label: "Stock Management",
      items: visibleStockManagementItems,
    },
    {
      type: "websiteManagement",
      label: "Website Management",
      items: visibleWebsiteManagementItems,
    },
    { type: "profile", label: "Profile", items: visibleProfileItems },
    {
      type: "accountManagement",
      label: "Accounts Management",
      items: visibleAccountManagementItems,
    },
    {
      type: "analyticsUsers",
      label: "Analytics & Users",
      items: visibleAnalyticsUsersItems,
    },
    {
      type: "platformConsole",
      label: "Platform Console",
      items: visiblePlatformConsoleItems,
    },
    {
      type: "generalSettings",
      label: "General Settings",
      items: visibleGeneralSettingsItems,
    },
    { type: "others", label: "Others", items: visibleOthersItems },
    { type: "hrManage", label: "Human Resource", items: visibleHrManage },
  ];

  return sidebarSections;
};
