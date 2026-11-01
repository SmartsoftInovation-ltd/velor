import { describe, expect, it } from "vitest";
import { MODULE_GROUPS, actionsForModule } from "./permissionCatalog";

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
});
