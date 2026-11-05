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

  it("keeps Product, Variant and Purchase next to each other", () => {
    const { result } = renderHook(() => useSidebarSections());
    const names = result.current.find((s) => s.label === "Sales Purchase")?.items.map((i) => i.name);
    expect(names?.slice(0, 3)).toEqual(["Product", "Variant", "Purchase"]);
  });
});
