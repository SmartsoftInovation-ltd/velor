import { describe, expect, it } from "vitest";
import { MODULE_GROUPS, actionsForModule } from "./permissionCatalog";
import { PERMISSIONS } from "../config/permissions";

// The slug the backend gives a permission name (slugify, lower + strict)
const slugOf = (name: string) =>
  name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s-]+/g, "-");

const group = (label: string) => MODULE_GROUPS.find((g) => g.label === label)?.modules ?? [];

describe("permission catalog", () => {
  it("orders Product, Variant and Purchase as the sidebar does", () => {
    expect(group("Product")).toEqual(["Product", "Barcode Print", "Category", "Sub Category", "Brand"]);
    expect(group("Variant")).toEqual(["Variant"]);
    expect(group("Purchase")).toEqual(["Purchase", "Purchase Return"]);
    const salesPurchase = MODULE_GROUPS.filter((g) => g.section === "Sales Purchase").map((g) => g.label);
    expect(salesPurchase.slice(0, 3)).toEqual(["Product", "Variant", "Purchase"]);
  });

  it("lists the screens that used to borrow another module's permission", () => {
    expect(group("Sales")).toEqual(expect.arrayContaining(["Sales Return", "Draft Order"]));
    expect(group("SMS Notification")).toContain("Due SMS");
    expect(group("Role & Permission")).toEqual(
      expect.arrayContaining(["Create User", "Create Role", "Create Permission", "Assign Role", "Audit Log"]),
    );
  });

  it("has a Settings module with every settings screen", () => {
    expect(group("Settings")).toEqual(["Site Information", "Outlet Information", "Store Information"]);
  });

  it("gives Supplier Payment, Add Transaction and Money Transfer a Print action", () => {
    for (const name of ["Supplier Payment", "Add Transaction", "Money Transfer"]) {
      expect(actionsForModule(name)).toEqual(["view", "add", "edit", "delete", "print"]);
    }
    expect(actionsForModule("Due SMS")).toEqual(["view", "add", "edit", "delete"]);
  });

  it("puts every module in exactly one group", () => {
    const all = MODULE_GROUPS.flatMap((g) => g.modules);
    const repeated = all.filter((m, i) => all.indexOf(m) !== i);
    expect(repeated).toEqual([]);
  });

  // Every permission the sidebar and the routes check (config/permissions.ts)
  // must be grantable on the Role & Permission pages
  it("covers every permission the app checks", () => {
    const onPage = new Set(MODULE_GROUPS.flatMap((g) => g.modules).map(slugOf));
    const missing = Object.values(PERMISSIONS).filter((slug) => !onPage.has(slug));
    expect(missing).toEqual([]);
  });

  it("lists every report on the All Reports hub", () => {
    for (const report of ["Top Salesman Report", "Invoice Profit Report", "Supplier Dues Report", "Top Customer Report"]) {
      expect(MODULE_GROUPS.some((g) => g.modules.includes(report))).toBe(true);
    }
  });

  // Same sections, in the same order, as the sidebar
  it("follows the sidebar's sections and order", () => {
    const sections = MODULE_GROUPS.map((g) => g.section).filter((x, i, all) => all.indexOf(x) === i);
    expect(sections).toEqual([
      "Menu", "Sales Purchase", "Discount Management", "Stock Management", "Website Management",
      "Profile", "Accounts Management", "Analytics & Users", "General Settings",
    ]);
    // a section's groups sit together, never split
    const runs = MODULE_GROUPS.map((g) => g.section).filter((x, i, all) => i === 0 || all[i - 1] !== x);
    expect(runs).toEqual(sections);
    const website = MODULE_GROUPS.filter((g) => g.section === "Website Management").map((g) => g.label);
    expect(website).toEqual(["Order", "Courier", "Delivery Charge", "Banner", "Limited Offer", "Promo Banner", "Flash Sale", "Coupon", "Size Chart"]);
  });
});
