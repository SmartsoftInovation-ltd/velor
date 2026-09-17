const mongoose = require("mongoose");
const { connectTestDb, clearTestDb, disconnectTestDb } = require("../helpers/db");
const { setSettingsEnv } = require("../helpers/settings");
const { runForTenant } = require("../../src/tenancy/context");
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

  describe("without a tenant context (legacy env)", () => {
    it("reads general, sms, sslcommerz, cloudinary and groq from env", async () => {
      Object.assign(process.env, {
        INVOICE_PREFIX: "VLR", ORDER_HOT_LINE_NUMBER: "01700000000", FACEBOOK_URL: "https://fb.com/velor",
        FRONTEND_URL: "https://velor.test", BULK_SMS_URL: "http://sms.test", BULK_SMS_API_KEY: "envkey", BULK_SMS_SENDER_ID: "880",
        SSLC_STORE_ID: "envstore", SSLC_STORE_PASSWORD: "envpass", BACKEND_URL: "https://api.velor.test/api/v1", NODE_ENV: "production",
        CLOUD_NAME: "envcloud", CLOUDINARY_API_KEY: "111", CLOUDINARY_API_SECRET: "envsecret", GROQ_API_KEY: "gsk_env",
      });

      await expect(config.getGeneralConfig()).resolves.toEqual({
        invoicePrefix: "VLR", orderHotline: "01700000000", facebookUrl: "https://fb.com/velor", storefrontUrl: "https://velor.test",
      });
      await expect(config.getSmsConfig()).resolves.toMatchObject({ apiUrl: "http://sms.test", apiKey: "envkey", senderId: "880" });
      await expect(config.getSslCommerzConfig()).resolves.toEqual({
        storeId: "envstore", storePassword: "envpass", isLive: true,
        callbackUrls: {
          success: "https://api.velor.test/api/v1/payment/success",
          fail: "https://api.velor.test/api/v1/payment/fail",
          cancel: "https://api.velor.test/api/v1/payment/cancel",
          ipn: "https://api.velor.test/api/v1/payment/ipn",
        },
      });
      await expect(config.getCloudinaryConfig()).resolves.toEqual({ cloud_name: "envcloud", api_key: "111", api_secret: "envsecret", folder: "" });
      await expect(config.getGroqConfig()).resolves.toEqual({ apiKey: "gsk_env", model: "llama-3.3-70b-versatile", temperature: 0.3 });
    });

    it("defaults the invoice prefix to INV", async () => {
      delete process.env.INVOICE_PREFIX;
      await expect(config.getInvoicePrefix()).resolves.toBe("INV");
    });
  });

  describe("inside a tenant context", () => {
    it("uses the tenant's settings, not env", async () => {
      process.env.BULK_SMS_API_KEY = "envkey";
      await service.updateSection(T, "general", { invoicePrefix: "PZS", orderHotline: "01711000000", storefrontUrl: "https://pizza.test" });
      await service.updateSection(T, "sms", { enabled: true, apiUrl: "http://sms.pizza", apiKey: "pizza-sms-key", senderId: "8801" });
      await service.updateSection(T, "cloudinary", { enabled: true, cloudName: "pizza-cdn", apiKey: "222", apiSecret: "pizza-secret", folder: "pizza" });
      await service.updateSection(T, "groq", { enabled: true, apiKey: "gsk_pizza", model: "llama-3.1-8b-instant" });
      await service.updateSection(T, "sslcommerz", { enabled: true, isLive: false, storeId: "pizzastore", storePassword: "pizzapass" });

      await inTenant(async () => {
        await expect(config.getInvoicePrefix()).resolves.toBe("PZS");
        await expect(config.getGeneralConfig()).resolves.toMatchObject({ orderHotline: "01711000000", storefrontUrl: "https://pizza.test" });
        await expect(config.getSmsConfig()).resolves.toMatchObject({ apiUrl: "http://sms.pizza", apiKey: "pizza-sms-key", senderId: "8801" });
        await expect(config.getCloudinaryConfig()).resolves.toEqual({ cloud_name: "pizza-cdn", api_key: "222", api_secret: "pizza-secret", folder: "pizza" });
        await expect(config.getGroqConfig()).resolves.toMatchObject({ apiKey: "gsk_pizza", model: "llama-3.1-8b-instant" });
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
      ["getGroqConfig", "AI_NOT_CONFIGURED"],
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

    it("getMailConfig: smtp mode uses tenant SMTP, platform mode uses the platform sender with tenant branding, disabled throws", async () => {
      Object.assign(process.env, { HOST_MAIL: "platform@mail.test", HOST_APP_PASSWORD: "platform-pass", MAIL_FROM_NAME: "Platform" });

      await service.updateSection(T, "email", { mode: "platform", fromName: "Pizza Shop", replyTo: "hello@pizza.test" });
      await expect(inTenant(() => config.getMailConfig())).resolves.toEqual({
        transport: { service: "gmail", auth: { user: "platform@mail.test", pass: "platform-pass" } },
        from: "Pizza Shop <platform@mail.test>",
        replyTo: "hello@pizza.test",
      });

      await service.updateSection(T, "email", { mode: "smtp", smtpHost: "smtp.pizza.test", smtpPort: 465, smtpSecure: true, smtpUser: "shop@pizza.test", smtpPassword: "smtp-pass", fromEmail: "shop@pizza.test" });
      await expect(inTenant(() => config.getMailConfig())).resolves.toEqual({
        transport: { host: "smtp.pizza.test", port: 465, secure: true, auth: { user: "shop@pizza.test", pass: "smtp-pass" } },
        from: "Pizza Shop <shop@pizza.test>",
        replyTo: "hello@pizza.test",
      });

      await service.updateSection(T, "email", { mode: "disabled" });
      await expect(inTenant(() => config.getMailConfig())).rejects.toMatchObject({ code: "EMAIL_NOT_CONFIGURED" });
    });
  });
});
