const crypto = require("crypto");

const KEY_V1 = crypto.randomBytes(32).toString("base64");
const KEY_V2 = crypto.randomBytes(32).toString("base64");

const setSettingsEnv = (overrides = {}) =>
  Object.assign(process.env, {
    SETTINGS_ENCRYPTION_KEYS: `v1:${KEY_V1}`,
    SETTINGS_ACTIVE_KEY_VERSION: "v1",
    API_PUBLIC_URL: "https://api.example.test",
    ...overrides,
  });

module.exports = { KEY_V1, KEY_V2, setSettingsEnv };
