const { connectTestDb, clearTestDb, disconnectTestDb } = require("../helpers/db");
const { seedPlatformAdmin } = require("../../src/seeder/seedPlatformAdmin");
const { createTenant, parseArgs } = require("../../src/scripts/createTenant");
const PlatformUser = require("../../src/models/platform/platformUser.model");
const Tenant = require("../../src/models/platform/tenant.model");

const STRONG = "Platform-Passw0rd!";

describe("platform seed scripts", () => {
  beforeAll(async () => {
    await connectTestDb();
    await Promise.all([PlatformUser.init(), Tenant.init()]);
  });
  beforeEach(() => jest.spyOn(console, "log").mockImplementation(() => {}));
  afterEach(async () => {
    jest.restoreAllMocks();
    await clearTestDb();
  });
  afterAll(disconnectTestDb);

  describe("seedPlatformAdmin", () => {
    it("requires credentials and a strong password", async () => {
      await expect(seedPlatformAdmin({ password: STRONG })).rejects.toThrow(/PLATFORM_ADMIN_EMAIL/);
      await expect(seedPlatformAdmin({ email: "me@platform.test" })).rejects.toThrow(/PLATFORM_ADMIN_PASSWORD/);
      await expect(seedPlatformAdmin({ email: "me@platform.test", password: "short" })).rejects.toThrow(/at least 12/);
    });

    it("creates an active superadmin and leaves an existing one alone", async () => {
      const first = await seedPlatformAdmin({ email: "Me@Platform.test", password: STRONG, name: "Owner" });
      const second = await seedPlatformAdmin({ email: "me@platform.test", password: "Different-Passw0rd!" });

      expect(first.created).toBe(true);
      expect(second).toMatchObject({ created: false, updated: false });
      const users = await PlatformUser.find().select("+password");
      expect(users).toHaveLength(1);
      expect(users[0]).toMatchObject({ email: "me@platform.test", role: "superadmin", isActive: true, name: "Owner" });
      await expect(users[0].comparePassword(STRONG)).resolves.toBe(true);
    });

    it("--reset sets a new password and revokes open console sessions", async () => {
      await seedPlatformAdmin({ email: "me@platform.test", password: STRONG, name: "Owner" });
      const result = await seedPlatformAdmin({ email: "me@platform.test", password: "Different-Passw0rd!", reset: true });

      expect(result).toMatchObject({ created: false, updated: true });
      const user = await PlatformUser.findOne({ email: "me@platform.test" }).select("+password");
      await expect(user.comparePassword("Different-Passw0rd!")).resolves.toBe(true);
      await expect(user.comparePassword(STRONG)).resolves.toBe(false);
      expect(user.tokenVersion).toBe(1);
    });
  });

  describe("createTenant script", () => {
    it("parses CLI flags", () => {
      expect(parseArgs(["--name", "Velor", "--slug", "velor", "--status", "active"])).toEqual({
        name: "Velor",
        slug: "velor",
        status: "active",
      });
    });

    it("creates the tenant with the requested status and is idempotent by slug", async () => {
      const first = await createTenant({ name: "Velor", slug: "velor", status: "active" });
      const second = await createTenant({ name: "Velor Again", slug: "velor" });

      expect(first.created).toBe(true);
      expect(second.created).toBe(false);
      expect(second.tenant._id.toString()).toBe(first.tenant._id.toString());
      const tenants = await Tenant.find();
      expect(tenants).toHaveLength(1);
      expect(tenants[0]).toMatchObject({ name: "Velor", slug: "velor", status: "active" });
    });

    it("rejects an unsupported initial status", async () => {
      await expect(createTenant({ name: "X Shop", slug: "xshop", status: "cancelled" })).rejects.toThrow(/status/);
    });
  });
});
