jest.mock("../../src/helpers/sms", () => ({ sendSMS: jest.fn(), getSmsBalance: jest.fn() }));

const request = require("supertest");
const { sendSMS } = require("../../src/helpers/sms");
const { connectTestDb, clearTestDb, disconnectTestDb } = require("../helpers/db");
const { setSettingsEnv } = require("../helpers/settings");
const { setPlatformEnv } = require("../helpers/platform");
const { loadApp, STAFF_ENV } = require("../helpers/tenantApp");
const { runForTenant } = require("../../src/tenancy/context");
const { invalidateTenantCache } = require("../../src/tenancy/tenantResolver");
const { seedTenantRoles } = require("../../src/tenancy/roleTemplate");
const Tenant = require("../../src/models/platform/tenant.model");
const User = require("../../src/models/user.model");
const service = require("../../src/settings/settings.service");
const { testRedis } = require("../helpers/redis");

describe("password reset by SMS code", () => {
  let app;
  let tenant;
  const envBackup = { ...process.env };
  const PHONE = "01711000000";
  // Reset codes go through the store's own SMS account (set by the platform on the seller's page),
  // never the platform's, so this is a tenant setting and not an env variable.
  const storeSms = (tenantId) =>
    service.updateSection(tenantId, "sms", {
      enabled: true, apiUrl: "https://sms.test/send", apiKey: "k", senderId: "s",
    }, { allowReadOnly: true });

  beforeAll(async () => {
    Object.assign(process.env, STAFF_ENV);
    setSettingsEnv();
    setPlatformEnv();
    await connectTestDb();
    app = loadApp();
    service.setSettingsPublisher(async () => {});
    jest.spyOn(console, "log").mockImplementation(() => {});
  });

  beforeEach(async () => {
    invalidateTenantCache();
    service.clearSettingsCache();
    sendSMS.mockReset().mockResolvedValue({ response_code: 202 });

    tenant = await Tenant.create({ name: "Pizza Shop", slug: "pizzashop", status: "active" });
    await storeSms(tenant._id);
    const roles = await seedTenantRoles(tenant._id);
    await runForTenant(tenant._id, () =>
      User.create({ name: "Rahim", email: "rahim@pizza.com", phone: PHONE, password: "Old-Pass-1", roles: [roles.owner._id] }),
    );
  });

  afterEach(clearTestDb);
  afterAll(async () => {
    process.env = { ...envBackup };
    jest.restoreAllMocks();
    await app.close();
    await disconnectTestDb();
  });

  const forgot = (body) => request(app.server).post("/api/v1/auth/forgot-password").send({ workspace: "pizzashop", ...body });
  const reset = (body) => request(app.server).post("/api/v1/auth/reset-password").send({ workspace: "pizzashop", ...body });
  const login = (password) => request(app.server).post("/api/v1/auth/login").send({ workspace: "pizzashop", phone: PHONE, password });
  const sentCode = () => sendSMS.mock.calls.at(-1)[1].match(/\b(\d{6})\b/)[1];

  it("sends a 6-digit code to the account's phone, by email or phone lookup", async () => {
    await forgot({ email: "rahim@pizza.com" }).expect(200);
    expect(sendSMS).toHaveBeenCalledTimes(1);
    expect(sendSMS.mock.calls[0][0]).toBe(PHONE);
    expect(sendSMS.mock.calls[0][1]).toMatch(/Pizza Shop password reset code is \d{6}/);

    await forgot({ phone: PHONE }).expect(200);
    expect(sendSMS).toHaveBeenCalledTimes(2);

    // Only a hash of the code is kept, in Redis, and it expires in 3 minutes
    const user = await runForTenant(tenant._id, () => User.findOne({ phone: PHONE }).lean());
    const key = `pwreset:${tenant._id}:${user._id}`;
    expect(await testRedis().get(key)).not.toContain(sentCode());
    expect(await testRedis().ttl(key)).toBeGreaterThan(170);
    expect(await testRedis().ttl(key)).toBeLessThanOrEqual(180);
    expect(user.resetPasswordToken).toBeUndefined();
  });

  it("tells the form the code lasts 3 minutes, for known and unknown accounts alike", async () => {
    expect((await forgot({ phone: PHONE }).expect(200)).body.data).toEqual({ expiresIn: 180 });
    expect((await forgot({ phone: "01799999999" }).expect(200)).body.data).toEqual({ expiresIn: 180 });
    expect(sendSMS.mock.calls[0][1]).toMatch(/expires in 3 minutes/);
  });

  it("finds an account saved with the 880 prefix", async () => {
    await runForTenant(tenant._id, () => User.updateOne({ phone: PHONE }, { $set: { phone: "+8801711000000" } }));
    await forgot({ phone: PHONE }).expect(200);
    expect(sendSMS).toHaveBeenCalledTimes(1);
    await reset({ phone: PHONE, otp: sentCode(), newPassword: "New-Pass-1" }).expect(200);
  });

  // BulkSMSBD answers HTTP 200 with its own error code when it rejects a message
  it("reports a rejected SMS instead of claiming it was sent, and keeps no code", async () => {
    sendSMS.mockResolvedValue({ response_code: 1032, error_message: "IP not whitelisted" });
    const res = await forgot({ phone: PHONE }).expect(503);
    expect(res.body.code).toBe("SMS_SEND_FAILED");
    expect(await testRedis().keys(`pwreset:${tenant._id}:*`)).toEqual([]);
  });

  it("a resent code replaces the previous one", async () => {
    await forgot({ phone: PHONE }).expect(200);
    const first = sentCode();
    await forgot({ phone: PHONE }).expect(200);
    const second = sentCode();
    if (first !== second) {
      await reset({ phone: PHONE, otp: first, newPassword: "New-Pass-1" }).expect(400);
    }
    await reset({ phone: PHONE, otp: second, newPassword: "New-Pass-1" }).expect(200);
  });

  it("resets the password with the code and signs out old sessions", async () => {
    const session = await login("Old-Pass-1").expect(200);
    await forgot({ phone: PHONE }).expect(200);

    await reset({ phone: PHONE, otp: sentCode(), newPassword: "New-Pass-1" }).expect(200);

    await login("Old-Pass-1").expect(400);
    await login("New-Pass-1").expect(200);
    await request(app.server).get("/api/v1/auth/getme").set("Authorization", `Bearer ${session.body.data.accessToken}`).expect(401);
    // The code is single-use
    await reset({ phone: PHONE, otp: sentCode(), newPassword: "Other-Pass-1" }).expect(400);
  });

  it("answers the same for unknown accounts and sends nothing", async () => {
    const res = await forgot({ email: "nobody@pizza.com" }).expect(200);
    expect(res.body.message).toMatch(/if that account has a phone number/i);
    expect(sendSMS).not.toHaveBeenCalled();
  });

  it("burns the code after 5 wrong guesses", async () => {
    await forgot({ phone: PHONE }).expect(200);
    const code = sentCode();
    const wrong = code === "000000" ? "111111" : "000000";

    for (let i = 0; i < 5; i += 1) {
      await reset({ phone: PHONE, otp: wrong, newPassword: "New-Pass-1" }).expect(400);
    }
    await reset({ phone: PHONE, otp: code, newPassword: "New-Pass-1" }).expect(400);
  });

  it("rejects an expired code", async () => {
    await forgot({ phone: PHONE }).expect(200);
    // What Redis does when the 3 minutes run out
    const user = await runForTenant(tenant._id, () => User.findOne({ phone: PHONE }).lean());
    await testRedis().del(`pwreset:${tenant._id}:${user._id}`);
    await reset({ phone: PHONE, otp: sentCode(), newPassword: "New-Pass-1" }).expect(400);
  });

  // The platform's own SMS and email accounts are for the platform console; a
  // store that has not set up SMS cannot send reset codes through them.
  it("is unavailable when the store has not set up SMS, and never falls back to env or email", async () => {
    await service.updateSection(tenant._id, "sms", { enabled: false });
    service.clearSettingsCache();
    Object.assign(process.env, {
      BULK_SMS_URL: "https://sms.test/send", BULK_SMS_API_KEY: "k", BULK_SMS_SENDER_ID: "s",
      HOST_MAIL: "platform@mail.test", HOST_APP_PASSWORD: "p",
    });

    const res = await forgot({ phone: PHONE }).expect(503);
    expect(res.body.code).toBe("SMS_NOT_CONFIGURED");
    expect(sendSMS).not.toHaveBeenCalled();
  });
});
