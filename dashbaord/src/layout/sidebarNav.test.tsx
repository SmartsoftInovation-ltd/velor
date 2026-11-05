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
    expect(items).toEqual(["Web Order", "Courier & Merchant", "Website Settings", "Limited Offer", "Flash Sale"]);
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
      "Create Outlet Info",
      "Outlet Info List",
      "Create Web Banner",
      "Web Banner List",
      "Create Discount Banner",
      "Discount Banner List",
      "Create Size Chart",
      "Size Chart List",
      "Create Delivery Charge",
      "Delivery Charge List",
    ]);
  });

  it("leaves only store information under General Settings", () => {
    const settings = links("Settings ");
    expect(settings).toEqual(["Store Information"]);
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

  it("keeps Product, Variant and Purchase next to each other", () => {
    const { result } = renderHook(() => useSidebarSections());
    const names = result.current.find((s) => s.label === "Sales Purchase")?.items.map((i) => i.name);
    expect(names?.slice(0, 3)).toEqual(["Product", "Variant", "Purchase"]);
  });
});
