const { SECTIONS, INVALIDATION_CHANNEL } = require("../settings/settings.service");
const { isLegacyEncrypted, readSecret } = require("../settings/secret");

// Secret settings used to be stored encrypted; they are now plain text. This
// rewrites the tenant's encrypted secrets in the plain shape, so the deployment
// no longer needs SETTINGS_ENCRYPTION_KEYS. Run it with the old keys still set:
// a value whose key is missing is left as it is and reported, to re-enter by hand.
module.exports = {
  name: "010-decrypt-settings-secrets",
  async up({ tenant }) {
    const TenantSettings = require("../models/platform/tenantSettings.model");
    const doc = await TenantSettings.findOne({ tenantId: tenant._id }).lean();
    if (!doc) return { converted: [], unreadable: [] };

    const converted = [];
    const unreadable = [];
    const $set = {};

    for (const [sectionKey, definition] of Object.entries(SECTIONS)) {
      for (const [name, field] of Object.entries(definition.fields)) {
        const stored = doc.data?.[sectionKey]?.[name];
        if (field.type !== "secret" || !isLegacyEncrypted(stored)) continue;

        const result = readSecret(stored);
        if (!result.ok) {
          unreadable.push(`${sectionKey}.${name}`);
          continue;
        }
        $set[`data.${sectionKey}.${name}`] = {
          value: result.value,
          last4: stored.last4 || "",
          updatedAt: stored.updatedAt || new Date(),
        };
        converted.push(`${sectionKey}.${name}`);
      }
    }

    if (converted.length) {
      const saved = await TenantSettings.findOneAndUpdate(
        { tenantId: tenant._id },
        { $set, $inc: { version: 1 } },
        { new: true, lean: true },
      );
      // Running API and worker processes cache the raw document: drop it there
      const { cache: redis } = require("../config/redis.config");
      await redis
        .publish(INVALIDATION_CHANNEL, JSON.stringify({ tenantId: String(tenant._id), version: saved.version }))
        .catch((error) => console.error("[010] invalidation publish failed:", error.message));
    }

    return { converted, unreadable };
  },
};
