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

  it("keeps Product, Variant and Purchase next to each other", () => {
    const { result } = renderHook(() => useSidebarSections());
    const names = result.current.find((s) => s.label === "Sales Purchase")?.items.map((i) => i.name);
    expect(names?.slice(0, 3)).toEqual(["Product", "Variant", "Purchase"]);
  });
});
