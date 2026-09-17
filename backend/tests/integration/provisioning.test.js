jest.mock("../../src/helpers/sms", () => ({ sendSMS: jest.fn(), getSmsBalance: jest.fn() }));

const request = require("supertest");
const { sendSMS } = require("../../src/helpers/sms");
const PlatformAuditLog = require("../../src/models/platform/platformAuditLog.model");
const { connectTestDb, clearTestDb, disconnectTestDb } = require("../helpers/db");
const { setSettingsEnv } = require("../helpers/settings");
const { setPlatformEnv, createPlatformUser } = require("../helpers/platform");
const { loadApp, STAFF_ENV } = require("../helpers/tenantApp");
const { invalidateTenantCache } = require("../../src/tenancy/tenantResolver");
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

  const CHANNEL_ENV = ["BULK_SMS_URL", "BULK_SMS_API_KEY", "BULK_SMS_SENDER_ID", "HOST_MAIL", "HOST_APP_PASSWORD"];
  const enableSms = () => Object.assign(process.env, { BULK_SMS_URL: "https://sms.test/send", BULK_SMS_API_KEY: "k", BULK_SMS_SENDER_ID: "s" });

  beforeEach(async () => {
    CHANNEL_ENV.forEach((key) => delete process.env[key]);
    // Tests reuse slugs; a cached tenant from an earlier test would be stale
    invalidateTenantCache();
    sendSMS.mockReset().mockResolvedValue({ response_code: 202 });
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

  const OWNER = { name: "Rahim", email: "rahim@pizza.com", phone: "01711000000", password: "Pizza-Owner-1" };

  it("creates an active store with only the owner role and the operator's password", async () => {
    const res = await provision({ name: "Pizza Shop", slug: "pizza-shop", limits: { maxStaff: 10 }, owner: OWNER }).expect(201);

    const { tenant, owner, loginUrl, notification } = res.body.data;
    expect(tenant).toMatchObject({ slug: "pizza-shop", status: "active" });
    expect(owner).toEqual({ _id: expect.any(String), name: "Rahim", email: "rahim@pizza.com", phone: "01711000000" });
    expect(loginUrl).toBe("https://app.example.test/signin?workspace=pizza-shop");
    expect(notification).toEqual({ channel: null, sent: false });

    const stored = await Tenant.findById(tenant._id);
    const roles = await runForTenant(tenant._id, () => Role.find().lean());
    expect(roles.map((r) => r.slug)).toEqual(["owner"]);

    const ownerUser = await runForTenant(tenant._id, () => User.findOne({ email: "rahim@pizza.com" }).populate("roles"));
    expect(ownerUser.roles.map((r) => r.slug)).toEqual(["owner"]);
    expect(ownerUser.mustChangePassword).toBe(false);
    expect(stored.ownerUserId.toString()).toBe(ownerUser._id.toString());

    expect((await service.getSettings(tenant._id)).general.invoicePrefix).toBe("PIZZAS");

    // The owner signs in with the operator's password, by email or by phone
    await request(app.server).post("/api/v1/auth/login")
      .send({ workspace: "pizza-shop", email: "rahim@pizza.com", password: OWNER.password }).expect(200);
    await request(app.server).post("/api/v1/auth/login")
      .send({ workspace: "pizza-shop", phone: "01711000000", password: OWNER.password }).expect(200);
  });

  it("requires the operator to set the owner's password", async () => {
    const { password, ...withoutPassword } = OWNER;
    await provision({ name: "Pizza", slug: "pizzashop", owner: withoutPassword }).expect(400);
    await provision({ name: "Pizza", slug: "pizzashop", owner: { ...OWNER, password: "short" } }).expect(400);
    expect(await Tenant.countDocuments({ slug: "pizzashop" })).toBe(0);
  });

  it("sends the sign-in details by SMS", async () => {
    enableSms();
    const res = await provision({ name: "Pizza Shop", slug: "pizza-shop", owner: OWNER }).expect(201);

    expect(res.body.data.notification).toEqual({ channel: "sms", sent: true });
    const [number, message] = sendSMS.mock.calls[0];
    expect(number).toBe("01711000000");
    expect(message).toContain("https://app.example.test/signin?workspace=pizza-shop");
    expect(message).toContain("rahim@pizza.com / 01711000000");
    expect(message).toContain("Password: Pizza-Owner-1");
  });

  it("never falls back to email", async () => {
    Object.assign(process.env, { HOST_MAIL: "platform@mail.test", HOST_APP_PASSWORD: "p" });
    const res = await provision({ name: "Pizza Shop", slug: "pizza-shop", owner: OWNER }).expect(201);
    expect(res.body.data.notification).toEqual({ channel: null, sent: false });

    enableSms();
    sendSMS.mockResolvedValue({ response_code: 1007, error_message: "Balance insufficient" });
    const failed = await provision({
      name: "Burger", slug: "burgerhub", owner: { ...OWNER, email: "karim@burger.com", phone: "01811000000" },
    }).expect(201);
    expect(failed.body.data.notification).toEqual({ channel: "sms", sent: false });
  });

  it("still creates the store when sending fails", async () => {
    enableSms();
    sendSMS.mockRejectedValue(new Error("network down"));
    const res = await provision({ name: "Pizza Shop", slug: "pizza-shop", owner: OWNER }).expect(201);
    expect(res.body.data.notification).toEqual({ channel: "sms", sent: false });
    expect(await Tenant.countDocuments({ slug: "pizza-shop", status: "active" })).toBe(1);
  });

  it("the owner can change the password themselves", async () => {
    await provision({ name: "Burger", slug: "burgerhub", owner: OWNER });
    const login = await request(app.server).post("/api/v1/auth/login")
      .send({ workspace: "burgerhub", email: OWNER.email, password: OWNER.password }).expect(200);

    await request(app.server).post("/api/v1/auth/change-password")
      .set("Authorization", `Bearer ${login.body.data.accessToken}`)
      .send({ oldPassword: OWNER.password, newPassword: "Burger-Owner-Pass1" }).expect(200);

    await request(app.server).post("/api/v1/auth/login")
      .send({ workspace: "burgerhub", email: OWNER.email, password: "Burger-Owner-Pass1" }).expect(200);
  });

  describe("operator sets the owner's password", () => {
    const setPassword = (tenantId, body, auth = platformAuth) =>
      request(app.server).post(`/api/v1/platform/tenants/${tenantId}/owner/password`).set(auth).send(body);

    it("replaces the password, signs the owner out, notifies and audits", async () => {
      const { tenant } = (await provision({ name: "Pizza Shop", slug: "pizza-shop", owner: OWNER })).body.data;
      const login = await request(app.server).post("/api/v1/auth/login")
        .send({ workspace: "pizza-shop", email: OWNER.email, password: OWNER.password }).expect(200);
      enableSms();

      const res = await setPassword(tenant._id, { password: "New-Owner-Pass1" }).expect(200);
      expect(res.body.data.notification).toEqual({ channel: "sms", sent: true });
      expect(sendSMS.mock.calls[0][1]).toContain("Password: New-Owner-Pass1");

      await request(app.server).post("/api/v1/auth/login")
        .send({ workspace: "pizza-shop", email: OWNER.email, password: OWNER.password }).expect(400);
      await request(app.server).post("/api/v1/auth/login")
        .send({ workspace: "pizza-shop", phone: OWNER.phone, password: "New-Owner-Pass1" }).expect(200);
      // The session opened with the old password no longer works
      await request(app.server).get("/api/v1/auth/getme")
        .set("Authorization", `Bearer ${login.body.data.accessToken}`).expect(401);

      const audit = await PlatformAuditLog.findOne({ action: "TENANT_OWNER_PASSWORD_SET" }).lean();
      expect(audit.tenantId.toString()).toBe(tenant._id);
      expect(JSON.stringify(audit)).not.toContain("New-Owner-Pass1");
    });

    it("can skip the notification and validates the password", async () => {
      const { tenant } = (await provision({ name: "Pizza Shop", slug: "pizza-shop", owner: OWNER })).body.data;
      enableSms();
      const res = await setPassword(tenant._id, { password: "New-Owner-Pass1", notify: false }).expect(200);
      expect(res.body.data.notification).toEqual({ channel: null, sent: false });
      expect(sendSMS).not.toHaveBeenCalled();

      await setPassword(tenant._id, { password: "short" }).expect(400);
    });

    it("is for platform superadmins only", async () => {
      const { tenant } = (await provision({ name: "Pizza Shop", slug: "pizza-shop", owner: OWNER })).body.data;
      const support = { Authorization: `Bearer ${signPlatformAccessToken(await createPlatformUser({ role: "support" }))}` };
      await setPassword(tenant._id, { password: "New-Owner-Pass1" }, support).expect(403);
    });
  });

  it("rolls everything back when the owner cannot be created", async () => {
    await provision({ name: "Bad", slug: "badshop", owner: { name: "X", email: "not-an-email", phone: "1", password: "Bad-Pass-1" } }).expect(400);
    expect(await Tenant.countDocuments({ slug: "badshop" })).toBe(0);
  });

  it("leaves no tenant or roles behind when a step fails inside the transaction", async () => {
    const spy = jest.spyOn(User, "create").mockRejectedValueOnce(new Error("disk full"));

    await provision({ name: "Fail", slug: "failshop", owner: { name: "Fail", email: "f@fail.com", phone: "01911000000", password: "Fail-Pass-1" } }).expect(500);

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
