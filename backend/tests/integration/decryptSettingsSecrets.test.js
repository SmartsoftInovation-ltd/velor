const mongoose = require("mongoose");
const { connectTestDb, disconnectTestDb } = require("../helpers/db");
const { setSettingsEnv, legacyEncrypt } = require("../helpers/settings");
const migration = require("../../src/migrations/010-decrypt-settings-secrets");
const service = require("../../src/settings/settings.service");
const TenantSettings = require("../../src/models/platform/tenantSettings.model");

describe("migration 010-decrypt-settings-secrets", () => {
  const envBackup = { ...process.env };
  const tenant = { _id: new mongoose.Types.ObjectId() };

  beforeAll(async () => {
    setSettingsEnv();
    await connectTestDb();
  });

  afterAll(async () => {
    process.env = { ...envBackup };
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await TenantSettings.deleteMany({});
    service.clearSettingsCache();
  });

  it("rewrites encrypted secrets as plain text and leaves other fields alone", async () => {
    await TenantSettings.create({
      tenantId: tenant._id,
      version: 3,
      data: {
        sms: { enabled: true, apiKey: legacyEncrypt("legacy-sms-key"), senderId: "8809617" },
        cloudinary: { enabled: true, cloudName: "cdn", apiKey: { value: "already-plain", last4: "", updatedAt: new Date() } },
      },
    });

    const result = await migration.up({ tenant });

    expect(result).toEqual({ converted: ["sms.apiKey"], unreadable: [] });
    const raw = await TenantSettings.findOne({ tenantId: tenant._id }).lean();
    expect(raw.version).toBe(4);
    expect(raw.data.sms).toMatchObject({ enabled: true, senderId: "8809617", apiKey: { value: "legacy-sms-key", last4: "-key" } });
    expect(raw.data.sms.apiKey.ciphertext).toBeUndefined();
    expect(raw.data.cloudinary.apiKey.value).toBe("already-plain");

    // The deployment no longer needs the key
    delete process.env.SETTINGS_ENCRYPTION_KEYS;
    expect((await service.getSettings(tenant._id)).sms.apiKey).toBe("legacy-sms-key");
    setSettingsEnv();
  });

  it("reports a secret whose key is missing and keeps it", async () => {
    await TenantSettings.create({ tenantId: tenant._id, data: { sms: { apiKey: legacyEncrypt("lost") } } });
    delete process.env.SETTINGS_ENCRYPTION_KEYS;

    const result = await migration.up({ tenant });
    setSettingsEnv();

    expect(result).toEqual({ converted: [], unreadable: ["sms.apiKey"] });
    expect((await TenantSettings.findOne({ tenantId: tenant._id }).lean()).data.sms.apiKey.ciphertext).toBeDefined();
  });

  it("does nothing for a tenant without settings", async () => {
    await expect(migration.up({ tenant })).resolves.toEqual({ converted: [], unreadable: [] });
  });
});
