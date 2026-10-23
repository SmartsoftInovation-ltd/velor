jest.mock("sslcommerz-lts", () => jest.fn());
jest.mock("../../src/integrations/config", () => ({ getSslCommerzConfig: jest.fn() }));

const SSLCommerzPayment = require("sslcommerz-lts");
const { getSslCommerzConfig } = require("../../src/integrations/config");
const { createPaymentSession, validatePayment } = require("../../src/integrations/sslcommerz");

describe("integrations/sslcommerz", () => {
  const init = jest.fn();
  const validate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    SSLCommerzPayment.mockImplementation(() => ({ init, validate }));
    getSslCommerzConfig.mockResolvedValue({
      storeId: "pizzastore",
      storePassword: "pizzapass",
      isLive: false,
      callbackUrls: { success: "https://api/s", fail: "https://api/f", cancel: "https://api/c", ipn: "https://api/i" },
    });
    init.mockResolvedValue({ GatewayPageURL: "https://gateway/pay", sessionkey: "SESSION1" });
    validate.mockResolvedValue({ status: "VALID" });
  });

  it("opens a session with the tenant store and tenant callback URLs", async () => {
    const session = await createPaymentSession({ total_amount: 100, tran_id: "PZS-1", cus_email: "" });

    // The session key is kept so the outcome can be asked of the gateway later
    expect(session).toEqual({ gatewayUrl: "https://gateway/pay", sessionKey: "SESSION1" });
    expect(SSLCommerzPayment).toHaveBeenCalledWith("pizzastore", "pizzapass", false);
    expect(init).toHaveBeenCalledWith(
      expect.objectContaining({
        // decimal(10,2), as the gateway documents it
        total_amount: "100.00",
        tran_id: "PZS-1",
        currency: "BDT",
        success_url: "https://api/s",
        fail_url: "https://api/f",
        cancel_url: "https://api/c",
        ipn_url: "https://api/i",
        cus_email: "customer@example.com",
      }),
    );
  });

  it("validates a payment with the tenant store", async () => {
    await expect(validatePayment("VAL1")).resolves.toEqual({ status: "VALID" });
    expect(SSLCommerzPayment).toHaveBeenCalledWith("pizzastore", "pizzapass", false);
    expect(validate).toHaveBeenCalledWith({ val_id: "VAL1" });
  });

  it("fails when the gateway returns no payment page", async () => {
    init.mockResolvedValue({ status: "FAILED", failedreason: "bad store" });
    await expect(createPaymentSession({ total_amount: 1, tran_id: "x" })).rejects.toThrow(/bad store/);
  });
});
