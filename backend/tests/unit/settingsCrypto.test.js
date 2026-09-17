const { KEY_V1, KEY_V2, setSettingsEnv } = require("../helpers/settings");
const { encryptSecret, decryptSecret, isEncryptedWithActiveKey, maskSecret } = require("../../src/settings/crypto");

describe("settings/crypto", () => {
  const envBackup = { ...process.env };
  beforeEach(() => setSettingsEnv());
  afterEach(() => {
    process.env = { ...envBackup };
  });

  it("round-trips a secret and never stores the plaintext", () => {
    const stored = encryptSecret("super-secret-api-key");

    expect(stored).toMatchObject({ keyVersion: "v1", last4: "-key" });
    expect(stored.updatedAt).toBeInstanceOf(Date);
    expect(JSON.stringify(stored)).not.toContain("super-secret");
    expect(decryptSecret(stored)).toBe("super-secret-api-key");
  });

  it("uses a fresh IV per encryption", () => {
    const a = encryptSecret("same");
    const b = encryptSecret("same");
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it("masks short secrets without revealing them", () => {
    expect(encryptSecret("abc").last4).toBe("");
  });

  it("detects tampering", () => {
    const stored = encryptSecret("value");
    const tampered = { ...stored, ciphertext: Buffer.from("x".repeat(5)).toString("base64") };
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it("decrypts with an older key version after rotation and reports it needs re-encryption", () => {
    const old = encryptSecret("rotate-me");
    setSettingsEnv({ SETTINGS_ENCRYPTION_KEYS: `v1:${KEY_V1},v2:${KEY_V2}`, SETTINGS_ACTIVE_KEY_VERSION: "v2" });

    expect(decryptSecret(old)).toBe("rotate-me");
    expect(isEncryptedWithActiveKey(old)).toBe(false);
    expect(isEncryptedWithActiveKey(encryptSecret("new"))).toBe(true);
  });

  it("fails closed on missing or malformed key configuration", () => {
    delete process.env.SETTINGS_ENCRYPTION_KEYS;
    expect(() => encryptSecret("x")).toThrow(/SETTINGS_ENCRYPTION_KEYS/);

    setSettingsEnv({ SETTINGS_ENCRYPTION_KEYS: "v1:short" });
    expect(() => encryptSecret("x")).toThrow(/32 bytes/);

    setSettingsEnv({ SETTINGS_ACTIVE_KEY_VERSION: "v9" });
    expect(() => encryptSecret("x")).toThrow(/active key/i);
  });

  it("maskSecret exposes only metadata", () => {
    const stored = encryptSecret("abcdefgh");
    expect(maskSecret(stored)).toEqual({ isSet: true, last4: "efgh", updatedAt: stored.updatedAt });
    expect(maskSecret(null)).toEqual({ isSet: false, last4: "", updatedAt: null });
  });
});
