const IORedis = require("ioredis");
const mongoose = require("mongoose");
const { connectTestDb, clearTestDb, disconnectTestDb } = require("../helpers/db");
const { setSettingsEnv } = require("../helpers/settings");
const TenantSettings = require("../../src/models/platform/tenantSettings.model");
const service = require("../../src/settings/settings.service");
const { waitFor } = require("../helpers/waitFor");

const T = new mongoose.Types.ObjectId();
const OTHER = new mongoose.Types.ObjectId();

describe("settings.service", () => {
  const published = [];

  beforeAll(async () => {
    setSettingsEnv();
    await connectTestDb();
    await TenantSettings.init();
  });
  beforeEach(() => {
    service.clearSettingsCache();
    published.length = 0;
    service.setSettingsPublisher(async (message) => published.push(message));
  });
  afterEach(clearTestDb);
  afterAll(async () => {
    await service.stopSettingsInvalidationListener();
    await disconnectTestDb();
  });

  describe("defaults", () => {
    it("returns defaults for a tenant without settings", async () => {
      const settings = await service.getSettings(T);
      expect(settings.general).toMatchObject({ invoicePrefix: "INV", currency: "BDT", timezone: "Asia/Dhaka" });
      expect(settings.sms).toMatchObject({ enabled: false, provider: "bulksmsbd" });
      expect(settings.email.mode).toBe("smtp");
      expect(settings.cloudinary.enabled).toBe(false);
      expect(settings.groq).toMatchObject({ enabled: false, model: "llama-3.3-70b-versatile", temperature: 0.3 });
    });
  });

  describe("updateSection", () => {
    const smsPatch = {
      enabled: true,
      apiUrl: "http://bulksmsbd.net/api/smsapi",
      apiKey: "pizzashop-real-api-key",
      senderId: "8809617000000",
    };

    it("encrypts secrets, returns a masked section and reports changed field names", async () => {
      const result = await service.updateSection(T, "sms", smsPatch);

      expect(result.version).toBe(1);
      expect(result.changes.sort()).toEqual(["sms.apiKey", "sms.apiUrl", "sms.enabled", "sms.senderId"]);
      expect(result.section.apiKey).toEqual({ isSet: true, last4: "-key", updatedAt: expect.any(Date) });
      expect(JSON.stringify(result)).not.toContain("pizzashop-real-api-key");

      const raw = await TenantSettings.findOne({ tenantId: T }).lean();
      expect(JSON.stringify(raw)).not.toContain("pizzashop-real-api-key");

      const settings = await service.getSettings(T);
      expect(settings.sms.apiKey).toBe("pizzashop-real-api-key");
    });

    it("keeps an omitted secret, replaces a provided one and clears it with null", async () => {
      await service.updateSection(T, "sms", smsPatch);

      const keep = await service.updateSection(T, "sms", { senderId: "8809617111111" });
      expect(keep.changes).toEqual(["sms.senderId"]);
      expect((await service.getSettings(T)).sms.apiKey).toBe("pizzashop-real-api-key");

      await service.updateSection(T, "sms", { apiKey: "new-api-key-value" });
      expect((await service.getSettings(T)).sms.apiKey).toBe("new-api-key-value");

      await service.updateSection(T, "sms", { enabled: false });
      const cleared = await service.updateSection(T, "sms", { apiKey: null });
      expect(cleared.section.apiKey.isSet).toBe(false);
      expect((await service.getSettings(T)).sms.apiKey).toBeNull();
    });

    it("does not count unchanged values as changes", async () => {
      await service.updateSection(T, "general", { invoicePrefix: "PZS" });
      const again = await service.updateSection(T, "general", { invoicePrefix: "pzs" });
      expect(again.changes).toEqual([]);
    });

    it("rejects enabling a section without its required fields", async () => {
      await expect(service.updateSection(T, "sms", { enabled: true })).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringMatching(/apiUrl.*apiKey.*senderId/),
      });
      await expect(service.updateSection(T, "email", { mode: "smtp" })).rejects.toMatchObject({ statusCode: 400 });
    });

    it("validates field formats and rejects unknown fields and sections", async () => {
      await expect(service.updateSection(T, "general", { invoicePrefix: "TOO-LONG-PREFIX" })).rejects.toMatchObject({ statusCode: 400 });
      await expect(service.updateSection(T, "general", { orderHotline: "12345" })).rejects.toMatchObject({ statusCode: 400 });
      await expect(service.updateSection(T, "groq", { apiKey: "sk-not-groq" })).rejects.toMatchObject({ statusCode: 400 });
      await expect(service.updateSection(T, "sms", { password: "x" })).rejects.toMatchObject({ statusCode: 400 });
      await expect(service.updateSection(T, "nope", {})).rejects.toMatchObject({ statusCode: 404 });
    });

    it("restricts which fields may be written when allowedFields is given", async () => {
      await expect(
        service.updateSection(T, "general", { invoicePrefix: "PZS" }, { allowedFields: ["orderHotline", "facebookUrl"] }),
      ).rejects.toMatchObject({ statusCode: 403 });
      await expect(
        service.updateSection(T, "general", { orderHotline: "01711000000" }, { allowedFields: ["orderHotline", "facebookUrl"] }),
      ).resolves.toMatchObject({ changes: ["general.orderHotline"] });
    });

    it("keeps tenants separate", async () => {
      await service.updateSection(T, "general", { invoicePrefix: "PZS" });
      expect((await service.getSettings(OTHER)).general.invoicePrefix).toBe("INV");
    });

    it("publishes an invalidation for the tenant", async () => {
      await service.updateSection(T, "general", { invoicePrefix: "PZS" });
      expect(published).toEqual([JSON.stringify({ tenantId: T.toString(), version: 1 })]);
    });
  });

  describe("masked views and features", () => {
    beforeEach(async () => {
      await service.updateSection(T, "sms", {
        enabled: true,
        apiUrl: "http://bulksmsbd.net/api/smsapi",
        apiKey: "pizzashop-real-api-key",
        senderId: "8809617000000",
      });
      await service.updateSection(T, "cloudinary", { enabled: true, cloudName: "pizza-cdn", apiKey: "123456789", apiSecret: "cloud-secret-value" });
    });

    it("getMaskedSettings never includes plaintext secrets; owner view hides secret metadata", async () => {
      const platformView = await service.getMaskedSettings(T);
      expect(platformView.sms.apiKey).toMatchObject({ isSet: true, last4: "-key" });

      const ownerView = await service.getMaskedSettings(T, { ownerView: true });
      expect(ownerView.sms.apiKey).toEqual({ isSet: true });
      expect(JSON.stringify(ownerView)).not.toMatch(/pizzashop-real-api-key|cloud-secret-value/);
    });

    it("email in platform mode only counts as configured when a platform sender exists", async () => {
      const saved = { mail: process.env.HOST_MAIL, pass: process.env.HOST_APP_PASSWORD };
      delete process.env.HOST_MAIL;
      delete process.env.HOST_APP_PASSWORD;
      try {
        expect((await service.getFeatures(T)).email).toBe(false);
        process.env.HOST_MAIL = "platform@mail.test";
        process.env.HOST_APP_PASSWORD = "pass";
        expect((await service.getFeatures(T)).email).toBe(true);
      } finally {
        if (saved.mail) process.env.HOST_MAIL = saved.mail; else delete process.env.HOST_MAIL;
        if (saved.pass) process.env.HOST_APP_PASSWORD = saved.pass; else delete process.env.HOST_APP_PASSWORD;
      }
    });

    it("getFeatures reports which integrations are configured", async () => {
      process.env.HOST_MAIL = "platform@mail.test";
      process.env.HOST_APP_PASSWORD = "pass";
      expect(await service.getFeatures(T)).toEqual({
        sms: true,
        email: true,
        sslcommerz: false,
        couriers: { pathao: false, steadfast: false },
        cloudinary: true,
        ai: false,
      });
    });
  });

  describe("cache", () => {
    it("serves from cache until invalidated", async () => {
      await service.updateSection(T, "general", { invoicePrefix: "PZS" });
      await service.getSettings(T);

      await TenantSettings.updateOne({ tenantId: T }, { $set: { "data.general.invoicePrefix": "RAW" } });
      expect((await service.getSettings(T)).general.invoicePrefix).toBe("PZS");

      service.invalidateSettingsCache(T);
      expect((await service.getSettings(T)).general.invoicePrefix).toBe("RAW");
    });

    it("an invalidation message from another process evicts the cached tenant", async () => {
      await service.updateSection(T, "general", { invoicePrefix: "PZS" });
      await service.startSettingsInvalidationListener(process.env.REDIS_URL || "redis://127.0.0.1:6379");
      await service.getSettings(T);
      await TenantSettings.updateOne({ tenantId: T }, { $set: { "data.general.invoicePrefix": "RAW" } });

      const otherProcess = new IORedis(process.env.REDIS_URL || "redis://127.0.0.1:6379");
      await otherProcess.publish(service.INVALIDATION_CHANNEL, JSON.stringify({ tenantId: T.toString(), version: 2 }));
      await otherProcess.quit();

      await waitFor(async () => expect((await service.getSettings(T)).general.invoicePrefix).toBe("RAW"));
    });
  });

  describe("webhook URLs", () => {
    it("fall back to the domain the request came in on when API_PUBLIC_URL is not set", () => {
      const saved = process.env.API_PUBLIC_URL;
      delete process.env.API_PUBLIC_URL;
      try {
        expect(service.getWebhookUrls({ webhookKey: "K" }, "https://api.live-store.com").pathao)
          .toBe("https://api.live-store.com/api/v1/hooks/pathao/K");
      } finally {
        process.env.API_PUBLIC_URL = saved;
      }
    });

    it("API_PUBLIC_URL wins over the request domain", () => {
      expect(service.getWebhookUrls({ webhookKey: "K" }, "http://localhost:3000").pathao)
        .toBe("https://api.example.test/api/v1/hooks/pathao/K");
    });

    it("builds per-tenant callback URLs from API_PUBLIC_URL and the webhook key", () => {
      expect(service.getWebhookUrls({ webhookKey: "KEY123" })).toEqual({
        sslcommerz: {
          success: "https://api.example.test/api/v1/hooks/sslcommerz/KEY123/success",
          fail: "https://api.example.test/api/v1/hooks/sslcommerz/KEY123/fail",
          cancel: "https://api.example.test/api/v1/hooks/sslcommerz/KEY123/cancel",
          ipn: "https://api.example.test/api/v1/hooks/sslcommerz/KEY123/ipn",
        },
        pathao: "https://api.example.test/api/v1/hooks/pathao/KEY123",
        steadfast: "https://api.example.test/api/v1/hooks/steadfast/KEY123",
      });
    });
  });
});
