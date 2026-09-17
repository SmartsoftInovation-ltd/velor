const request = require("supertest");
const { connectTestDb, clearTestDb, disconnectTestDb } = require("../helpers/db");
const { setSettingsEnv } = require("../helpers/settings");
const { setPlatformEnv, createPlatformUser } = require("../helpers/platform");
const { loadApp, STAFF_ENV } = require("../helpers/tenantApp");
const { runForTenant } = require("../../src/tenancy/context");
const { signPlatformAccessToken } = require("../../src/utils/platformTokens");
const Tenant = require("../../src/models/platform/tenant.model");
const Role = require("../../src/models/role.model");
const User = require("../../src/models/user.model");
const service = require("../../src/settings/settings.service");

describe("tenant provisioning", () => {
  let app;
  let platformAuth;
  const envBackup = { ...process.env };

  beforeAll(async () => {
    Object.assign(process.env, STAFF_ENV, { APP_URL: "https://app.example.test" });
    setSettingsEnv();
    setPlatformEnv();
    await connectTestDb();
    app = loadApp();
    service.setSettingsPublisher(async () => {});
    jest.spyOn(console, "log").mockImplementation(() => {});
  });

  beforeEach(async () => {
    service.clearSettingsCache();
    platformAuth = { Authorization: `Bearer ${signPlatformAccessToken(await createPlatformUser({ role: "superadmin" }))}` };
  });

  afterEach(clearTestDb);
  afterAll(async () => {
    process.env = { ...envBackup };
    jest.restoreAllMocks();
    await app.close();
    await disconnectTestDb();
  });

  const provision = (body) => request(app.server).post("/api/v1/platform/tenants").set(platformAuth).send(body);

  it("creates an active store with owner, default roles, settings and a one-time password", async () => {
    const res = await provision({
      name: "Pizza Shop",
      slug: "pizza-shop",
      limits: { maxStaff: 10 },
      owner: { name: "Rahim", email: "rahim@pizza.com", phone: "01711000000" },
    }).expect(201);

    const { tenant, owner, loginUrl } = res.body.data;
    expect(tenant).toMatchObject({ slug: "pizza-shop", status: "active" });
    expect(owner).toMatchObject({ email: "rahim@pizza.com", temporaryPassword: expect.stringMatching(/^.{16,}$/) });
    expect(loginUrl).toBe("https://app.example.test/signin?workspace=pizza-shop");

    const stored = await Tenant.findById(tenant._id);
    const roles = await runForTenant(tenant._id, () => Role.find().lean());
    expect(roles.map((r) => r.slug).sort()).toEqual(["admin", "manager", "owner", "salesmen"]);

    const ownerUser = await runForTenant(tenant._id, () => User.findOne({ email: "rahim@pizza.com" }).populate("roles"));
    expect(ownerUser.roles.map((r) => r.slug)).toEqual(["owner"]);
    expect(ownerUser.mustChangePassword).toBe(true);
    expect(stored.ownerUserId.toString()).toBe(ownerUser._id.toString());

    expect((await service.getSettings(tenant._id)).general.invoicePrefix).toBe("PIZZAS");

    // The owner can sign in right away with the temporary password
    const login = await request(app.server).post("/api/v1/auth/login")
      .send({ workspace: "pizza-shop", email: "rahim@pizza.com", password: owner.temporaryPassword }).expect(200);
    expect(login.body.data.user.mustChangePassword).toBe(true);
  });

  it("changing the password clears mustChangePassword", async () => {
    const { owner } = (await provision({ name: "Burger", slug: "burgerhub", owner: { name: "Karim", email: "karim@burger.com", phone: "01811000000" } })).body.data;
    const login = await request(app.server).post("/api/v1/auth/login")
      .send({ workspace: "burgerhub", email: "karim@burger.com", password: owner.temporaryPassword });

    await request(app.server).post("/api/v1/auth/change-password")
      .set("Authorization", `Bearer ${login.body.data.accessToken}`)
      .send({ oldPassword: owner.temporaryPassword, newPassword: "Burger-Owner-Pass1" }).expect(200);

    const tenant = await Tenant.findOne({ slug: "burgerhub" });
    const user = await runForTenant(tenant._id, () => User.findOne({ email: "karim@burger.com" }));
    expect(user.mustChangePassword).toBe(false);
  });

  it("rolls everything back when the owner cannot be created", async () => {
    await provision({ name: "Bad", slug: "badshop", owner: { name: "X", email: "not-an-email", phone: "1" } }).expect(400);
    expect(await Tenant.countDocuments({ slug: "badshop" })).toBe(0);
  });

  it("leaves no tenant or roles behind when a step fails inside the transaction", async () => {
    const spy = jest.spyOn(User, "create").mockRejectedValueOnce(new Error("disk full"));

    await provision({ name: "Fail", slug: "failshop", owner: { name: "Fail", email: "f@fail.com", phone: "01911000000" } }).expect(500);

    spy.mockRestore();
    expect(await Tenant.countDocuments({ slug: "failshop" })).toBe(0);
    expect(await Role.collection.countDocuments({})).toBe(0);
  });

  it("validates the owner and still supports creating a bare tenant", async () => {
    await provision({ name: "Cake", slug: "cakehouse", owner: { email: "a@b.com" } }).expect(400);
    const bare = await provision({ name: "Cake", slug: "cakehouse" }).expect(201);
    expect(bare.body.data.status).toBe("provisioning");
  });
});
