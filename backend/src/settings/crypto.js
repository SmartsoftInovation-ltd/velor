const crypto = require("crypto");

// Legacy only: secret fields used to be stored AES-256-GCM encrypted
// ({ ciphertext, iv, authTag, keyVersion, last4 }). New writes are plain text
// (settings/secret.js). This stays so values saved before the switch can still
// be read, and converted by migration 010-decrypt-settings-secrets.
// SETTINGS_ENCRYPTION_KEYS="v1:<base64 32 bytes>,v2:<base64 32 bytes>"

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

module.exports = { decryptSecret };
