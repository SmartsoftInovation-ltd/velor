import { useCallback, useEffect, useState } from "react";
import { HiOutlineAdjustments } from "react-icons/hi";
import {
  MdOutlineInventory2,
  MdOutlineLocalShipping,
  MdOutlinePointOfSale,
  MdOutlineSms,
} from "react-icons/md";
import {
  TbRosetteDiscount,
  TbRulerMeasure,
  TbShoppingCartPlus,
  TbReportAnalytics,
  TbBuildingWarehouse,
  TbUsersGroup,
  TbBuildingStore,
  TbSettings,
  TbShieldLock,
  TbBuildingCommunity,
} from "react-icons/tb";
import { FiUsers } from "react-icons/fi";
import { LuClipboardList, LuWallet } from "react-icons/lu";
import { Link, useLocation } from "react-router";
import { useSidebar } from "../context/SidebarContext";
import { useAuth } from "../context/AuthContext";
import { canSeePlatformConsole, PLATFORM_WORKSPACES } from "../platform/visibility";
import { getWorkspace } from "../lib/session";
import { ChevronDownIcon, GridIcon, HorizontaLDots } from "../icons";
import {
  PERMISSIONS,
  REPORT_MODULES,
  DASHBOARD_BOX_MODULES,
} from "../config/permissions";

// ---------- TYPES ----------
// `action` defaults to "view". Set to "add" for "Create/Add X" links so they
// only show when the user has add permission (not just view).
type ItemAction = "view" | "add";

type SubSubItem = {
  name: string;
  path: string;
  module?: string;
  action?: ItemAction;
  pro?: boolean;
  new?: boolean;
};

type SubItem = {
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

type NavItem = {
  name: string;
  icon: React.ReactNode;
  path?: string;
  module?: string;
  action?: ItemAction;
  subItems?: SubItem[];
};

type SubmenuType =
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
    name: "Size Chart",
    icon: <TbRulerMeasure />,
    subItems: [
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
    ],
  },
  {
    name: "Purchase",
    icon: <TbShoppingCartPlus />,
    subItems: [
      {
        name: "Add Purchase",
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
    name: "Discount",
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
    name: "Order",
    icon: <LuClipboardList />,
    subItems: [
      {
        name: "Order List",
        path: "/order-list",
        module: PERMISSIONS.ORDER,
        pro: false,
      },
      {
        name: "Incomplete Orders",
        path: "/incomplete-order-list",
        module: PERMISSIONS.INCOMPLETE_ORDER,
        pro: false,
      },
    ],
  },
  {
    name: "Courier",
    icon: <MdOutlineLocalShipping />,
    subItems: [
      {
        name: "Courier Merchant",
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
    name: "Delivery Charge",
    icon: <MdOutlineLocalShipping />,
    subItems: [
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
    ],
  },
  {
    name: "All Accounts ",
    icon: <LuWallet />,
    subItems: [
      {
        name: "Add Transaction",
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
        name: "Transaction Category List",
        path: "/transaction-category-list",
        module: PERMISSIONS.TRANSACTION_CATEGORY,
        pro: false,
      },
      {
        name: "Account List",
        path: "/account-list",
        module: PERMISSIONS.ADD_ACCOUNT,
        pro: false,
      },
      {
        name: "Add Money Transfer",
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
        name: "Money Handover",
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
    name: "SMS Notification",
    subItems: [
      {
        name: "Send SMS",
        path: "/sendsms",
        module: PERMISSIONS.SEND_SMS,
        pro: false,
      },
      {
        name: "Send Bluk SMS",
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
      {
        name: "Due SMS",
        path: "/due-sms",
        module: PERMISSIONS.SEND_SMS,
        pro: false,
      },
    ],
  },
  {
    icon: <TbShieldLock />,
    name: "Role & Permission",
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
        name: "Create User Permission",
        path: "/create-user-permission",
        module: PERMISSIONS.CREATE_PERMISSION,
        action: "add",
        pro: false,
      },
      {
        name: "Assign Role Permission",
        path: "/assign-role-permission",
        module: PERMISSIONS.CREATE_PERMISSION,
        pro: false,
      },
      {
        name: "Audit Log",
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
        name: "Banner",
        subSubItems: [
          {
            name: "Add Banner",
            path: "/add-banner",
            module: PERMISSIONS.CREATE_BANNER,
            action: "add",
            pro: false,
          },
          {
            name: "Banner List",
            path: "/banner-list",
            module: PERMISSIONS.CREATE_BANNER,
            pro: false,
          },
        ],
      },
      {
        name: "Store Settings",
        path: "/store-settings",
        module: PERMISSIONS.STORE_SETTINGS,
        hideOnPlatform: true,
        pro: false,
      },
      {
        name: "Site Information",
        subSubItems: [
          {
            name: "Add Site Info",
            path: "/add-site-info",
            module: PERMISSIONS.SITE_INFORMATION,
            action: "add",
            pro: false,
          },
          {
            name: "Site Info List",
            path: "/site-info-list",
            module: PERMISSIONS.SITE_INFORMATION,
            pro: false,
          },
        ],
      },
      {
        name: "Outlet Information",
        subSubItems: [
          {
            name: "Add Outlet",
            path: "/add-outlet",
            module: PERMISSIONS.OUTLET_INFORMATION,
            action: "add",
            pro: false,
          },
          {
            name: "Outlet List",
            path: "/outlet-list",
            module: PERMISSIONS.OUTLET_INFORMATION,
            pro: false,
          },
        ],
      },
      {
        name: "Store Information",
        subSubItems: [
          {
            name: "Add Store Info",
            path: "/add-store-info",
            module: PERMISSIONS.SITE_INFORMATION,
            action: "add",
            pro: false,
          },
          {
            name: "Store Info List",
            path: "/store-info-list",
            module: PERMISSIONS.SITE_INFORMATION,
            pro: false,
          },
        ],
      },
      {
        name: "Discount Banner",
        subSubItems: [
          {
            name: "Add Discount Banner",
            path: "/add-discount",
            module: PERMISSIONS.DISCOUNT_BANNER,
            action: "add",
            pro: false,
          },
          {
            name: "Discount Banner List",
            path: "/discount-banner-list",
            module: PERMISSIONS.DISCOUNT_BANNER,
            pro: false,
          },
        ],
      },
    ],
  },
];

const hrManage: NavItem[] = [
  {
    icon: <TbUsersGroup />,
    name: "Employee Management",
    subItems: [
      {
        name: "Add New Employee",
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
        name: "Add Designation",
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
        name: "Add Department",
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
        name: "Add Section",
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
        name: "Add Supplier",
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
        name: "Add Supplier Payment",
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
        name: "Customer Type List",
        path: "/customer-type-list",
        module: PERMISSIONS.CUSTOMER_TYPE,
        pro: false,
      },
      {
        name: "Add Customer",
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
        name: "Advance Payment Receive",
        path: "/customer-advance-payment",
        module: PERMISSIONS.ADVANCE_PAYMENT,
        pro: false,
      },
      {
        name: "Advance Payment Receive List",
        path: "/advance-payment-list",
        module: PERMISSIONS.ADVANCE_PAYMENT,
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
        name: "Sales Return",
        path: "/sales-return",
        module: PERMISSIONS.RETAIL_SALES,
        action: "add",
        pro: false,
      },
      {
        name: "Sales Return List",
        path: "/sales-return-list",
        module: PERMISSIONS.RETAIL_SALES,
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
        module: PERMISSIONS.SALES_HISTORY,
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
  (item) => item.name === "Discount",
);
const stockManagementItems = navItems.filter((item) => item.name === "Stock");
const websiteManagementItems = navItems.filter(
  (item) =>
    item.name === "Courier" ||
    item.name === "Order" ||
    item.name === "Delivery Charge",
);
const profileItems = hrManage.filter(
  (item) =>
    item.name === "Customer" ||
    item.name === "Supplier" ||
    item.name === "Employee Management",
);
const accountManagementItems = navItems.filter(
  (item) => item.name.trim() === "All Accounts",
);
const analyticsUsersItems: NavItem[] = [
  ...navItems.filter((item) => item.name === "Reports & Analytics"),
  ...othersItems.filter(
    (item) =>
      item.name === "SMS Notification" || item.name === "Role & Permission",
  ),
];
const generalSettingsItems = othersItems.filter(
  (item) => item.name.trim() === "Settings",
);
const otherSidebarItems: NavItem[] = [
  ...navItems.filter((item) => item.name === "Size Chart"),
  ...othersItems.filter(
    (item) =>
      item.name !== "SMS Notification" &&
      item.name !== "Role & Permission" &&
      item.name.trim() !== "Settings",
  ),
];

const platformConsoleItems: NavItem[] = [
  {
    name: "Platform Console",
    icon: <TbBuildingCommunity />,
    subItems: [
      { name: "Sellers", path: "/platform/sellers", platformOnly: true, pro: false },
      { name: "Store Settings", path: "/store-settings", platformOnly: true, pro: false },
      { name: "Operators", path: "/platform/operators", platformOnly: true, pro: false },
    ],
  },
];

// ---------- COMPONENT ----------
const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered, toggleSidebar } =
    useSidebar();
  const { can, isSuperAdmin, isOwner, isLoading } = useAuth();
  const showPlatformPages =
    !isLoading && canSeePlatformConsole({ workspace: getWorkspace(), isOwner, allowed: PLATFORM_WORKSPACES });
  const location = useLocation();

  const [openSubmenu, setOpenSubmenu] = useState<{
    type: SubmenuType;
    index: number;
  } | null>(null);

  const [openSubSubMenu, setOpenSubSubMenu] = useState<{
    parentIndex: number;
    subIndex: number;
  } | null>(null);

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
        item.name !== "Discount" &&
        item.name !== "Stock" &&
        item.name !== "Courier" &&
        item.name !== "Delivery Charge" &&
        item.name !== "Order" &&
        item.name !== "Size Chart" &&
        item.name.trim() !== "All Accounts" &&
        item.name !== "Reports & Analytics",
    ),
  );
  const visibleSalesPurchaseItems = filterNavItems(salesPurchaseItems);
  const visibleDiscountManagementItems = filterNavItems(discountManagementItems);
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
        item.name !== "Employee Management",
    ),
  );

  // Section headings render only when the section has at least one visible item,
  // so a permission-limited user never sees an empty group label.
  const sidebarSections: {
    type: SubmenuType;
    label: string;
    items: NavItem[];
  }[] = [
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

  // ---------- ACTIVE STATE ----------
  const isActive = useCallback(
    (path: string) => location.pathname === path,
    [location.pathname],
  );

  useEffect(() => {
    let submenuMatched = false;

    sidebarSections.forEach(({ type, items }) => {
      items.forEach((nav, index) => {
        if (nav.subItems) {
          nav.subItems.forEach((subItem, subIndex) => {
            if (subItem.subSubItems) {
              subItem.subSubItems.forEach((subSubItem) => {
                if (isActive(subSubItem.path)) {
                  setOpenSubmenu({ type, index });
                  setOpenSubSubMenu({ parentIndex: index, subIndex });
                  submenuMatched = true;
                }
              });
            } else if (subItem.path && isActive(subItem.path)) {
              setOpenSubmenu({ type, index });
              submenuMatched = true;
            }
          });
        }
      });
    });

    if (!submenuMatched) {
      setOpenSubmenu(null);
      setOpenSubSubMenu(null);
    }
  }, [location, isActive]);

  const handleSubmenuToggle = (
    index: number,
    menuType: NonNullable<typeof openSubmenu>["type"],
  ) => {
    setOpenSubmenu((prevOpenSubmenu) => {
      if (
        prevOpenSubmenu &&
        prevOpenSubmenu.type === menuType &&
        prevOpenSubmenu.index === index
      ) {
        setOpenSubSubMenu(null);
        return null;
      }
      return { type: menuType, index };
    });
  };

  const renderMenuItems = (
    items: NavItem[],
    menuType: NonNullable<typeof openSubmenu>["type"],
  ) => (
    <ul className="flex flex-col gap-[5px]">
      {items.map((nav, index) => (
        <li key={nav.name}>
          {nav.subItems ? (
            <button
              onClick={() => handleSubmenuToggle(index, menuType)}
              className={`menu-item group ${
                openSubmenu?.type === menuType && openSubmenu?.index === index
                  ? "menu-item-active"
                  : "menu-item-inactive"
              } cursor-pointer ${
                !isExpanded && !isHovered
                  ? "lg:justify-center"
                  : "lg:justify-start"
              }`}
            >
              <span
                className={`menu-item-icon-size ${
                  openSubmenu?.type === menuType && openSubmenu?.index === index
                    ? "menu-item-icon-active"
                    : "menu-item-icon-inactive"
                }`}
              >
                {nav.icon}
              </span>
              {(isExpanded || isHovered || isMobileOpen) && (
                <span className="truncate">{nav.name}</span>
              )}
              {(isExpanded || isHovered || isMobileOpen) && (
                <ChevronDownIcon
                  className={`ml-auto size-4 shrink-0 transition-transform duration-200 ${
                    openSubmenu?.type === menuType &&
                    openSubmenu?.index === index
                      ? "rotate-180 text-brand-500 dark:text-brand-400"
                      : "text-gray-400 dark:text-gray-500"
                  }`}
                />
              )}
            </button>
          ) : (
            nav.path && (
              <Link
                to={nav.path}
                className={`menu-item group ${
                  isActive(nav.path) ? "menu-item-active" : "menu-item-inactive"
                } ${
                  !isExpanded && !isHovered
                    ? "lg:justify-center"
                    : "lg:justify-start"
                }`}
              >
                <span
                  className={`menu-item-icon-size ${
                    isActive(nav.path)
                      ? "menu-item-icon-active"
                      : "menu-item-icon-inactive"
                  }`}
                >
                  {nav.icon}
                </span>
                {(isExpanded || isHovered || isMobileOpen) && (
                  <span className="truncate">{nav.name}</span>
                )}
              </Link>
            )
          )}

          {/* ---------- SUBMENU ---------- */}
          {nav.subItems && (isExpanded || isHovered || isMobileOpen) && (
            <div
              className={`overflow-hidden transition-all duration-300 ease-in-out ${
                openSubmenu?.type === menuType && openSubmenu?.index === index
                  ? "max-h-[1200px] mt-1"
                  : "max-h-0"
              }`}
            >
              <ul className="ml-[19px] space-y-[6px] border-l border-gray-200 pl-2 dark:border-gray-800">
                {nav.subItems.map((subItem, subIndex) => {
                  const isSubSubOpen =
                    openSubSubMenu?.parentIndex === index &&
                    openSubSubMenu?.subIndex === subIndex;

                  return (
                    <li key={subItem.name}>
                      {subItem.subSubItems ? (
                        <>
                          <button
                            onClick={() =>
                              requestAnimationFrame(() =>
                                setOpenSubSubMenu((prev) =>
                                  prev?.parentIndex === index &&
                                  prev?.subIndex === subIndex
                                    ? null
                                    : { parentIndex: index, subIndex },
                                ),
                              )
                            }
                            className={`menu-dropdown-item w-full text-left ${
                              isSubSubOpen
                                ? "menu-dropdown-item-active"
                                : "menu-dropdown-item-inactive"
                            }`}
                          >
                            <span className="flex items-center justify-between w-full">
                              {subItem.name}
                              <ChevronDownIcon
                                className={`size-3.5 shrink-0 transition-transform duration-200 ${
                                  isSubSubOpen
                                    ? "rotate-180 text-brand-500 dark:text-brand-400"
                                    : "text-gray-400 dark:text-gray-500"
                                }`}
                              />
                            </span>
                          </button>

                          {/* ---------- SUB-SUBMENU ---------- */}
                          <div
                            className={`overflow-hidden transition-all duration-300 ease-in-out ${
                              isSubSubOpen ? "max-h-[600px] mt-1" : "max-h-0"
                            }`}
                          >
                            <ul className="mt-[6px] ml-2.5 space-y-[6px] border-l border-gray-200 pb-1 pl-2 dark:border-gray-800">
                              {subItem.subSubItems.map((subSubItem) => (
                                <li key={subSubItem.name}>
                                  <Link
                                    to={subSubItem.path}
                                    className={`menu-dropdown-item block ${
                                      isActive(subSubItem.path)
                                        ? "menu-dropdown-item-active"
                                        : "menu-dropdown-item-inactive"
                                    }`}
                                  >
                                    <span className="flex items-center justify-between w-full">
                                      {subSubItem.name}
                                      <span className="flex items-center gap-1">
                                        {subSubItem.new && (
                                          <span
                                            className={`${
                                              isActive(subSubItem.path)
                                                ? "menu-dropdown-badge-active"
                                                : "menu-dropdown-badge-inactive"
                                            } menu-dropdown-badge`}
                                          >
                                            new
                                          </span>
                                        )}
                                        {subSubItem.pro && (
                                          <span
                                            className={`${
                                              isActive(subSubItem.path)
                                                ? "menu-dropdown-badge-active"
                                                : "menu-dropdown-badge-inactive"
                                            } menu-dropdown-badge`}
                                          >
                                            pro
                                          </span>
                                        )}
                                      </span>
                                    </span>
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </>
                      ) : (
                        subItem.path && (
                          <Link
                            to={subItem.path}
                            className={`menu-dropdown-item ${
                              isActive(subItem.path)
                                ? "menu-dropdown-item-active"
                                : "menu-dropdown-item-inactive"
                            }`}
                          >
                            <span className="truncate">{subItem.name}</span>
                          </Link>
                        )
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </li>
      ))}
    </ul>
  );

  // ---------- RENDER ----------
  return (
    <aside
      className={`fixed mt-16 flex flex-col lg:mt-0 top-0 px-2.5 left-0 bg-white dark:bg-gray-900 dark:border-gray-800 text-gray-900 h-screen transition-all duration-300 ease-in-out z-50 border-r border-gray-200 
        ${
          isExpanded || isMobileOpen
            ? "w-[232px]"
            : isHovered
              ? "w-[232px]"
              : "w-[72px]"
        }
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* ---------- LOGO ---------- */}
      <div
        className={`py-5 flex items-center ${
          !isExpanded && !isHovered
            ? "lg:justify-center"
            : "justify-between"
        }`}
      >
        <Link to="/" className="flex items-center gap-2.5">
          <img
            src="/images/logo/logo-icon.svg"
            alt="Ecompose Master"
            className="size-8 shrink-0 rounded-lg bg-brand-500 p-1.5 shadow-sm"
          />
          {(isExpanded || isHovered || isMobileOpen) && (
            <span className="font-bold text-gray-900 dark:text-white text-base tracking-tight uppercase whitespace-nowrap">
              Ecompos Master
            </span>
          )}
        </Link>
        {(isExpanded || isHovered || isMobileOpen) && (
          <button
            onClick={toggleSidebar}
            className="hidden lg:flex items-center justify-center size-7 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/5 dark:hover:text-gray-300"
          >
            <ChevronDownIcon className="size-4 rotate-90" />
          </button>
        )}
      </div>

      {/* ---------- SIDEBAR NAV ---------- */}
      <div className="flex flex-col overflow-y-auto duration-300 ease-linear no-scrollbar">
        <nav className="mb-6 pb-10">
          <div className="flex flex-col gap-3.5">
            {sidebarSections
              .filter((section) => section.items.length > 0)
              .map((section) => (
                <div key={section.type}>
                  <h2
                    className={`sidebar-section-title flex ${
                      !isExpanded && !isHovered
                        ? "lg:justify-center"
                        : "justify-start"
                    }`}
                  >
                    {isExpanded || isHovered || isMobileOpen ? (
                      section.label
                    ) : (
                      <HorizontaLDots className="size-6" />
                    )}
                  </h2>
                  {renderMenuItems(section.items, section.type)}
                </div>
              ))}
          </div>
        </nav>
      </div>
    </aside>
  );
};

export default AppSidebar;
