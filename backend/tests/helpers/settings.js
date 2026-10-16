const crypto = require("crypto");

const KEY_V1 = crypto.randomBytes(32).toString("base64");
const KEY_V2 = crypto.randomBytes(32).toString("base64");

const setSettingsEnv = (overrides = {}) =>
  Object.assign(process.env, {
    SETTINGS_ENCRYPTION_KEYS: `v1:${KEY_V1}`,
    API_PUBLIC_URL: "https://api.example.test",
    ...overrides,
  });

// Builds a secret in the shape stored before secrets became plain text
const legacyEncrypt = (plaintext, keyBase64 = KEY_V1, keyVersion = "v1") => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", Buffer.from(keyBase64, "base64"), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    keyVersion,
    last4: plaintext.length >= 8 ? plaintext.slice(-4) : "",
    updatedAt: new Date("2026-01-01"),
  };
};

module.exports = { KEY_V1, KEY_V2, setSettingsEnv, legacyEncrypt };
