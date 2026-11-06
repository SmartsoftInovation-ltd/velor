const mongoose = require("mongoose");
const { connectTestDb, clearTestDb, disconnectTestDb } = require("../helpers/db");
const migration = require("../../src/migrations/018-optional-user-email");
const User = require("../../src/models/user.model");

/**
 * Databases built before email became optional carry a plain unique
 * { tenantId, email } index, under which a second phone-only shopper in a
 * store fails as a duplicate null. 018 swaps it for a partial one.
 */
describe("migration 018-optional-user-email", () => {
  const tenantId = new mongoose.Types.ObjectId();
  const users = () => User.collection;
  const raw = (doc) => users().insertOne({ tenantId, name: "x", password: "x", roles: [], ...doc });

  beforeAll(connectTestDb);
  afterEach(clearTestDb);
  afterAll(disconnectTestDb);

  beforeEach(async () => {
    // Let Mongoose finish building its own (new, partial) index before replacing it with the old one
    await User.init();
    await users().dropIndex("tenantId_1_email_1").catch(() => {});
    await users().createIndex({ tenantId: 1, email: 1 }, { name: "tenantId_1_email_1", unique: true });
  });

  it("rebuilds the old index as partial, clearing blank emails first", async () => {
    await raw({ email: "" });
    await raw({ phone: "01711000001" });
    await expect(raw({ phone: "01711000002" })).rejects.toThrow(/E11000/);

    const result = await migration.up();
    expect(result).toEqual({ blanksCleared: 1, rebuilt: true });

    await raw({ phone: "01711000002" });
    await raw({ email: "a@b.com" });
    await expect(raw({ email: "a@b.com" })).rejects.toThrow(/E11000/);
    expect(await users().countDocuments({ email: "" })).toBe(0);
  });

  it("does nothing the second time", async () => {
    await migration.up();
    expect(await migration.up()).toEqual({ blanksCleared: 0, rebuilt: false });
  });
});
