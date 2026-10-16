const { decryptSecret } = require("./crypto");

// Secret fields (API keys, passwords) are stored in plain text:
//   { value, last4, updatedAt }
// The database holds the real value; the API still never returns it — clients
// only ever see maskSecret(). Values saved before this, in the old encrypted
// shape ({ ciphertext, iv, authTag, keyVersion }), are still readable while
// SETTINGS_ENCRYPTION_KEYS is set, until migration 010 converts them.

const storeSecret = (plaintext) => ({
  value: String(plaintext),
  last4: String(plaintext).length >= 8 ? String(plaintext).slice(-4) : "",
  updatedAt: new Date(),
});

const isLegacyEncrypted = (stored) => Boolean(stored?.ciphertext);

const hasSecret = (stored) => typeof stored?.value === "string" || isLegacyEncrypted(stored);

/**
 * Reads a stored secret, reporting a failure instead of throwing. Only a legacy
 * encrypted value can fail (its key is not configured), and that must not take
 * down every request that merely reads settings — callers that need the
 * plaintext check `ok` and fail on their own terms.
 */
const readSecret = (stored) => {
  if (typeof stored?.value === "string") return { ok: true, value: stored.value };
  if (!isLegacyEncrypted(stored)) return { ok: true, value: null };
  try {
    return { ok: true, value: decryptSecret(stored) };
  } catch (error) {
    return { ok: false, value: null, error };
  }
};

// The only view of a secret that may leave the server
const maskSecret = (stored) =>
  hasSecret(stored)
    ? { isSet: true, last4: stored.last4 || "", updatedAt: stored.updatedAt || null }
    : { isSet: false, last4: "", updatedAt: null };

module.exports = { storeSecret, readSecret, hasSecret, isLegacyEncrypted, maskSecret };
