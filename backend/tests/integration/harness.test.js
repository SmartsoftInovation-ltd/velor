const mongoose = require("mongoose");
const { connectTestDb, disconnectTestDb } = require("../helpers/db");

describe("test harness", () => {
  beforeAll(connectTestDb);
  afterAll(disconnectTestDb);

  it("does not load the real .env file", () => {
    expect(process.env.NODE_ENV).toBe("test");
    expect(require("dotenv").config().parsed).toEqual({});
  });

  it("supports multi-document transactions", async () => {
    const Thing = mongoose.model("HarnessThing", new mongoose.Schema({ name: String }));
    await Thing.createCollection();

    const session = await mongoose.startSession();
    await session.withTransaction(async () => {
      await Thing.create([{ name: "a" }, { name: "b" }], { session, ordered: true });
    });
    await session.endSession();

    expect(await Thing.countDocuments()).toBe(2);
  });
});
