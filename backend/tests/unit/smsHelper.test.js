jest.mock("axios", () => ({ post: jest.fn(), get: jest.fn() }));
jest.mock("../../src/integrations/config", () => ({ getSmsConfig: jest.fn() }));

const axios = require("axios");
const { getSmsConfig } = require("../../src/integrations/config");
const { sendSMS, getSmsBalance } = require("../../src/helpers/sms");

describe("helpers/sms", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
    getSmsConfig.mockResolvedValue({ apiUrl: "http://sms.pizza", apiKey: "pizza-key", senderId: "8801", balanceUrl: "http://sms.pizza/balance" });
    axios.post.mockResolvedValue({ data: { response_code: 202 } });
    axios.get.mockResolvedValue({ data: { balance: 50 } });
  });
  afterEach(() => jest.restoreAllMocks());

  it("sends with the resolved provider config", async () => {
    await sendSMS(["01711000000", "01811000000"], "hello");
    expect(axios.post).toHaveBeenCalledWith("http://sms.pizza", {
      api_key: "pizza-key",
      senderid: "8801",
      number: "01711000000,01811000000",
      message: "hello",
    });
  });

  it("refuses to send without numbers or credentials instead of using test defaults", async () => {
    await expect(sendSMS("", "hello")).rejects.toThrow(/phone number/i);
    getSmsConfig.mockResolvedValue({ apiUrl: "", apiKey: "", senderId: "" });
    await expect(sendSMS("01711000000", "hello")).rejects.toThrow(/not configured/i);
    expect(axios.post).not.toHaveBeenCalled();
  });

  it("propagates FEATURE_NOT_CONFIGURED errors from the resolver", async () => {
    getSmsConfig.mockRejectedValue(Object.assign(new Error("SMS is not configured for this store"), { code: "SMS_NOT_CONFIGURED", statusCode: 422 }));
    await expect(sendSMS("01711000000", "hello")).rejects.toMatchObject({ code: "SMS_NOT_CONFIGURED" });
  });

  it("reads the balance with the resolved key", async () => {
    await expect(getSmsBalance()).resolves.toEqual({ balance: 50 });
    expect(axios.get).toHaveBeenCalledWith("http://sms.pizza/balance", { params: { api_key: "pizza-key" } });
  });
});
