const jwt = require("jsonwebtoken");
const request = require("supertest");
const { connectTestDb, clearTestDb, disconnectTestDb } = require("../helpers/db");
const { setSettingsEnv } = require("../helpers/settings");
const { setPlatformEnv, createPlatformUser, PLATFORM_ENV } = require("../helpers/platform");
const { loadApp, createTenantWithStaff, STAFF_ENV } = require("../helpers/tenantApp");
const { runForTenant } = require("../../src/tenancy/context");
const { invalidateTenantCache } = require("../../src/tenancy/tenantResolver");
const Role = require("../../src/models/role.model");
const User = require("../../src/models/user.model");
const PlatformAuditLog = require("../../src/models/platform/platformAuditLog.model");

// The platform store's owner opens the Platform Console from their normal
// dashboard session; no separate operator password.
describe("POST /platform/auth/console-access", () => {
  let app;
  const envBackup = { ...process.env };

  beforeAll(async () => {
    Object.assign(process.env, STAFF_ENV);
    setSettingsEnv();
    setPlatformEnv();
    await connectTestDb();
    app = loadApp();
    jest.spyOn(console, "log").mockImplementation(() => {});
  });

  beforeEach(() => {
    process.env = { ...envBackup, ...STAFF_ENV, PLATFORM_WORKSPACES: "velor" };
    setSettingsEnv();
    setPlatformEnv();
    delete process.env.PLATFORM_CONSOLE_OPERATOR_EMAIL;
    invalidateTenantCache();
  });

  afterEach(clearTestDb);
  afterAll(async () => {
    process.env = { ...envBackup };
    jest.restoreAllMocks();
    await app.close();
    await disconnectTestDb();
  });

  const staffToken = async (slug, email, password) =>
    (await request(app.server).post("/api/v1/auth/login").send({ workspace: slug, email, password })).body.data.accessToken;

  const access = (token) =>
    request(app.server).post("/api/v1/platform/auth/console-access").set("Authorization", `Bearer ${token}`);

  it("gives the platform workspace owner a platform session", async () => {
    const operator = await createPlatformUser({ role: "superadmin" });
    await createTenantWithStaff({ slug: "velor", roleSlug: "owner", email: "owner@velor.com", password: "Owner-Pass1" });

    const res = await access(await staffToken("velor", "owner@velor.com", "Owner-Pass1")).expect(200);

    const claims = jwt.verify(res.body.data.accessToken, PLATFORM_ENV.PLATFORM_ACCESS_TOKEN_SECRET, { audience: "platform" });
    expect(claims.sub).toBe(operator._id.toString());
    expect(res.body.data.user.email).toBe(operator.email);
    expect(res.headers["set-cookie"].some((c) => c.startsWith("platformRefreshToken="))).toBe(true);

    const audit = await PlatformAuditLog.findOne({ action: "PLATFORM_LOGIN" }).lean();
    expect(audit.metadata).toMatchObject({ via: "console-access", staffEmail: "owner@velor.com", workspace: "velor" });
  });

  it("uses PLATFORM_CONSOLE_OPERATOR_EMAIL when set", async () => {
    await createPlatformUser({ role: "superadmin" });
    const chosen = await createPlatformUser({ role: "superadmin", email: "chosen@platform.test" });
    process.env.PLATFORM_CONSOLE_OPERATOR_EMAIL = "chosen@platform.test";
    await createTenantWithStaff({ slug: "velor", roleSlug: "owner", email: "owner@velor.com", password: "Owner-Pass1" });

    const res = await access(await staffToken("velor", "owner@velor.com", "Owner-Pass1")).expect(200);
    expect(res.body.data.user._id).toBe(chosen._id.toString());
  });

  it("refuses owners of other stores and non-owner staff of the platform store", async () => {
    await createPlatformUser({ role: "superadmin" });
    await createTenantWithStaff({ slug: "pizzashop", roleSlug: "owner", email: "owner@pizza.com", password: "Owner-Pass1" });
    const velor = await createTenantWithStaff({ slug: "velor", roleSlug: "owner", email: "owner@velor.com", password: "Owner-Pass1" });
    await runForTenant(velor.tenant._id, async () => {
      const [manager] = await Role.insertMany([{ name: "manager", slug: "manager" }]);
      await User.create({ name: "Manager", email: "manager@velor.com", password: "Manager-Pass1", phone: "01811000000", roles: [manager._id] });
    });

    await access(await staffToken("pizzashop", "owner@pizza.com", "Owner-Pass1")).expect(403);
    await access(await staffToken("velor", "manager@velor.com", "Manager-Pass1")).expect(403);
    await request(app.server).post("/api/v1/platform/auth/console-access").expect(401);
  });

  it("explains when no platform operator exists", async () => {
    await createTenantWithStaff({ slug: "velor", roleSlug: "owner", email: "owner@velor.com", password: "Owner-Pass1" });
    const res = await access(await staffToken("velor", "owner@velor.com", "Owner-Pass1")).expect(500);
    expect(res.body.code).toBe("PLATFORM_OPERATOR_MISSING");
  });
});
