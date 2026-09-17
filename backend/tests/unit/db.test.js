jest.mock("mongoose", () => ({
  connect: jest.fn().mockResolvedValue({ connection: { host: "localhost" } }),
}));

const mongoose = require("mongoose");
const { dbConnect } = require("../../src/database/db");

describe("dbConnect", () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.DATABASE_URL = "mongodb://db.test/app";
    jest.spyOn(console, "log").mockImplementation(() => {});
  });
  afterEach(() => {
    process.env = { ...envBackup };
    jest.restoreAllMocks();
  });

  it("disables automatic index builds in production", async () => {
    process.env.NODE_ENV = "production";
    await dbConnect();
    expect(mongoose.connect).toHaveBeenCalledWith("mongodb://db.test/app", { autoIndex: false });
  });

  it("keeps automatic index builds outside production", async () => {
    process.env.NODE_ENV = "development";
    await dbConnect();
    expect(mongoose.connect).toHaveBeenCalledWith("mongodb://db.test/app", { autoIndex: true });
  });
});
