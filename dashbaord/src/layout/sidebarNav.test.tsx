import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useSidebarSections } from "./sidebarNav";

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ isSuperAdmin: true, isOwner: true, isLoading: false, can: () => true, features: {}, tenant: "shop" }),
}));
vi.mock("../platform/PlatformAuthContext", () => ({ usePlatformAuth: () => ({ operator: null }) }));

const links = (group: string) => {
  const { result } = renderHook(() => useSidebarSections());
  const item = result.current.flatMap((s) => s.items).find((i) => i.name === group);
  return item?.subItems?.map((s) => s.name);
};

describe("sidebar order", () => {
  it("lists Product links starting from the product itself", () => {
    expect(links("Product")).toEqual([
      "Create Product",
      "Product List",
      "Barcode Print",
      "Create Category",
      "Category List",
      "Create SubCategory",
      "SubCategory List",
      "Create Brand",
      "Brand List",
    ]);
  });

  it("lists Variant links", () => {
    expect(links("Variant")).toEqual(["Create Variant", "Variant List"]);
  });

  it("lists Purchase links, creating first", () => {
    expect(links("Purchase")).toEqual(["Create Purchase", "Purchase List", "Purchase Return", "Purchase Return List"]);
  });

  it("lists Sales links by what they do, keeping their names", () => {
    expect(links("Sales")).toEqual([
      "Add Retail Sales",
      "Add Wholesale Sales",
      "Sales History",
      "Add Retailsale Order",
      "Add Wholesale Order",
      "Order List",
      "Draft Order List",
      "Sales Return",
      "Sales Return List",
    ]);
  });

  it("puts discounts and coupons together under Discount Management", () => {
    const { result } = renderHook(() => useSidebarSections());
    const section = (label: string) => result.current.find((s) => s.label === label)?.items.map((i) => i.name);
    expect(section("Discount Management")).toEqual(["Discount & Coupon"]);
    expect(links("Discount & Coupon")).toEqual(["Create Discount", "Discount List", "Create Coupon", "Coupon List"]);
    expect(section("Website Management")).not.toContain("Coupon");
    expect(section("Menu") ?? []).not.toContain("Coupon");
  });

  it("lists Stock pages first, then adjustments", () => {
    expect(links("Stock")).toEqual([
      "View All Stock",
      "Category Stock Detail",
      "Color Wise Stock",
      "Size Wise Stock",
      "Low Stock",
      "Stock Adjustment",
      "Stock Adjustment List",
    ]);
  });

  it("groups Website Management as Web Order, Courier & Merchant and Website Settings", () => {
    const { result } = renderHook(() => useSidebarSections());
    const items = result.current.find((s) => s.label === "Website Management")?.items.map((i) => i.name);
    expect(items).toEqual(["Web Order", "Courier & Merchant", "Website Settings", "Flash Sale"]);
    expect(links("Web Order")).toEqual(["Create Web Order", "Web Order List", "Incomplete Order List"]);
    // Only pages that exist: there is no Courier Delivery List or Create Courier Return page yet
    expect(links("Courier & Merchant")).toEqual([
      "Create Courier Merchant",
      "Courier Merchant List",
      "Create Courier Delivery",
      "Courier Return List",
    ]);
    expect(links("Website Settings")).toEqual([
      "Create Website Info",
      "Website Info List",
      "Return Policy",
      "Create Outlet Info",
      "Outlet Info List",
      "Create Web Banner",
      "Web Banner List",
      "Create Discount Banner",
      "Discount Banner List",
      "Limited Offer",
      "Create Size Chart",
      "Size Chart List",
      "Create Delivery Charge",
      "Delivery Charge List",
    ]);
  });

  it("still opens every moved page at its old address", () => {
    const { result } = renderHook(() => useSidebarSections());
    const paths = result.current
      .flatMap((s) => s.items)
      .flatMap((i) => i.subItems ?? [])
      .map((s) => s.path);
    for (const path of [
      "/create-order", "/order-list", "/incomplete-order-list",
      "/courier", "/courier-merchant-list", "/create-courier-delivery", "/courier-return-list",
      "/add-site-info", "/site-info-list", "/add-outlet", "/outlet-list",
      "/add-banner", "/banner-list", "/add-discount", "/discount-banner-list",
      "/create-sizechart", "/sizechart-list", "/create-delivery-charge", "/delivery-charge-list",
    ]) {
      expect(paths).toContain(path);
    }
  });

  it("groups Profile as Customer, Supplier and Employee", () => {
    const { result } = renderHook(() => useSidebarSections());
    expect(result.current.find((s) => s.label === "Profile")?.items.map((i) => i.name)).toEqual([
      "Customer",
      "Supplier",
      "Employee",
    ]);
    expect(links("Customer")).toEqual([
      "Create Customer",
      "Customer List",
      "Customer Payment Receive",
      "Customer Payment Receive List",
      "Customer Advance Payment",
      "Customer Advance Payment List",
      "Create Customer Type",
      "Customer Type List",
    ]);
    expect(links("Supplier")).toEqual(["Create Supplier", "Supplier List", "Create Supplier Payment", "Supplier Payment List"]);
    expect(links("Employee")).toEqual([
      "Create Employee",
      "Employee List",
      "Create Designation",
      "Designation List",
      "Create Department",
      "Department List",
      "Create Section",
      "Section List",
    ]);
  });

  it("lists All Accounts with a create link beside each list", () => {
    expect(links("All Accounts ")).toEqual([
      "Create Transaction",
      "Transaction List",
      "Create Money Transfer",
      "Money Transfer List",
      "Create Money Handover",
      "Money Handover List",
      "Create Transaction Category",
      "Transaction Category List",
      "Create Account",
      "Account List",
    ]);
  });

  it("links the new create pages, only for people allowed to add", () => {
    const { result } = renderHook(() => useSidebarSections());
    const subs = result.current.flatMap((s) => s.items).flatMap((i) => i.subItems ?? []);
    expect(subs.find((s) => s.name === "Create Customer Type")).toMatchObject({ path: "/create-customer-type", action: "add" });
    expect(subs.find((s) => s.name === "Create Transaction Category")).toMatchObject({ path: "/add-transaction-category", action: "add" });
    expect(subs.find((s) => s.name === "Create Account")).toMatchObject({ path: "/add-account", action: "add" });
  });

  it("lists SMS Notifications, User Role & Permission and Settings", () => {
    expect(links("SMS Notifications")).toEqual(["Send SMS", "Send Due SMS", "Send Bulk SMS", "SMS Info"]);
    expect(links("User Role & Permission")).toEqual([
      "Create User",
      "User List",
      "Create Role",
      "Role List",
      "Create User Permission",
      "Assign Role Permission",
      "Audit User Log",
    ]);
    expect(links("Settings ")).toEqual(["Create Store Information", "Store Information List"]);
  });

  it("opens the role list for anyone who may view roles", () => {
    const { result } = renderHook(() => useSidebarSections());
    const subs = result.current.flatMap((s) => s.items).flatMap((i) => i.subItems ?? []);
    const roleList = subs.find((s) => s.name === "Role List");
    expect(roleList).toMatchObject({ path: "/role-list", module: "create-role" });
    expect(roleList?.action).toBeUndefined();
  });

  it("keeps Product, Variant and Purchase next to each other", () => {
    const { result } = renderHook(() => useSidebarSections());
    const names = result.current.find((s) => s.label === "Sales Purchase")?.items.map((i) => i.name);
    expect(names?.slice(0, 3)).toEqual(["Product", "Variant", "Purchase"]);
  });
});
