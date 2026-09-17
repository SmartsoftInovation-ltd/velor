const PathaoCourier = require("../../src/service/couriers/PathaoCourier");

const makeRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  res.setHeader = jest.fn();
  return res;
};

describe("PathaoCourier.handlePathaoWebhook", () => {
  const envBackup = { ...process.env };
  let courier;

  beforeEach(() => {
    courier = new PathaoCourier({ merchantID: "id", merchantSecret: "secret", baseURL: "https://example.test" });
    courier.processWebhook = jest.fn().mockResolvedValue();
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = { ...envBackup };
    jest.restoreAllMocks();
  });

  it("rejects with 401 when no webhook secret is configured", async () => {
    delete process.env.WEBHOOK_SECRET;
    const res = makeRes();

    await courier.handlePathaoWebhook(
      { headers: { "x-pathao-signature": "f3992ecc-59da-4cbe-a049-a13da2018d51" }, body: {} },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.setHeader).not.toHaveBeenCalled();
    expect(courier.processWebhook).not.toHaveBeenCalled();
  });

  it("rejects with 401 when the signature does not match", async () => {
    process.env.WEBHOOK_SECRET = "right-secret";
    const res = makeRes();

    await courier.handlePathaoWebhook({ headers: { "x-pathao-signature": "wrong" }, body: {} }, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(courier.processWebhook).not.toHaveBeenCalled();
  });

  it("accepts a valid signature, echoes the secret and processes the payload", async () => {
    process.env.WEBHOOK_SECRET = "right-secret";
    const res = makeRes();
    const body = { consignment_id: "C1", order_status: "Delivered" };

    await courier.handlePathaoWebhook({ headers: { "x-pathao-signature": "right-secret" }, body }, res);

    expect(res.setHeader).toHaveBeenCalledWith(
      "X-Pathao-Merchant-Webhook-Integration-Secret",
      "right-secret",
    );
    expect(res.status).toHaveBeenCalledWith(202);
    expect(courier.processWebhook).toHaveBeenCalledWith(body);
  });
});
