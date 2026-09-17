const Merchant = require("../../models/marchant.model");
const { customError } = require("../../lib/CustomError");

// Legacy: tokens persisted on the Merchant document (single-tenant installs)
class MerchantTokenStore {
  constructor(clientId) {
    this.clientId = clientId;
  }

  async get() {
    const merchant = await Merchant.findOne({ merchantID: this.clientId });
    if (!merchant) throw new customError("Merchant not found", 404);
    return {
      access_token: merchant.access_token,
      refresh_token: merchant.refresh_token,
      token_expiry: merchant.token_expiry ? new Date(merchant.token_expiry).getTime() : 0,
    };
  }

  async set(tokens) {
    const merchant = await Merchant.findOneAndUpdate({ merchantID: this.clientId }, tokens, { new: true });
    if (!merchant) throw new customError("Merchant not found", 404);
  }
}

// Tenants with courier credentials in settings: runtime tokens live in Redis
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;

class RedisTokenStore {
  constructor(tenantId) {
    this.key = `t:${tenantId}:courier:pathao:token`;
  }

  redis() {
    return require("../../config/redis.config").cache;
  }

  async get() {
    const raw = await this.redis().get(this.key);
    return raw ? JSON.parse(raw) : null;
  }

  async set(tokens) {
    await this.redis().set(this.key, JSON.stringify(tokens), "EX", TOKEN_TTL_SECONDS);
  }
}

module.exports = { MerchantTokenStore, RedisTokenStore };
