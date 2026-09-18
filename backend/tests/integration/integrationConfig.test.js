const mongoose = require("mongoose");
const { connectTestDb, clearTestDb, disconnectTestDb } = require("../helpers/db");
const { setSettingsEnv } = require("../helpers/settings");
const { runForTenant, runAsPlatform } = require("../../src/tenancy/context");
const service = require("../../src/settings/settings.service");
const config = require("../../src/integrations/config");

const T = new mongoose.Types.ObjectId();

describe("integrations/config", () => {
  const envBackup = { ...process.env };

  beforeAll(async () => {
    await connectTestDb();
    service.setSettingsPublisher(async () => {});
  });
  beforeEach(() => {
    process.env = { ...envBackup };
    setSettingsEnv();
    service.clearSettingsCache();
  });
  afterEach(clearTestDb);
  afterAll(async () => {
    process.env = { ...envBackup };
    await disconnectTestDb();
  });

  const inTenant = (fn) => runForTenant(T, fn);

  describe("without a tenant context", () => {
    // Every store integration is per-store. Reading .env here would let one store
    // spend the platform's SMS credit, send from its address or bill its payment
    // account, so there is no fallback at all.
    it.each([
      ["getGeneralConfig"],
      ["getInvoicePrefix"],
      ["getSmsConfig"],
      ["getMailConfig"],
      ["getSslCommerzConfig"],
      ["getCloudinaryConfig"],
    ])("%s refuses to fall back to env", async (getter) => {
      Object.assign(process.env, {
        INVOICE_PREFIX: "VLR", BULK_SMS_URL: "http://sms.test", BULK_SMS_API_KEY: "envkey", BULK_SMS_SENDER_ID: "880",
        HOST_MAIL: "platform@velor.test", HOST_APP_PASSWORD: "app-pass",
        SSLC_STORE_ID: "envstore", SSLC_STORE_PASSWORD: "envpass", BACKEND_URL: "https://api.velor.test/api/v1",
        CLOUD_NAME: "envcloud", CLOUDINARY_API_KEY: "111", CLOUDINARY_API_SECRET: "envsecret",
      });

      await expect(config[getter]()).rejects.toMatchObject({ name: "TenancyError" });
    });
  });

  describe("platform context", () => {
    const asPlatform = (fn) => runAsPlatform(fn);

    // The platform console has no store to read from: its own SMS and email — and
    // only those two — come from .env.
    it("reads SMS and email from env, and nothing else", async () => {
      Object.assign(process.env, {
        BULK_SMS_URL: "http://sms.test", BULK_SMS_API_KEY: "envkey", BULK_SMS_SENDER_ID: "880",
        HOST_MAIL: "platform@velor.test", HOST_APP_PASSWORD: "app-pass", MAIL_FROM_NAME: "Velor",
        SSLC_STORE_ID: "envstore", CLOUD_NAME: "envcloud", INVOICE_PREFIX: "VLR",
      });

      await expect(asPlatform(() => config.getSmsConfig())).resolves.toMatchObject({
        apiUrl: "http://sms.test", apiKey: "envkey", senderId: "880",
      });
      await expect(asPlatform(() => config.getMailConfig())).resolves.toEqual({
        transport: { service: "gmail", auth: { user: "platform@velor.test", pass: "app-pass" } },
        from: "Velor <platform@velor.test>",
      });

      for (const getter of ["getGeneralConfig", "getInvoicePrefix", "getSslCommerzConfig", "getCloudinaryConfig"]) {
        await expect(asPlatform(() => config[getter]())).rejects.toMatchObject({ name: "TenancyError" });
      }
    });

    it("getMailConfig is null when the platform mail account is unset", async () => {
      delete process.env.HOST_MAIL;
      delete process.env.HOST_APP_PASSWORD;
      await expect(asPlatform(() => config.getMailConfig())).resolves.toBeNull();
    });
  });

  describe("inside a tenant context", () => {
    it("uses the tenant's settings, not env", async () => {
      process.env.BULK_SMS_API_KEY = "envkey";
      await service.updateSection(T, "general", { invoicePrefix: "PZS", orderHotline: "01711000000", storefrontUrl: "https://pizza.test" });
      await service.updateSection(T, "sms", { enabled: true, apiUrl: "http://sms.pizza", apiKey: "pizza-sms-key", senderId: "8801" });
      await service.updateSection(T, "cloudinary", { enabled: true, cloudName: "pizza-cdn", apiKey: "222", apiSecret: "pizza-secret" });
      await service.updateSection(T, "sslcommerz", { enabled: true, isLive: false, storeId: "pizzastore", storePassword: "pizzapass" });

      await inTenant(async () => {
        await expect(config.getInvoicePrefix()).resolves.toBe("PZS");
        await expect(config.getGeneralConfig()).resolves.toMatchObject({ orderHotline: "01711000000", storefrontUrl: "https://pizza.test" });
        await expect(config.getSmsConfig()).resolves.toMatchObject({ apiUrl: "http://sms.pizza", apiKey: "pizza-sms-key", senderId: "8801" });
        await expect(config.getCloudinaryConfig()).resolves.toEqual({ cloud_name: "pizza-cdn", api_key: "222", api_secret: "pizza-secret" });
      });
    });

    it("builds SSLCommerz callback URLs with the tenant webhook key", async () => {
      const Tenant = require("../../src/models/platform/tenant.model");
      const tenant = await Tenant.create({ _id: T, name: "Pizza", slug: "pizzashop", status: "active" });
      await service.updateSection(T, "sslcommerz", { enabled: true, storeId: "s", storePassword: "p" });

      const ssl = await inTenant(() => config.getSslCommerzConfig());
      expect(ssl).toMatchObject({ storeId: "s", storePassword: "p", isLive: false });
      expect(ssl.callbackUrls.ipn).toBe(`https://api.example.test/api/v1/hooks/sslcommerz/${tenant.webhookKey}/ipn`);
    });

    it.each([
      ["getSmsConfig", "SMS_NOT_CONFIGURED"],
      ["getSslCommerzConfig", "SSLCOMMERZ_NOT_CONFIGURED"],
      ["getCloudinaryConfig", "CLOUDINARY_NOT_CONFIGURED"],
    ])("%s throws 422 %s when the tenant has not configured it", async (getter, code) => {
      process.env.BULK_SMS_API_KEY = "envkey";
      process.env.CLOUD_NAME = "envcloud";
      await expect(inTenant(() => config[getter]())).rejects.toMatchObject({ statusCode: 422, code });
    });

    it("getCourierConfig returns a merchant-shaped config per provider", async () => {
      await service.updateSection(T, "pathao", {
        enabled: true, baseUrl: "https://api-hermes.pathao.com", clientId: "cid", clientSecret: "csec",
        username: "u@x.com", password: "pw", storeId: "77", webhookSecret: "whsec",
      });
      await service.updateSection(T, "steadfast", { enabled: true, baseUrl: "https://portal.packzy.com/api/v1", apiKey: "sfkey", secretKey: "sfsec", webhookToken: "sftok" });

      await inTenant(async () => {
        await expect(config.getCourierConfig("pathao")).resolves.toMatchObject({
          merchantID: "cid", merchantSecret: "csec", baseURL: "https://api-hermes.pathao.com", store_id: "77",
          username: "u@x.com", password: "pw", webhookSecret: "whsec", tenantId: T,
        });
        await expect(config.getCourierConfig("steadfast")).resolves.toMatchObject({
          merchantID: "sfkey", merchantSecret: "sfsec", baseURL: "https://portal.packzy.com/api/v1", webhookToken: "sftok",
        });
      });
      service.clearSettingsCache();
      await service.updateSection(T, "steadfast", { enabled: false });
      await expect(inTenant(() => config.getCourierConfig("steadfast"))).rejects.toMatchObject({ code: "COURIER_NOT_CONFIGURED" });
    });

    it("getMailConfig: sends through the store's own SMTP, falls back to the SMTP user as sender, disabled throws", async () => {
      await service.updateSection(T, "email", {
        mode: "smtp", fromName: "Pizza Shop", smtpHost: "smtp.pizza.test", smtpPort: 465,
        smtpSecure: true, smtpUser: "shop@pizza.test", smtpPassword: "smtp-pass", fromEmail: "orders@pizza.test",
      });
      await expect(inTenant(() => config.getMailConfig())).resolves.toEqual({
        transport: { host: "smtp.pizza.test", port: 465, secure: true, auth: { user: "shop@pizza.test", pass: "smtp-pass" } },
        from: "Pizza Shop <orders@pizza.test>",
      });

      // No sender address: the SMTP user is the From, so replies still reach the store
      await service.updateSection(T, "email", { fromEmail: null });
      await expect(inTenant(() => config.getMailConfig())).resolves.toMatchObject({
        from: "Pizza Shop <shop@pizza.test>",
      });

      await service.updateSection(T, "email", { mode: "disabled" });
      await expect(inTenant(() => config.getMailConfig())).rejects.toMatchObject({ code: "EMAIL_NOT_CONFIGURED" });
    });
  });
});
