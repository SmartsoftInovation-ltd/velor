const { connectTestDb, clearTestDb, disconnectTestDb } = require("../helpers/db");
const { seedSuperAdmin } = require("../../src/seeder/addSuperAdminSeeder");
const Permission = require("../../src/models/permisson.model");
const Role = require("../../src/models/role.model");
const User = require("../../src/models/user.model");

const STRONG = "Str0ng-Passw0rd!";

const seedPrerequisites = async () => {
  await Permission.insertMany([{ permissionName: "Product" }, { permissionName: "Create User" }]);
  await Role.insertMany([{ name: "superAdmin", slug: "superadmin" }]);
};

describe("seedSuperAdmin", () => {
  beforeAll(connectTestDb);
  afterEach(clearTestDb);
  afterAll(disconnectTestDb);

  beforeEach(() => {
    jest.spyOn(console, "log").mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it("refuses to run without credentials", async () => {
    await seedPrerequisites();
    await expect(seedSuperAdmin({ email: "", password: STRONG })).rejects.toThrow(/--email/);
    await expect(seedSuperAdmin({ email: "root@example.com" })).rejects.toThrow(/--password/);
  });

  it("refuses a weak password", async () => {
    await seedPrerequisites();
    await expect(
      seedSuperAdmin({ email: "root@example.com", password: "Sadmin@123" }),
    ).rejects.toThrow(/at least 12/);
  });

  it("requires permissions and the superadmin role to be seeded first", async () => {
    await expect(
      seedSuperAdmin({ email: "root@example.com", password: STRONG }),
    ).rejects.toThrow(/seed permissions/i);

    await Permission.insertMany([{ permissionName: "Product" }]);
    await expect(
      seedSuperAdmin({ email: "root@example.com", password: STRONG }),
    ).rejects.toThrow(/seed roles/i);
  });

  it("creates the superadmin with the role, every permission and a hashed password", async () => {
    await seedPrerequisites();

    const result = await seedSuperAdmin({ email: "Root@Example.com", password: STRONG });

    expect(result.created).toBe(true);
    const user = await User.findOne({ email: "root@example.com" }).populate("roles");
    expect(user.roles.map((r) => r.slug)).toEqual(["superadmin"]);
    expect(user.permissions).toHaveLength(2);
    expect(user.permissions[0].actions).toEqual(["view", "add", "edit", "delete"]);
    expect(user.password).not.toBe(STRONG);
    await expect(user.comparePassword(STRONG)).resolves.toBe(true);
    expect(user.createdBy.toString()).toBe(user._id.toString());
  });

  it("is idempotent and never overwrites an existing account", async () => {
    await seedPrerequisites();
    await seedSuperAdmin({ email: "root@example.com", password: STRONG });

    const second = await seedSuperAdmin({ email: "root@example.com", password: "Another-Str0ng-Pass" });

    expect(second.created).toBe(false);
    expect(await User.countDocuments({ email: "root@example.com" })).toBe(1);
    const user = await User.findOne({ email: "root@example.com" });
    await expect(user.comparePassword(STRONG)).resolves.toBe(true);
  });
});
