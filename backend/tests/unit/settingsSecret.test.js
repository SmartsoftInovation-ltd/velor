const { KEY_V1, KEY_V2, setSettingsEnv, legacyEncrypt } = require("../helpers/settings");
const { storeSecret, readSecret, hasSecret, maskSecret } = require("../../src/settings/secret");

describe("settings/secret", () => {
  const envBackup = { ...process.env };
  beforeEach(() => setSettingsEnv());
  afterEach(() => {
    process.env = { ...envBackup };
  });

  it("stores a secret in plain text with its last four characters", () => {
    const stored = storeSecret("super-secret-api-key");

    expect(stored).toEqual({ value: "super-secret-api-key", last4: "-key", updatedAt: expect.any(Date) });
    expect(readSecret(stored)).toEqual({ ok: true, value: "super-secret-api-key" });
  });

  it("does not reveal the end of a short secret", () => {
    expect(storeSecret("abc").last4).toBe("");
  });

  it("needs no encryption key", () => {
    delete process.env.SETTINGS_ENCRYPTION_KEYS;
    expect(readSecret(storeSecret("works-without-a-key"))).toEqual({ ok: true, value: "works-without-a-key" });
  });

  it("reads a legacy encrypted secret with any key on the ring", () => {
    expect(readSecret(legacyEncrypt("old-value"))).toEqual({ ok: true, value: "old-value" });

    setSettingsEnv({ SETTINGS_ENCRYPTION_KEYS: `v1:${KEY_V1},v2:${KEY_V2}` });
    expect(readSecret(legacyEncrypt("rotated", KEY_V2, "v2"))).toEqual({ ok: true, value: "rotated" });
  });

  it("reports a legacy secret it cannot decrypt instead of throwing", () => {
    const stored = legacyEncrypt("lost-key");

    delete process.env.SETTINGS_ENCRYPTION_KEYS;
    expect(readSecret(stored)).toMatchObject({ ok: false, value: null, error: expect.any(Error) });

    setSettingsEnv();
    const tampered = { ...stored, ciphertext: Buffer.from("tampered").toString("base64") };
    expect(readSecret(tampered).ok).toBe(false);
  });

  it("treats an unset secret as empty", () => {
    expect(hasSecret(undefined)).toBe(false);
    expect(readSecret(undefined)).toEqual({ ok: true, value: null });
  });

  it("maskSecret exposes only metadata, for both shapes", () => {
    const stored = storeSecret("abcdefgh");
    expect(maskSecret(stored)).toEqual({ isSet: true, last4: "efgh", updatedAt: stored.updatedAt });
    expect(maskSecret(legacyEncrypt("abcdefgh"))).toMatchObject({ isSet: true, last4: "efgh" });
    expect(maskSecret(null)).toEqual({ isSet: false, last4: "", updatedAt: null });
  });
});
