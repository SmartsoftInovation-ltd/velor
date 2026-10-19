jest.mock("axios", () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock("nodemailer", () => ({ createTransport: jest.fn() }));
jest.mock("sslcommerz-lts", () => jest.fn());
jest.mock("cloudinary", () => ({ v2: { api: { ping: jest.fn() }, uploader: {}, url: jest.fn(), config: jest.fn() } }));

const axios = require("axios");
const nodemailer = require("nodemailer");
const SSLCommerzPayment = require("sslcommerz-lts");
const cloudinary = require("cloudinary").v2;
const request = require("supertest");
const { connectTestDb, clearTestDb, disconnectTestDb } = require("../helpers/db");
const { setPlatformEnv, createPlatformUser, buildPlatformApp } = require("../helpers/platform");
const { setSettingsEnv } = require("../helpers/settings");
const { signPlatformAccessToken } = require("../../src/utils/platformTokens");
const Tenant = require("../../src/models/platform/tenant.model");
const service = require("../../src/settings/settings.service");

describe("POST /platform/tenants/:id/settings/:section/test", () => {
  let app;
  let tenant;
  let auth;

  beforeAll(async () => {
    setPlatformEnv();
    setSettingsEnv();
    await connectTestDb();
    service.setSettingsPublisher(async () => {});
    app = buildPlatformApp();
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    service.clearSettingsCache();
    tenant = await Tenant.create({ name: "Pizza", slug: "pizzashop", status: "active" });
    auth = { Authorization: `Bearer ${signPlatformAccessToken(await createPlatformUser({ role: "superadmin" }))}` };
  });
  afterEach(clearTestDb);
  afterAll(async () => {
    jest.restoreAllMocks();
    await disconnectTestDb();
  });

  const test = (path) => request(app).post(`/api/v1/platform/tenants/${tenant._id}/settings/${path}/test`).set(auth);

  it("reports missing fields without calling the provider", async () => {
    const res = await test("sms").expect(200);
    expect(res.body.data).toEqual({ ok: false, error: "Missing apiKey, senderId" });
    expect(axios.get).not.toHaveBeenCalled();
  });

  it("sms: checks the balance with the tenant key", async () => {
    await service.updateSection(tenant._id, "sms", { enabled: true, apiUrl: "http://sms.test/send", balanceUrl: "http://sms.test/balance", apiKey: "k-123", senderId: "880" }, { allowReadOnly: true });
    axios.get.mockResolvedValue({ data: { balance: 10 } });

    const res = await test("sms").expect(200);
    expect(res.body.data).toEqual({ ok: true, detail: { balance: 10 } });
    expect(axios.get).toHaveBeenCalledWith("http://sms.test/balance", { params: { api_key: "k-123" } });
  });

  it("email: verifies the SMTP connection", async () => {
    await service.updateSection(tenant._id, "email", { mode: "smtp", smtpHost: "smtp.test", smtpUser: "u@test.dev", smtpPassword: "pw" });
    const verify = jest.fn().mockResolvedValue(true);
    nodemailer.createTransport.mockReturnValue({ verify });

    const res = await test("email").expect(200);
    expect(res.body.data.ok).toBe(true);
    expect(nodemailer.createTransport).toHaveBeenCalledWith({ host: "smtp.test", port: 587, secure: false, auth: { user: "u@test.dev", pass: "pw" } });
  });

  it("sslcommerz: opens a sandbox-or-live session with the tenant store", async () => {
    await service.updateSection(tenant._id, "sslcommerz", { enabled: true, storeId: "store1", storePassword: "pass1" });
    SSLCommerzPayment.mockImplementation(() => ({ init: jest.fn().mockResolvedValue({ status: "SUCCESS", GatewayPageURL: "https://gw" }) }));

    const res = await test("payment/sslcommerz").expect(200);
    expect(res.body.data.ok).toBe(true);
    expect(SSLCommerzPayment).toHaveBeenCalledWith("store1", "pass1", false);
  });

  it("pathao: issues a token without storing it", async () => {
    await service.updateSection(tenant._id, "pathao", { enabled: true, baseUrl: "https://pathao.test", clientId: "c", clientSecret: "s", username: "u", password: "p", storeId: "1" });
    axios.post.mockResolvedValue({ data: { access_token: "AT", refresh_token: "RT", expires_in: 10 } });

    const res = await test("couriers/pathao").expect(200);
    expect(res.body.data.ok).toBe(true);
    expect(JSON.stringify(res.body)).not.toContain("AT");
  });

  it("steadfast: reads the balance with the tenant keys", async () => {
    await service.updateSection(tenant._id, "steadfast", { enabled: true, baseUrl: "https://sf.test/api/v1", apiKey: "ak", secretKey: "sk" });
    axios.get.mockResolvedValue({ data: { status: 200, current_balance: 5 } });

    const res = await test("couriers/steadfast").expect(200);
    expect(res.body.data).toEqual({ ok: true, detail: { current_balance: 5 } });
    expect(axios.get).toHaveBeenCalledWith("https://sf.test/api/v1/get_balance", { headers: { "Api-Key": "ak", "Secret-Key": "sk" } });
  });

  it("cloudinary: pings with the tenant credentials", async () => {
    await service.updateSection(tenant._id, "cloudinary", { enabled: true, cloudName: "cdn", apiKey: "1", apiSecret: "s" });
    cloudinary.api.ping.mockResolvedValue({ status: "ok" });

    const res = await test("cloudinary").expect(200);
    expect(res.body.data.ok).toBe(true);
    expect(cloudinary.api.ping).toHaveBeenCalledWith({ cloud_name: "cdn", api_key: "1", api_secret: "s" });
  });

  it("cloudinary: reports the provider's reason when the credentials are rejected", async () => {
    await service.updateSection(tenant._id, "cloudinary", { enabled: true, cloudName: "cdn", apiKey: "1", apiSecret: "wrong-secret" });
    cloudinary.api.ping.mockRejectedValue({ error: { message: "api_secret mismatch", http_code: 401 } });

    const res = await test("cloudinary").expect(200);
    expect(res.body.data).toEqual({ ok: false, error: "api_secret mismatch" });
  });

  it("has no test for general settings", async () => {
    await test("general").expect(404);
  });
});
