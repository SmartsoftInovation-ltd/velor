const joi = require("joi");
const IORedis = require("ioredis");
const TenantSettings = require("../models/platform/tenantSettings.model");
const { SECTIONS } = require("./definitions");
const { encryptSecret, tryDecryptSecret, maskSecret } = require("./crypto");
const { customError } = require("../lib/CustomError");
const { statusCodes } = require("../constant/constant");

const INVALIDATION_CHANNEL = "tenant-settings:invalidate";
const CACHE_TTL_MS = Number(process.env.SETTINGS_CACHE_TTL_MS) || 60_000;
const CACHE_MAX_ENTRIES = 1000;

// ---------- cache (raw documents; secrets stay encrypted in memory until read) ----------

const cache = new Map();

const clearSettingsCache = () => cache.clear();

const invalidateSettingsCache = (tenantId) => cache.delete(String(tenantId));

const loadRaw = async (tenantId) => {
  const key = String(tenantId);
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.doc;

  const doc = await TenantSettings.findOne({ tenantId }).lean();
  if (cache.size >= CACHE_MAX_ENTRIES) cache.delete(cache.keys().next().value);
  cache.set(key, { doc, expiresAt: Date.now() + CACHE_TTL_MS });
  return doc;
};

// ---------- cross-process invalidation ----------

let publisher = async (message) => {
  try {
    const { cache: redis } = require("../config/redis.config");
    await redis.publish(INVALIDATION_CHANNEL, message);
  } catch (error) {
    console.error("[settings] invalidation publish failed:", error.message);
  }
};

const setSettingsPublisher = (fn) => {
  publisher = fn;
};

let subscriber = null;

// Every process that reads settings (API and each worker) calls this once at startup
const startSettingsInvalidationListener = async (redisUrl = process.env.REDIS_URL) => {
  if (subscriber) return subscriber;
  subscriber = new IORedis(redisUrl);
  subscriber.on("message", (channel, message) => {
    if (channel !== INVALIDATION_CHANNEL) return;
    try {
      invalidateSettingsCache(JSON.parse(message).tenantId);
    } catch {
      // ignore malformed messages
    }
  });
  await subscriber.subscribe(INVALIDATION_CHANNEL);
  return subscriber;
};

const stopSettingsInvalidationListener = async () => {
  if (!subscriber) return;
  await subscriber.quit();
  subscriber = null;
};

// ---------- section helpers ----------

const sectionOr404 = (key) => {
  const definition = SECTIONS[key];
  if (!definition) throw new customError(`Unknown settings section "${key}"`, statusCodes.NOT_FOUND);
  return definition;
};

const isEmpty = (value) => value === undefined || value === null || value === "";

// Effective section with defaults; secrets decrypted (or null when unset).
// A secret the key ring can no longer read resolves to null and is logged: the
// section then reads as unconfigured, which is the truth — the value cannot be
// used — instead of failing every request that touches settings.
const resolveSection = (definition, stored = {}) =>
  Object.fromEntries(
    Object.entries(definition.fields).map(([name, field]) => {
      if (field.type !== "secret") {
        return [name, isEmpty(stored[name]) && stored[name] !== "" ? field.default : stored[name]];
      }
      if (!stored[name]?.ciphertext) return [name, null];

      const result = tryDecryptSecret(stored[name]);
      if (!result.ok) {
        console.error(
          `[settings] "${definition.path}.${name}" cannot be decrypted with key "${stored[name].keyVersion}" ` +
            `(${result.error.message}). Re-enter it to store it under the active key.`,
        );
      }
      return [name, result.value];
    }),
  );

const maskSection = (definition, stored = {}, { ownerView = false } = {}) =>
  Object.fromEntries(
    Object.entries(definition.fields).map(([name, field]) => {
      if (field.type !== "secret") return [name, isEmpty(stored[name]) && stored[name] !== "" ? field.default : stored[name]];
      const masked = maskSecret(stored[name]);
      return [name, ownerView ? { isSet: masked.isSet } : masked];
    }),
  );

const missingRequired = (definition, effective) =>
  Object.entries(definition.fields)
    .filter(([name, field]) => field.required && isEmpty(effective[name]))
    .map(([name]) => name);

const isSectionConfigured = (definition, effective) => {
  if (definition.isConfigured && !definition.isConfigured(effective)) return false;
  if (!definition.isActive(effective)) return Boolean(definition.isConfigured);
  return missingRequired(definition, effective).length === 0;
};

const fieldSchema = (field) => {
  let schema;
  switch (field.type) {
    case "boolean":
      return joi.boolean();
    case "enum":
      return joi.string().valid(...field.values);
    case "number":
    case "integer":
      schema = joi.number();
      if (field.type === "integer") schema = schema.integer();
      if (field.min !== undefined) schema = schema.min(field.min);
      if (field.max !== undefined) schema = schema.max(field.max);
      return schema.allow(null);
    case "uri":
      return joi.string().trim().uri().allow("", null);
    case "email":
      return joi.string().trim().email({ tlds: { allow: false } }).allow("", null);
    case "secret":
      schema = joi.string().min(1);
      if (field.pattern) schema = schema.pattern(field.pattern);
      return schema.allow(null);
    default:
      schema = joi.string().trim();
      if (field.uppercase) schema = schema.uppercase();
      if (field.pattern) schema = schema.pattern(field.pattern);
      return field.default === "" ? schema.allow("", null) : schema.allow(null);
  }
};

const patchSchema = (definition) =>
  joi.object(Object.fromEntries(Object.entries(definition.fields).map(([name, field]) => [name, fieldSchema(field)])));

// ---------- public API ----------

const getSettings = async (tenantId) => {
  const doc = await loadRaw(tenantId);
  return Object.fromEntries(
    Object.entries(SECTIONS).map(([key, definition]) => [key, resolveSection(definition, doc?.data?.[key])]),
  );
};

const getMaskedSettings = async (tenantId, options = {}) => {
  const doc = await loadRaw(tenantId);
  return Object.fromEntries(
    Object.entries(SECTIONS).map(([key, definition]) => [key, maskSection(definition, doc?.data?.[key], options)]),
  );
};

const getSettingsVersion = async (tenantId) => (await loadRaw(tenantId))?.version || 0;

const getFeatures = async (tenantId) => {
  const settings = await getSettings(tenantId);
  const configured = (key) => isSectionConfigured(SECTIONS[key], settings[key]);
  return {
    sms: configured("sms"),
    email: configured("email"),
    sslcommerz: configured("sslcommerz"),
    couriers: { pathao: configured("pathao"), steadfast: configured("steadfast") },
    cloudinary: configured("cloudinary"),
    ai: configured("groq"),
  };
};

/**
 * Applies a partial update to one section.
 * Omitted fields keep their value; null resets a field (clears a secret).
 */
const updateSection = async (tenantId, sectionKey, patch, { allowedFields, updatedBy = null } = {}) => {
  const definition = sectionOr404(sectionKey);

  if (allowedFields) {
    const forbidden = Object.keys(patch || {}).filter((name) => !allowedFields.includes(name));
    if (forbidden.length) {
      throw new customError(`Not allowed to change: ${forbidden.join(", ")}`, statusCodes.FORBIDDEN);
    }
  }

  let values;
  try {
    values = await patchSchema(definition).validateAsync(patch || {}, { abortEarly: false, allowUnknown: false });
  } catch (error) {
    throw new customError(error.details.map((d) => d.message).join(", "), statusCodes.BAD_REQUEST);
  }

  const doc = await TenantSettings.findOne({ tenantId }).lean();
  const stored = doc?.data?.[sectionKey] || {};
  const next = { ...stored };
  const changes = [];

  for (const [name, value] of Object.entries(values)) {
    const field = definition.fields[name];
    if (field.type === "secret") {
      // An unreadable stored value counts as "different": re-entering the secret
      // is how an operator replaces one encrypted under a key they no longer have.
      const current = stored[name]?.ciphertext ? tryDecryptSecret(stored[name]).value : null;
      if (current !== null && value === current) continue;
      if (value === null) delete next[name];
      else next[name] = encryptSecret(value);
      changes.push(`${sectionKey}.${name}`);
      continue;
    }

    const before = isEmpty(stored[name]) && stored[name] !== "" ? field.default : stored[name];
    const after = value === null ? field.default : value;
    if (before === after) continue;
    if (value === null) delete next[name];
    else next[name] = value;
    changes.push(`${sectionKey}.${name}`);
  }

  const effective = resolveSection(definition, next);
  if (definition.isActive(effective)) {
    const missing = missingRequired(definition, effective);
    if (missing.length) {
      throw new customError(`Cannot enable ${sectionKey}: missing ${missing.join(", ")}`, statusCodes.BAD_REQUEST);
    }
  }

  if (!changes.length) {
    return { section: maskSection(definition, stored), version: doc?.version || 0, changes };
  }

  const saved = await TenantSettings.findOneAndUpdate(
    { tenantId },
    { $set: { [`data.${sectionKey}`]: next, updatedBy }, $inc: { version: 1 } },
    { upsert: true, new: true, lean: true },
  );

  invalidateSettingsCache(tenantId);
  await publisher(JSON.stringify({ tenantId: String(tenantId), version: saved.version }));

  return { section: maskSection(definition, next), version: saved.version, changes };
};

const featureNotConfigured = (code, label) =>
  new customError(`${label} is not configured for this store`, statusCodes.UNPROCESSABLE, code);

// Public API origin: API_PUBLIC_URL when set (required for payment callbacks),
// otherwise the origin the current request came in on.
const getWebhookUrls = (tenant, requestOrigin = "") => {
  const origin = (process.env.API_PUBLIC_URL || requestOrigin).replace(/\/+$/, "");
  const base = `${origin}${process.env.BASE_URL || "/api/v1"}/hooks`;
  const key = tenant.webhookKey;
  return {
    sslcommerz: Object.fromEntries(
      ["success", "fail", "cancel", "ipn"].map((result) => [result, `${base}/sslcommerz/${key}/${result}`]),
    ),
    pathao: `${base}/pathao/${key}`,
    steadfast: `${base}/steadfast/${key}`,
  };
};

module.exports = {
  INVALIDATION_CHANNEL,
  SECTIONS,
  getSettings,
  getMaskedSettings,
  getFeatures,
  getSettingsVersion,
  updateSection,
  getWebhookUrls,
  featureNotConfigured,
  clearSettingsCache,
  invalidateSettingsCache,
  setSettingsPublisher,
  startSettingsInvalidationListener,
  stopSettingsInvalidationListener,
};
