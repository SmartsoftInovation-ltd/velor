const mongoose = require("mongoose");
const { connectTestDb, disconnectTestDb } = require("../helpers/db");
const { setSettingsEnv } = require("../helpers/settings");
const { runMigrations, runCutover } = require("../../src/migrations/runner");
const { runForTenant } = require("../../src/tenancy/context");
const Tenant = require("../../src/models/platform/tenant.model");
const service = require("../../src/settings/settings.service");
const Product = require("../../src/models/product.model");
const User = require("../../src/models/user.model");
const Counter = require("../../src/models/counter.model");
const Merchant = require("../../src/models/marchant.model");
const Role = require("../../src/models/role.model");

const LEGACY_ENV = {
  INVOICE_PREFIX: "VLR",
  ORDER_HOT_LINE_NUMBER: "01700000000",
  FACEBOOK_URL: "https://facebook.com/velor",
  FRONTEND_URL: "https://velor.test",
  BULK_SMS_URL: "http://bulksmsbd.net/api/smsapi",
  BULK_SMS_API_KEY: "velor-sms-key",
  BULK_SMS_SENDER_ID: "8809617",
  SSLC_STORE_ID: "velorstore",
  SSLC_STORE_PASSWORD: "velorpass",
  HOST_MAIL: "velor@mail.test",
  HOST_APP_PASSWORD: "mail-pass",
  MAIL_FROM_NAME: "Velor",
  WEBHOOK_SECRET: "velor-pathao-webhook",
  STEADFAST_API_KEY: "velor-steadfast-webhook",
  CLOUD_NAME: "velor-cloud",
  CLOUDINARY_API_KEY: "123456",
  CLOUDINARY_API_SECRET: "velor-cloud-secret",
  GROQ_API_KEY: "gsk_velor",
};

describe("Velor migration", () => {
  const envBackup = { ...process.env };
  let velor;
  const raw = (Model) => Model.collection;

  beforeAll(async () => {
    Object.assign(process.env, LEGACY_ENV);
    setSettingsEnv();
    await connectTestDb();
    service.setSettingsPublisher(async () => {});
    jest.spyOn(console, "log").mockImplementation(() => {});

    velor = await Tenant.create({ name: "Velor", slug: "velor", status: "active" });

    // Legacy single-tenant data: no tenantId, global unique indexes
    await raw(Product).createIndex({ slug: 1 }, { unique: true });
    await raw(Counter).createIndex({ key: 1 }, { unique: true });
    await raw(User).createIndex({ email: 1 }, { unique: true });
    await raw(Product).insertMany([
      { name: "Shirt", slug: "shirt", thumbnail: { url: "u", publicId: "p1" }, image: [{ url: "u2", publicId: "p2" }, { url: "", publicId: "" }] },
      { name: "Pant", slug: "pant", thumbnail: { url: "", publicId: "" } },
    ]);
    await raw(User).insertMany([
      { name: "Owner", email: "owner@velor.test", password: "x" },
      { name: "Staff", email: "staff@velor.test", password: "x" },
    ]);
    await raw(Counter).insertOne({ key: "SALES_INVOICE", seq: 41 });
    const { insertedIds } = await raw(Role).insertMany([
      { name: "superAdmin", slug: "superadmin", isActive: true, permissions: [] },
      { name: "manager", slug: "manager", isActive: true, permissions: [] },
    ]);
    await raw(User).updateOne({ email: "owner@velor.test" }, { $set: { roles: [insertedIds[0]] } });
    await raw(Merchant).insertMany([
      { merchantID: "pathao-client", merchantSecret: "pathao-secret", baseURL: "https://api-hermes.pathao.com", serviceProvider: "pathao", store_id: 148890 },
      { merchantID: "sf-api-key", merchantSecret: "sf-secret-key", baseURL: "https://portal.packzy.com/api/v1", serviceProvider: "steadfast" },
    ]);
  });

  afterAll(async () => {
    process.env = { ...envBackup };
    jest.restoreAllMocks();
    await disconnectTestDb();
  });

  it("refuses an unknown tenant", async () => {
    await expect(runMigrations({ tenantSlug: "nope" })).rejects.toThrow(/tenant "nope" not found/i);
  });

  describe("first run", () => {
    let report;
    beforeAll(async () => {
      report = await runMigrations({ tenantSlug: "velor" });
    });

    it("applies every migration in order", () => {
      expect(report.map((r) => [r.name, r.status])).toEqual([
        ["001-import-env-settings", "applied"],
        ["002-backfill-tenant-id", "applied"],
        ["003-create-tenant-indexes", "applied"],
        ["004-backfill-cloud-name", "applied"],
        ["005-owner-role", "applied"],
      ]);
    });

    it("imports env values and merchants into Velor's encrypted settings", async () => {
      service.clearSettingsCache();
      const s = await service.getSettings(velor._id);

      expect(s.general).toMatchObject({ invoicePrefix: "VLR", orderHotline: "01700000000", facebookUrl: "https://facebook.com/velor", storefrontUrl: "https://velor.test" });
      expect(s.sms).toMatchObject({ enabled: true, apiKey: "velor-sms-key", senderId: "8809617" });
      expect(s.sslcommerz).toMatchObject({ enabled: true, storeId: "velorstore", storePassword: "velorpass", isLive: false });
      expect(s.email).toMatchObject({ mode: "platform", fromName: "Velor" });
      expect(s.cloudinary).toMatchObject({ enabled: true, cloudName: "velor-cloud", apiSecret: "velor-cloud-secret" });
      expect(s.groq).toMatchObject({ enabled: true, apiKey: "gsk_velor" });
      expect(s.steadfast).toMatchObject({ enabled: true, apiKey: "sf-api-key", secretKey: "sf-secret-key", webhookToken: "velor-steadfast-webhook" });
      // Pathao needs the merchant login, which legacy data does not have: imported but left disabled
      expect(s.pathao).toMatchObject({ enabled: false, clientId: "pathao-client", clientSecret: "pathao-secret", storeId: "148890", webhookSecret: "velor-pathao-webhook" });
    });

    it("stamps Velor's tenantId on every legacy document", async () => {
      for (const Model of [Product, User, Counter, Merchant]) {
        expect(await raw(Model).countDocuments({ tenantId: { $exists: false } })).toBe(0);
        expect(await raw(Model).countDocuments({ tenantId: velor._id })).toBeGreaterThan(0);
      }
    });

    it("keeps counter values so invoice numbers continue", async () => {
      const counter = await runForTenant(velor._id, () => Counter.findOne({ key: "SALES_INVOICE" }).lean());
      expect(counter.seq).toBe(41);
    });

    it("builds per-tenant indexes while leaving the old global ones for cutover", async () => {
      const names = (await raw(Product).indexes()).map((i) => i.key);
      expect(names).toEqual(expect.arrayContaining([{ tenantId: 1, slug: 1 }, { slug: 1 }]));
    });

    it("records the Cloudinary account on existing images", async () => {
      const shirt = await raw(Product).findOne({ slug: "shirt" });
      expect(shirt.thumbnail.cloudName).toBe("velor-cloud");
      expect(shirt.image[0].cloudName).toBe("velor-cloud");
      expect(shirt.image[1].cloudName).toBeUndefined();
      const pant = await raw(Product).findOne({ slug: "pant" });
      expect(pant.thumbnail.cloudName).toBeUndefined();
    });

    it("turns the legacy superadmin role into the store owner role and records the owner", async () => {
      const owner = await runForTenant(velor._id, () => Role.findOne({ slug: "owner" }).lean());
      expect(owner).toMatchObject({ name: "owner" });
      expect(await raw(Role).countDocuments({ slug: "superadmin" })).toBe(0);

      const ownerUser = await raw(User).findOne({ email: "owner@velor.test" });
      expect((await Tenant.findById(velor._id)).ownerUserId.toString()).toBe(ownerUser._id.toString());

      const slugs = (await runForTenant(velor._id, () => Role.find().lean())).map((r) => r.slug).sort();
      expect(slugs).toEqual(["admin", "manager", "owner", "salesmen"]);
    });

    it("is idempotent: a second run skips everything", async () => {
      const again = await runMigrations({ tenantSlug: "velor" });
      expect(again.every((r) => r.status === "skipped")).toBe(true);
    });
  });

  describe("cutover", () => {
    it("refuses while documents without tenantId remain", async () => {
      await raw(Product).insertOne({ name: "Stray", slug: "stray" });
      await expect(runCutover()).rejects.toThrow(/products.*without tenantId/i);
      await raw(Product).deleteOne({ slug: "stray" });
    });

    it("drops global unique indexes and keeps per-tenant ones", async () => {
      const result = await runCutover();

      expect(result.dropped).toEqual(expect.arrayContaining(["products.slug_1", "counters.key_1", "users.email_1"]));
      const productKeys = (await raw(Product).indexes()).map((i) => i.key);
      expect(productKeys).toEqual(expect.arrayContaining([{ _id: 1 }, { tenantId: 1, slug: 1 }]));
      expect(productKeys).not.toContainEqual({ slug: 1 });
    });
  });
});
