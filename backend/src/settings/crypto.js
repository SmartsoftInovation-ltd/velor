const crypto = require("crypto");

// AES-256-GCM for per-tenant secrets (API keys, passwords).
// SETTINGS_ENCRYPTION_KEYS="v1:<base64 32 bytes>,v2:<base64 32 bytes>"
// SETTINGS_ACTIVE_KEY_VERSION="v2"  -> new writes use v2, old values still decrypt.

const ALGORITHM = "aes-256-gcm";

const loadKeyRing = () => {
  const raw = process.env.SETTINGS_ENCRYPTION_KEYS;
  if (!raw) throw new Error("SETTINGS_ENCRYPTION_KEYS is not configured");

  const ring = new Map();
  for (const entry of raw.split(",").map((e) => e.trim()).filter(Boolean)) {
    const separator = entry.indexOf(":");
    const version = entry.slice(0, separator);
    const key = Buffer.from(entry.slice(separator + 1), "base64");
    if (separator < 1 || key.length !== 32) {
      throw new Error(`Settings encryption key "${version || entry}" must be 32 bytes (base64)`);
    }
    ring.set(version, key);
  }
  return ring;
};

const activeKey = () => {
  const ring = loadKeyRing();
  const version = process.env.SETTINGS_ACTIVE_KEY_VERSION;
  if (!ring.has(version)) {
    throw new Error(`Active key version "${version}" is not in SETTINGS_ENCRYPTION_KEYS`);
  }
  return { version, key: ring.get(version) };
};

const encryptSecret = (plaintext) => {
  const { version, key } = activeKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), "utf8"), cipher.final()]);

  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    keyVersion: version,
    last4: String(plaintext).length >= 8 ? String(plaintext).slice(-4) : "",
    updatedAt: new Date(),
  };
};

const decryptSecret = (stored) => {
  const key = loadKeyRing().get(stored.keyVersion);
  if (!key) throw new Error(`Settings encryption key "${stored.keyVersion}" is not configured`);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(stored.iv, "base64"));
  decipher.setAuthTag(Buffer.from(stored.authTag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(stored.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
};

const isEncryptedWithActiveKey = (stored) => stored?.keyVersion === process.env.SETTINGS_ACTIVE_KEY_VERSION;

// The only view of a secret that may leave the server
const maskSecret = (stored) =>
  stored?.ciphertext
    ? { isSet: true, last4: stored.last4 || "", updatedAt: stored.updatedAt || null }
    : { isSet: false, last4: "", updatedAt: null };

module.exports = { encryptSecret, decryptSecret, isEncryptedWithActiveKey, maskSecret };
