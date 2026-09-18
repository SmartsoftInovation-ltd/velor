const axios = require("axios");
const { customError } = require("../../lib/CustomError");
const { MerchantTokenStore, RedisTokenStore } = require("./pathaoTokenStore");
const { isProduction } = require("../../config/nodeEnv");

class PathaoAuth {
  /**
   * @param {object} merchant - Merchant document (legacy) or courier config from tenant settings
   * @param {object} [tokenStore] - { get, set } for access/refresh tokens
   */
  constructor(merchant, tokenStore) {
    this.baseURL = merchant.baseURL || "https://courier-api-sandbox.pathao.com";
    this.client_id = merchant.merchantID;
    this.client_secret = merchant.merchantSecret;
    this.username = merchant.username;
    this.password = merchant.password;
    this.tokenStore =
      tokenStore ||
      (merchant.tenantId ? new RedisTokenStore(merchant.tenantId) : new MerchantTokenStore(merchant.merchantID));
  }

  issuePayload() {
    // Tenant settings carry the merchant's own Pathao login
    if (this.username && this.password) {
      return {
        client_id: this.client_id,
        client_secret: this.client_secret,
        grant_type: "password",
        username: this.username,
        password: this.password,
      };
    }

    return isProduction()
      ? { base_url: this.baseURL, client_id: this.client_id, client_secret: this.client_secret }
      : {
          base_url: this.baseURL,
          client_id: this.client_id,
          client_secret: this.client_secret,
          username: "test@pathao.com",
          grant_type: "password",
          password: "lovePathao",
        };
  }

  async saveTokens({ access_token, refresh_token, expires_in }) {
    await this.tokenStore.set({
      access_token,
      refresh_token,
      token_expiry: Date.now() + expires_in * 1000,
    });
    return access_token;
  }

  /** STEP 1: New token issue */
  async issueToken() {
    try {
      const response = await axios.post(`${this.baseURL}/aladdin/api/v1/issue-token`, this.issuePayload(), {
        headers: { "Content-Type": "application/json" },
      });
      return await this.saveTokens(response.data);
    } catch (err) {
      console.error("❌ Issue token error:", err.response?.data || err.message);
      throw new customError(
        "Failed to issue Pathao token: " + (err.response?.data?.message || err.message),
        500,
      );
    }
  }

  /** STEP 2: Refresh token */
  async refreshToken(stored) {
    try {
      if (!stored?.refresh_token) throw new customError("No refresh token stored", 400);

      const response = await axios.post(
        `${this.baseURL}/aladdin/api/v1/issue-token`,
        {
          client_id: this.client_id,
          client_secret: this.client_secret,
          grant_type: "refresh_token",
          refresh_token: stored.refresh_token,
        },
        { headers: { "Content-Type": "application/json" } },
      );

      console.log("✅ Pathao token refreshed");
      return await this.saveTokens(response.data);
    } catch (err) {
      console.error("❌ Refresh token error:", err.response?.data || err.message);
      throw new customError(
        "Failed to refresh Pathao token: " + (err.response?.data?.message || err.message),
        500,
      );
    }
  }

  /** STEP 3: Get valid token */
  async getValidToken() {
    const stored = await this.tokenStore.get();

    // CASE 1: First time → issue new token
    if (!stored?.access_token || !stored?.refresh_token) {
      return this.issueToken();
    }

    // CASE 2: Token expired → refresh
    if (Date.now() > stored.token_expiry) {
      return this.refreshToken(stored);
    }

    // CASE 3: Token still valid
    return stored.access_token;
  }
}

module.exports = PathaoAuth;
