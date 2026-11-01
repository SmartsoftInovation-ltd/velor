const mongoose = require("mongoose");
const { connectTestDb, clearTestDb, disconnectTestDb } = require("../helpers/db");
const { runForTenant, runAsPlatform } = require("../../src/tenancy/context");

jest.mock("../../src/config/redis.config", () => require("../mocks/redisCache"));

const Permission = require("../../src/models/permisson.model");
const Role = require("../../src/models/role.model");
const User = require("../../src/models/user.model");
const migration = require("../../src/migrations/017-split-module-permissions");

// Screens that borrowed another module's permission now have their own; a
// role keeps every screen it had, through copied grants.
describe("017 split module permissions", () => {
  const tenant = { _id: new mongoose.Types.ObjectId(), slug: "splitshop" };
  let perms;

  beforeAll(connectTestDb);
  afterEach(clearTestDb);
  afterAll(disconnectTestDb);

  beforeEach(async () => {
    perms = {};
    await runAsPlatform(async () => {
      for (const name of ["Retail Sales", "Sales History", "Send SMS", "Send Bulk SMS", "Create Permission", "Create Role", "Site Information", "Product"]) {
        perms[name] = await new Permission({ permissionName: name }).save();
      }
    });
  });

  const role = (name, grants) =>
    runForTenant(tenant._id, () =>
      Role.collection.insertOne({
        tenantId: tenant._id,
        name,
        slug: name.toLowerCase(),
        permissions: grants.map(([p, actions]) => ({ permission: perms[p]._id, actions })),
      }),
    );

  const grantsOf = async (roleName) => {
    const doc = await runForTenant(tenant._id, () =>
      Role.findOne({ name: roleName }).populate("permissions.permission").lean(),
    );
    return Object.fromEntries(doc.permissions.map((g) => [g.permission.slug, [...g.actions].sort()]));
  };

  it("creates the five permissions and copies the matching grants", async () => {
    await role("Cashier", [
      ["Retail Sales", ["view", "add"]],
      ["Sales History", ["view", "print"]],
      ["Send SMS", ["view"]],
      ["Send Bulk SMS", ["add"]],
      ["Site Information", ["view", "edit"]],
    ]);
    await role("Admin", [["Create Permission", ["add"]], ["Create Role", ["edit"]]]);
    await role("Stock", [["Product", ["view"]]]);

    const result = await migration.up({ tenant });
    expect(result).toEqual({ roles: 2, users: 0 });

    const names = await runAsPlatform(() => Permission.find({}).distinct("permissionName"));
    expect(names).toEqual(expect.arrayContaining(["Sales Return", "Draft Order", "Due SMS", "Assign Role", "Store Information"]));

    expect(await grantsOf("Cashier")).toMatchObject({
      "sales-return": ["add", "view"],
      "draft-order": ["view"],
      "due-sms": ["add", "view"],
      "store-information": ["edit", "view"],
    });
    expect(await grantsOf("Admin")).toMatchObject({ "assign-role": ["edit", "view"] });
    // Nothing to copy: untouched
    expect(Object.keys(await grantsOf("Stock"))).toEqual(["product"]);
  });

  it("copies direct user grants too, and running twice changes nothing more", async () => {
    await runForTenant(tenant._id, () =>
      User.collection.insertOne({
        tenantId: tenant._id,
        name: "Direct",
        email: "direct@shop.test",
        permissions: [{ permission: perms["Retail Sales"]._id, actions: ["delete"] }],
      }),
    );
    expect(await migration.up({ tenant })).toEqual({ roles: 0, users: 1 });
    expect(await migration.up({ tenant })).toEqual({ roles: 0, users: 0 });

    const user = await runForTenant(tenant._id, () => User.findOne({ email: "direct@shop.test" }).populate("permissions.permission").lean());
    expect(user.permissions.map((g) => g.permission.slug)).toEqual(["retail-sales", "sales-return"]);
  });
});
