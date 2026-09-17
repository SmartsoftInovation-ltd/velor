const express = require("express");
const request = require("supertest");
const mongoose = require("mongoose");
const { connectTestDb, clearTestDb, disconnectTestDb } = require("../helpers/db");
const { setSettingsEnv } = require("../helpers/settings");
const { runForTenant } = require("../../src/tenancy/context");
const { globalErrorHandeler } = require("../../src/lib/GlobalErrorHandeler");
const controller = require("../../src/controller/settings.controller");
const Tenant = require("../../src/models/platform/tenant.model");
const service = require("../../src/settings/settings.service");

describe("tenant settings controller", () => {
  let app;
  let tenant;

  beforeAll(async () => {
    setSettingsEnv();
    await connectTestDb();
    service.setSettingsPublisher(async () => {});
    jest.spyOn(console, "log").mockImplementation(() => {});

    // Stand-in for authGuard: opens the tenant context the way it will in Sprint 7
    app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      const id = req.headers["x-test-tenant"];
      return id ? runForTenant(id, () => next()) : next();
    });
    app.get("/settings", controller.getSettings);
    app.patch("/settings/general", controller.updateGeneral);
    app.get("/settings/webhooks", controller.getWebhooks);
    app.use(globalErrorHandeler);
  });

  beforeEach(async () => {
    service.clearSettingsCache();
    tenant = await Tenant.create({ name: "Pizza Shop", slug: "pizzashop", status: "active" });
    await service.updateSection(tenant._id, "sms", {
      enabled: true, apiUrl: "http://bulksmsbd.net/api/smsapi", apiKey: "sms-key-123456", senderId: "8809617",
    });
  });
  afterEach(clearTestDb);
  afterAll(async () => {
    jest.restoreAllMocks();
    await disconnectTestDb();
  });

  const as = (req, id = tenant._id) => req.set("x-test-tenant", String(id));

  it("requires a tenant context", async () => {
    const res = await request(app).get("/settings").expect(400);
    expect(res.body.code).toBe("TENANT_CONTEXT_REQUIRED");
  });

  it("returns the owner view: no secret metadata, plus features", async () => {
    const res = await as(request(app).get("/settings")).expect(200);
    expect(res.body.data.settings.sms.apiKey).toEqual({ isSet: true });
    expect(res.body.data.features.sms).toBe(true);
    expect(JSON.stringify(res.body)).not.toMatch(/sms-key-123456|3456/);
  });

  it("lets the owner change only owner-editable general fields", async () => {
    await as(request(app).patch("/settings/general")).send({ orderHotline: "01711000000", facebookUrl: "https://facebook.com/pizza" }).expect(200);
    await as(request(app).patch("/settings/general")).send({ invoicePrefix: "HACK" }).expect(403);

    expect((await service.getSettings(tenant._id)).general).toMatchObject({ orderHotline: "01711000000", invoicePrefix: "INV" });
  });

  it("scopes to the context tenant", async () => {
    const other = new mongoose.Types.ObjectId();
    const res = await as(request(app).get("/settings"), other).expect(404);
    expect(res.body.message).toMatch(/tenant not found/i);
  });

  it("builds webhook URLs from the request's host when API_PUBLIC_URL is unset", async () => {
    const saved = process.env.API_PUBLIC_URL;
    delete process.env.API_PUBLIC_URL;
    try {
      const res = await as(request(app).get("/settings/webhooks")).set("Host", "api.live-store.com").expect(200);
      expect(res.body.data.pathao).toMatch(/^http:\/\/api\.live-store\.com\/api\/v1\/hooks\/pathao\//);
    } finally {
      process.env.API_PUBLIC_URL = saved;
    }
  });

  it("returns webhook URLs for the tenant", async () => {
    const res = await as(request(app).get("/settings/webhooks")).expect(200);
    expect(res.body.data.steadfast).toContain(tenant.webhookKey);
  });
});
