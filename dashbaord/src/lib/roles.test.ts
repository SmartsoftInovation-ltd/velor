import { describe, expect, it } from "vitest";
import { assignableRoles } from "./roles";

describe("assignableRoles", () => {
  it("hides the owner role (including the legacy superadmin slug) from role pickers", () => {
    const roles = [
      { _id: "1", slug: "owner", name: "owner" },
      { _id: "2", slug: "superadmin", name: "superAdmin" },
      { _id: "3", slug: "manager", name: "manager" },
    ];
    expect(assignableRoles(roles).map((r) => r.slug)).toEqual(["manager"]);
  });

  it("tolerates missing data", () => {
    expect(assignableRoles(undefined)).toEqual([]);
  });
});
