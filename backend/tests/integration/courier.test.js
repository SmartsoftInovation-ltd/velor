const nock = require("nock");
const { useIntegrationApp } = require("../setup/integration");
const { api } = require("../helpers/api");
const { createUserIn, tokenFor } = require("../helpers/auth");
const { tenantFactory } = require("../factories");
const { runForTenant } = require("../../src/tenancy/context");
const Order = require("../../src/models/order.model");
const settings = require("../../src/settings/settings.service");

const TENANT_PATHAO = "https://pathao.tenant.example";
const SANDBOX_PATHAO = "https://courier-api-sandbox.pathao.com";
const STEADFAST = "https://steadfast.tenant.example/api/v1";

// Courier calls go to the store's configured courier account; every upstream
// HTTP call is mocked with nock, nothing reaches the network.
describe("courier routes (/courier)", () => {
  const ctx = useIntegrationApp();
  let tenant;
  let owner;

  beforeAll(() => {
    nock.disableNetConnect();
    nock.enableNetConnect(/127\.0\.0\.1|localhost/);
  });
  afterAll(() => {
    nock.cleanAll();
    nock.enableNetConnect();
  });

  beforeEach(async () => {
    tenant = await tenantFactory.create({ slug: "couriershop" });
    owner = await createUserIn(tenant, { owner: true });
  });
  afterEach(() => nock.cleanAll());

  const as = () => api(ctx.server, { token: tokenFor(owner), tenant: "couriershop" });

  describe("Pathao city / zone / area lookups", () => {
    beforeEach(async () => {
      await settings.updateSection(tenant._id, "pathao", {
        enabled: true, baseUrl: TENANT_PATHAO, clientId: "client-1", clientSecret: "dummy-secret", username: "u@shop.test", password: "dummy-pass", storeId: "77",
      });
      settings.clearSettingsCache();
    });

    // BUG-004: CityZone ignores the store's settings and always calls Pathao's
    // sandbox with credentials written into the source
    test.failing("calls the store's own Pathao account, not the sandbox [BUG-004]", async () => {
      const tenantCall = nock(TENANT_PATHAO).post(/issue-token/).reply(200, { access_token: "t", refresh_token: "r", expires_in: 3600 })
        .get(/city-list/).reply(200, { data: { data: [{ city_id: 1, city_name: "Dhaka" }] } });
      const sandbox = nock(SANDBOX_PATHAO).post(/issue-token/).reply(200, { access_token: "t", expires_in: 3600 }).get(/city-list/).reply(200, {});
      await as().get("/courier/cities").expect(200);
      expect(sandbox.isDone()).toBe(false);
      expect(tenantCall.isDone()).toBe(true);
    });

    test.failing("an upstream 404 for an unknown city is a client error, not a 500 [BUG-004]", async () => {
      nock(SANDBOX_PATHAO).post(/issue-token/).reply(200, { access_token: "t", expires_in: 3600 }).get(/zone-list/).reply(404, { message: "not found" });
      nock(TENANT_PATHAO).post(/issue-token/).reply(200, { access_token: "t", expires_in: 3600 }).get(/zone-list/).reply(404, { message: "not found" });
      const res = await as().get("/courier/zone/999999");
      expect(res.status).toBeLessThan(500);
    });
  });

  describe("Steadfast booking", () => {
    let order;
    beforeEach(async () => {
      await settings.updateSection(tenant._id, "steadfast", { enabled: true, baseUrl: STEADFAST, apiKey: "dummy-key", secretKey: "dummy-secret" });
      settings.clearSettingsCache();
      order = await runForTenant(tenant._id, () =>
        Order.create({ items: [], totalAmount: 900, finalAmount: 960, paymentMethod: "cod", invoiceId: "INV-SF1", shippingInfo: { fullName: "Rahim", phone: "01712345678", address: "Dhaka" } }),
      );
    });

    it("sends the order to the store's Steadfast account with its credentials and COD amount", async () => {
      let sent;
      const scope = nock(STEADFAST, { reqheaders: { "Api-Key": "dummy-key", "Secret-Key": "dummy-secret" } })
        .post("/create_order", (body) => (sent = body))
        .reply(200, { status: 200, consignment: { tracking_code: "SF123", status: "in_review" } });
      await as().post("/courier/steadfast-create-order").send({ orderId: order._id.toString() });
      expect(scope.isDone()).toBe(true);
      expect(sent).toMatchObject({ invoice: "INV-SF1", recipient_phone: "01712345678", cod_amount: 960 });
    });

    // BUG-073: after Steadfast accepts the consignment the order is saved with
    // orderStatus "COURIER_<status>", outside the schema enum: the save fails,
    // the API answers 500 and the tracking code is lost (a retry books twice)
    test.failing("records the tracking code after a successful booking [BUG-073]", async () => {
      nock(STEADFAST).post("/create_order").reply(200, { status: 200, consignment: { tracking_code: "SF123", status: "in_review" } });
      const res = await as().post("/courier/steadfast-create-order").send({ orderId: order._id.toString() });
      expect(res.status).toBe(201);
      const stored = await runForTenant(tenant._id, () => Order.findById(order._id).lean());
      expect(stored.courier.trackingId).toBe("SF123");
    });

    it("422 COURIER_NOT_CONFIGURED when the store has no Steadfast account", async () => {
      await settings.updateSection(tenant._id, "steadfast", { enabled: false });
      settings.clearSettingsCache();
      const res = await as().post("/courier/steadfast-create-order").send({ orderId: order._id.toString() }).expect(422);
      expect(res.body.code).toBe("COURIER_NOT_CONFIGURED");
    });
  });
});
