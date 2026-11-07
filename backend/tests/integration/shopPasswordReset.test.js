jest.mock("../../src/helpers/sms", () => ({ sendSMS: jest.fn(), getSmsBalance: jest.fn() }));

const request = require("supertest");
const { sendSMS } = require("../../src/helpers/sms");
const { connectTestDb, clearTestDb, disconnectTestDb } = require("../helpers/db");
const { setSettingsEnv } = require("../helpers/settings");
const { loadApp, createTenantWithStaff, STAFF_ENV } = require("../helpers/tenantApp");
const { runForTenant } = require("../../src/tenancy/context");
const { invalidateTenantCache } = require("../../src/tenancy/tenantResolver");
const { resetRateLimitCounters } = require("../../src/middleware/rateLimit.middleware");
const TenantDomain = require("../../src/models/platform/tenantDomain.model");
const User = require("../../src/models/user.model");
const service = require("../../src/settings/settings.service");
const { testRedis, closeRedis } = require("../helpers/redis");

/**
 * A shopper who forgot their password gets a 6-digit code by SMS on the
 * storefront. The endpoints must never tell a visitor whether a number has an
 * account, and must never reset a staff account.
 */
describe("storefront password reset by SMS", () => {
  let app;
  let velor;
  let pizza;
  const envBackup = { ...process.env };
  const VELOR = { "x-tenant-host": "velor.com" };
  const PIZZA = { "x-tenant-host": "pizzashop.com" };
  const PHONE = "01711000000";
  const SHOPPER = { name: "Rahim", email: "rahim@example.com", phone: PHONE, password: "Old-Pass-1" };

  const storeSms = (tenantId) =>
    service.updateSection(tenantId, "sms", { enabled: true, apiUrl: "https://sms.test/send", apiKey: "k", senderId: "s" }, { allowReadOnly: true });

  beforeAll(async () => {
    setSettingsEnv();
    await connectTestDb();
    app = loadApp();
    service.setSettingsPublisher(async () => {});
    jest.spyOn(console, "log").mockImplementation(() => {});
  });

  beforeEach(async () => {
    process.env = { ...envBackup, ...STAFF_ENV };
    setSettingsEnv();
    process.env.TENANCY_MODE = "strict";
    process.env.TRUST_TENANT_HOST_HEADER = "true";
    invalidateTenantCache();
    service.clearSettingsCache();
    resetRateLimitCounters();
    sendSMS.mockReset().mockResolvedValue({ response_code: 202 });

    velor = await createTenantWithStaff({ slug: "velor", email: "staff@velor.test", password: "Velor-Pass1" });
    pizza = await createTenantWithStaff({ slug: "pizzashop", email: "staff@pizza.test", password: "Pizza-Pass1" });
    await TenantDomain.create({ tenantId: velor.tenant._id, host: "velor.com", status: "active" });
    await TenantDomain.create({ tenantId: pizza.tenant._id, host: "pizzashop.com", status: "active" });
    await storeSms(velor.tenant._id);
    await request(app.server).post("/api/v1/shop/auth/register").set(VELOR).send(SHOPPER).expect(201);
  });

  afterEach(async () => {
    await clearTestDb();
    await testRedis().flushdb();
    invalidateTenantCache();
  });

  afterAll(async () => {
    process.env = { ...envBackup };
    jest.restoreAllMocks();
    await app.close();
    await disconnectTestDb();
    await closeRedis();
  });

  const post = (path, headers, body) => request(app.server).post(`/api/v1/shop/auth/${path}`).set(headers).send(body);
  const forgot = (phone, headers = VELOR) => post("forgot-password", headers, { phone });
  const verify = (otp, headers = VELOR) => post("verify-reset-code", headers, { phone: PHONE, otp });
  const reset = (otp, newPassword = "New-Pass-1", headers = VELOR) => post("reset-password", headers, { phone: PHONE, otp, newPassword });
  const login = (password) => post("login", VELOR, { phone: PHONE, password });
  const sentCode = () => sendSMS.mock.calls.at(-1)[1].match(/\b(\d{6})\b/)[1];

  it("sends a code to the shopper's mobile, accepting the +880 form", async () => {
    const res = await forgot("+8801711000000").expect(200);
    expect(res.body.data).toEqual({ expiresIn: 180 });
    expect(sendSMS).toHaveBeenCalledTimes(1);
    expect(sendSMS.mock.calls[0][0]).toBe(PHONE);
    expect(sendSMS.mock.calls[0][1]).toMatch(/password reset code is \d{6}/);
  });

  it("checks the code, then resets with it, ending old sessions", async () => {
    const session = (await login("Old-Pass-1").expect(200)).body.data;
    await forgot(PHONE).expect(200);

    await verify("000000" === sentCode() ? "111111" : "000000").expect(400);
    await verify(sentCode()).expect(200);
    await reset(sentCode()).expect(200);

    await login("Old-Pass-1").expect(400);
    await login("New-Pass-1").expect(200);
    await request(app.server).get("/api/v1/shop/me").set({ ...VELOR, Authorization: `Bearer ${session.accessToken}` }).expect(401);
    await post("refresh", VELOR, { refreshToken: session.refreshToken }).expect(401);
    // Single use
    await reset(sentCode(), "Other-Pass-1").expect(400);
  });

  it("answers an unknown number like a real one, and sends nothing", async () => {
    const real = await forgot(PHONE).expect(200);
    sendSMS.mockClear();
    const unknown = await forgot("01999999999").expect(200);
    expect(unknown.body).toEqual(real.body);
    expect(sendSMS).not.toHaveBeenCalled();
  });

  it("never sends a code to a staff account", async () => {
    await runForTenant(velor.tenant._id, () => User.updateOne({ _id: velor.user._id }, { phone: "01822000000" }));
    await forgot("01822000000").expect(200);
    expect(sendSMS).not.toHaveBeenCalled();
  });

  it("does not reach the account from another store's domain", async () => {
    await storeSms(pizza.tenant._id);
    await forgot(PHONE, PIZZA).expect(200);
    expect(sendSMS).not.toHaveBeenCalled();

    await forgot(PHONE).expect(200);
    await reset(sentCode(), "New-Pass-1", PIZZA).expect(400);
  });

  it("burns the code after five wrong guesses", async () => {
    await forgot(PHONE).expect(200);
    const code = sentCode();
    const wrong = code === "123456" ? "654321" : "123456";
    for (let i = 0; i < 5; i += 1) await verify(wrong).expect(400);
    await reset(code).expect(400);
  });

  it("rejects a bad number and a short password", async () => {
    await forgot("12345").expect(400);
    await forgot(PHONE).expect(200);
    await reset(sentCode(), "abc").expect(400);
  });

  it("says when the store has no SMS set up", async () => {
    const res = await forgot(PHONE, PIZZA).expect(503);
    expect(res.body.code).toBe("SMS_NOT_CONFIGURED");
  });

  it("reports a failed SMS and keeps no code", async () => {
    sendSMS.mockResolvedValue({ response_code: 1032, error_message: "IP not whitelisted" });
    await forgot(PHONE).expect(503);
    expect(await testRedis().keys(`pwreset:${velor.tenant._id}:*`)).toEqual([]);
  });
});
