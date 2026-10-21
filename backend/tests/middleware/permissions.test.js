const mongoose = require("mongoose");
const { authorize, authorizeAny } = require("../../src/middleware/checkPermission.middleware");
const { runForTenant } = require("../../src/tenancy/context");

// authorize()/authorizeAny() on hand-built users: the rules that decide every
// 403 in the API, without a database.
describe("permission middleware", () => {
  const tenantId = new mongoose.Types.ObjectId();
  const perm = (slug, isActive = true) => ({ slug, isActive });
  const role = (permissions, { isActive = true, slug = "staff" } = {}) => ({ isActive, slug, permissions });

  const run = (mw, user, inTenant = tenantId) =>
    new Promise((resolve) => {
      const go = () => mw({ user }, {}, (err) => resolve(err ? { status: err.statusCode, message: err.message } : { status: "next" }));
      if (inTenant) runForTenant(inTenant, go);
      else go();
    });

  const user = (overrides = {}) => ({ _id: new mongoose.Types.ObjectId(), name: "Sam", tenantId, roles: [], permissions: [], ...overrides });

  it("401 when there is no user on the request", async () => {
    expect(await run(authorize("product", "view"), undefined)).toMatchObject({ status: 401 });
    expect(await run(authorizeAny(["product", "view"]), {})).toMatchObject({ status: 401 });
  });

  it("passes when a role grants the module + action", async () => {
    const u = user({ roles: [role([{ permission: perm("product"), actions: ["view", "edit"] }])] });
    expect(await run(authorize("product", "edit"), u)).toEqual({ status: "next" });
  });

  it("403 for the right module with the wrong action, and names both in the message", async () => {
    const u = user({ roles: [role([{ permission: perm("product"), actions: ["view"] }])] });
    const res = await run(authorize("product", "delete"), u);
    expect(res).toMatchObject({ status: 403 });
    expect(res.message).toMatch(/product:delete/);
  });

  it("is case-insensitive on the module slug", async () => {
    const u = user({ roles: [role([{ permission: perm("product"), actions: ["view"] }])] });
    expect(await run(authorize("Product", "view"), u)).toEqual({ status: "next" });
  });

  it("ignores the permissions of an inactive role", async () => {
    const u = user({ roles: [role([{ permission: perm("product"), actions: ["view"] }], { isActive: false })] });
    expect(await run(authorize("product", "view"), u)).toMatchObject({ status: 403 });
  });

  it("unions role permissions with direct grants", async () => {
    const u = user({
      roles: [role([{ permission: perm("product"), actions: ["view"] }])],
      permissions: [{ permission: perm("product"), actions: ["delete"] }],
    });
    expect(await run(authorize("product", "delete"), u)).toEqual({ status: "next" });
    expect(await run(authorize("product", "view"), u)).toEqual({ status: "next" });
  });

  it("lets the store owner through everything — in their own store only", async () => {
    const owner = user({ roles: [role([], { slug: "owner" })] });
    expect(await run(authorize("anything", "delete"), owner)).toEqual({ status: "next" });
    const legacy = user({ roles: [role([], { slug: "superadmin" })] });
    expect(await run(authorize("anything", "delete"), legacy)).toEqual({ status: "next" });
    // An owner token replayed inside another store's context is not an owner there
    expect(await run(authorize("anything", "delete"), owner, new mongoose.Types.ObjectId())).toMatchObject({ status: 403 });
  });

  it("authorizeAny passes on any one pair and lists them all when refusing", async () => {
    const u = user({ roles: [role([{ permission: perm("create-user"), actions: ["add"] }])] });
    const mw = authorizeAny(["create-role", "view"], ["create-user", "add"]);
    expect(await run(mw, u)).toEqual({ status: "next" });
    const refused = await run(authorizeAny(["create-role", "view"], ["create-user", "edit"]), u);
    expect(refused).toMatchObject({ status: 403 });
    expect(refused.message).toMatch(/create-role:view or create-user:edit/);
  });

  // BUG-064: a permission the platform deactivated still grants access through
  // authorize(); getMe and rbac.effectiveActions() both ignore it
  it("a deactivated permission grants nothing [BUG-064]", async () => {
    const u = user({ roles: [role([{ permission: perm("product", false), actions: ["view"] }])] });
    expect(await run(authorize("product", "view"), u)).toMatchObject({ status: 403 });
  });
});
