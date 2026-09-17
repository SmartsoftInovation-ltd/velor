jest.mock("axios", () => ({ post: jest.fn() }));
jest.mock("../../src/models/marchant.model", () => ({ findOne: jest.fn(), findOneAndUpdate: jest.fn() }));

const axios = require("axios");
const mongoose = require("mongoose");
const PathaoAuth = require("../../src/service/couriers/PathaoAuth");
const { RedisTokenStore, MerchantTokenStore } = require("../../src/service/couriers/pathaoTokenStore");

const memoryStore = () => {
  let value = null;
  return { get: jest.fn(async () => value), set: jest.fn(async (v) => { value = v; }) };
};

describe("PathaoAuth", () => {
  const settingsMerchant = {
    tenantId: new mongoose.Types.ObjectId(),
    merchantID: "cid",
    merchantSecret: "csec",
    baseURL: "https://api-hermes.pathao.com",
    username: "owner@pizza.test",
    password: "pathao-pass",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
    axios.post.mockResolvedValue({ data: { access_token: "AT1", refresh_token: "RT1", expires_in: 3600 } });
  });
  afterEach(() => jest.restoreAllMocks());

  it("uses a per-tenant Redis token store for settings-based merchants and the Merchant store otherwise", () => {
    expect(new PathaoAuth(settingsMerchant).tokenStore).toBeInstanceOf(RedisTokenStore);
    expect(new PathaoAuth({ merchantID: "legacy" }).tokenStore).toBeInstanceOf(MerchantTokenStore);
    expect(new PathaoAuth(settingsMerchant).tokenStore.key).toBe(`t:${settingsMerchant.tenantId}:courier:pathao:token`);
  });

  it("issues a token with the tenant's own username and password and stores it", async () => {
    const store = memoryStore();
    const auth = new PathaoAuth(settingsMerchant, store);

    await expect(auth.getValidToken()).resolves.toBe("AT1");

    expect(axios.post).toHaveBeenCalledWith(
      "https://api-hermes.pathao.com/aladdin/api/v1/issue-token",
      { client_id: "cid", client_secret: "csec", grant_type: "password", username: "owner@pizza.test", password: "pathao-pass" },
      expect.anything(),
    );
    expect(store.set).toHaveBeenCalledWith(expect.objectContaining({ access_token: "AT1", refresh_token: "RT1" }));
  });

  it("reuses a valid token and refreshes an expired one", async () => {
    const store = memoryStore();
    const auth = new PathaoAuth(settingsMerchant, store);
    await store.set({ access_token: "CACHED", refresh_token: "RT0", token_expiry: Date.now() + 60_000 });

    await expect(auth.getValidToken()).resolves.toBe("CACHED");
    expect(axios.post).not.toHaveBeenCalled();

    await store.set({ access_token: "OLD", refresh_token: "RT0", token_expiry: Date.now() - 1 });
    await expect(auth.getValidToken()).resolves.toBe("AT1");
    expect(axios.post).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ grant_type: "refresh_token", refresh_token: "RT0" }),
      expect.anything(),
    );
  });
});
