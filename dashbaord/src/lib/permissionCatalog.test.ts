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
  it("lists the screens that used to borrow another module's permission", () => {
    expect(group("Sales")).toContain("Sales Return");
    expect(group("Draft Order")).toEqual(["Draft Order"]);
    expect(group("SMS Notifications")).toContain("Due SMS");
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
});
