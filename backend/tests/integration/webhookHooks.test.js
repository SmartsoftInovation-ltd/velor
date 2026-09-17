jest.mock("../../src/integrations/sslcommerz", () => ({ validatePayment: jest.fn(), createPaymentSession: jest.fn() }));

const express = require("express");
const request = require("supertest");
const { connectTestDb, clearTestDb, disconnectTestDb } = require("../helpers/db");
const { setSettingsEnv } = require("../helpers/settings");
const { runForTenant, runAsPlatform } = require("../../src/tenancy/context");
const { globalErrorHandeler } = require("../../src/lib/GlobalErrorHandeler");
const { validatePayment } = require("../../src/integrations/sslcommerz");
const Tenant = require("../../src/models/platform/tenant.model");
const Order = require("../../src/models/order.model");
const service = require("../../src/settings/settings.service");

describe("per-tenant webhook routes", () => {
  let app;
  let pizza;
  let burger;

  beforeAll(async () => {
    setSettingsEnv();
    await connectTestDb();
    service.setSettingsPublisher(async () => {});
    app = express();
    app.use(express.json());
    app.use("/api/v1/hooks", require("../../src/routes/api/hooks.api"));
    app.use(globalErrorHandeler);
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  beforeEach(async () => {
    service.clearSettingsCache();
    pizza = await Tenant.create({ name: "Pizza", slug: "pizzashop", status: "active" });
    burger = await Tenant.create({ name: "Burger", slug: "burgerhub", status: "active" });
    const order = { invoiceId: "INV-1", totalAmount: 100, finalAmount: 100, paymentMethod: "sslcommerz", courier: { trackingId: "C1" } };
    await runForTenant(pizza._id, () => Order.create(order));
    await runForTenant(burger._id, () => Order.create(order));
    await service.updateSection(pizza._id, "pathao", {
      enabled: true, baseUrl: "https://api-hermes.pathao.com", clientId: "c", clientSecret: "s", username: "u", password: "p", storeId: "1", webhookSecret: "pizza-pathao-secret",
    });
    await service.updateSection(pizza._id, "steadfast", { enabled: true, baseUrl: "https://portal.packzy.com/api/v1", apiKey: "k", secretKey: "s", webhookToken: "pizza-steadfast-token" });
    await service.updateSection(burger._id, "pathao", {
      enabled: true, baseUrl: "https://api-hermes.pathao.com", clientId: "c", clientSecret: "s", username: "u", password: "p", storeId: "1", webhookSecret: "burger-pathao-secret",
    });
  });
  afterEach(clearTestDb);
  afterAll(async () => {
    jest.restoreAllMocks();
    await disconnectTestDb();
  });

  const orderOf = (tenant) => runForTenant(tenant._id, () => Order.findOne({ invoiceId: "INV-1" }).lean());

  it("returns 404 for an unknown webhook key", async () => {
    await request(app).post("/api/v1/hooks/pathao/not-a-key").send({}).expect(404);
  });

  it("SSLCommerz IPN updates only the order of the tenant that owns the key", async () => {
    validatePayment.mockImplementation(async () => {
      const { getTenantId } = require("../../src/tenancy/context");
      expect(getTenantId().toString()).toBe(pizza._id.toString());
      return { status: "VALID", tran_id: "INV-1", val_id: "V1" };
    });

    await request(app).post(`/api/v1/hooks/sslcommerz/${pizza.webhookKey}/ipn`).send({ val_id: "V1" }).expect(200);

    expect((await orderOf(pizza)).paymentStatus).toBe("success");
    expect((await orderOf(burger)).paymentStatus).not.toBe("success");
  });

  it("Pathao webhook requires that tenant's secret and updates only its order", async () => {
    const body = { consignment_id: "C1", order_status: "Delivered" };

    await request(app).post(`/api/v1/hooks/pathao/${pizza.webhookKey}`).set("x-pathao-signature", "burger-pathao-secret").send(body).expect(401);

    const res = await request(app).post(`/api/v1/hooks/pathao/${pizza.webhookKey}`).set("x-pathao-signature", "pizza-pathao-secret").send(body).expect(202);
    expect(res.headers["x-pathao-merchant-webhook-integration-secret"]).toBe("pizza-pathao-secret");

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect((await orderOf(pizza)).courier.status).toBe("Delivered");
    expect((await orderOf(burger)).courier.status).not.toBe("Delivered");
  });

  it("Steadfast webhook requires that tenant's token and updates only its order", async () => {
    const body = { invoice: "INV-1", status: "delivered", tracking_code: "SF1" };

    await request(app).post(`/api/v1/hooks/steadfast/${pizza.webhookKey}`).set("Authorization", "Bearer wrong").send(body).expect(401);
    await request(app).post(`/api/v1/hooks/steadfast/${pizza.webhookKey}`).set("Authorization", "Bearer pizza-steadfast-token").send(body).expect(200);

    expect((await orderOf(pizza)).courier.trackingId).toBe("SF1");
    expect((await orderOf(burger)).courier.trackingId).toBe("C1");
  });

  it("rejects webhooks for a tenant that has not configured the courier", async () => {
    await request(app).post(`/api/v1/hooks/steadfast/${burger.webhookKey}`).set("Authorization", "Bearer anything").send({ invoice: "INV-1" }).expect(401);
  });
});
