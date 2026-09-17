const { connectTestDb, clearTestDb, disconnectTestDb } = require("../helpers/db");
const PlatformUser = require("../../src/models/platform/platformUser.model");

describe("PlatformUser model", () => {
  beforeAll(async () => {
    await connectTestDb();
    await PlatformUser.init();
  });
  afterEach(clearTestDb);
  afterAll(disconnectTestDb);

  const base = { name: "Owner", email: "Owner@Platform.test", password: "Platform-Passw0rd!" };

  it("hashes the password and verifies it", async () => {
    const user = await PlatformUser.create(base);
    const stored = await PlatformUser.findById(user._id).select("+password");

    expect(stored.password).not.toBe(base.password);
    await expect(stored.comparePassword(base.password)).resolves.toBe(true);
    await expect(stored.comparePassword("wrong")).resolves.toBe(false);
  });

  it("does not re-hash an unchanged password on later saves", async () => {
    const user = await PlatformUser.create(base);
    const stored = await PlatformUser.findById(user._id).select("+password");
    stored.name = "Renamed";
    await stored.save();

    const again = await PlatformUser.findById(user._id).select("+password");
    await expect(again.comparePassword(base.password)).resolves.toBe(true);
  });

  it("normalizes email and enforces uniqueness", async () => {
    const user = await PlatformUser.create(base);
    expect(user.email).toBe("owner@platform.test");
    await expect(PlatformUser.create({ ...base, email: "owner@platform.test" })).rejects.toThrow(/duplicate key/);
  });

  it("applies defaults and restricts roles", () => {
    const user = new PlatformUser(base);
    expect(user.role).toBe("support");
    expect(user.isActive).toBe(true);
    expect(user.tokenVersion).toBe(0);
    expect(new PlatformUser({ ...base, role: "god" }).validateSync().errors.role).toBeDefined();
  });

  it("never selects or serializes secrets by default", async () => {
    await PlatformUser.create({ ...base, twoFactorSecret: "totp-secret" });
    const user = await PlatformUser.findOne({ email: "owner@platform.test" });

    expect(user.password).toBeUndefined();
    expect(user.twoFactorSecret).toBeUndefined();

    const withSecrets = await PlatformUser.findOne().select("+password +twoFactorSecret");
    const json = withSecrets.toJSON();
    expect(json.password).toBeUndefined();
    expect(json.twoFactorSecret).toBeUndefined();
  });
});
