const mongoose = require("mongoose");
const { connectTestDb, clearTestDb, disconnectTestDb } = require("../helpers/db");
const { runForTenant } = require("../../src/tenancy/context");

jest.mock("../../src/config/redis.config", () => require("../mocks/redisCache"));

const salesModel = require("../../src/models/sales.model");

// "Total Due Balance" on the dashboard's Customer box is a receivable: money
// the shop can still go and collect. A walking customer has no account to owe
// against — whatever they did not pay is settled at the counter — so only a
// listed customer's unpaid amount belongs in the figure. Summing every sale's
// presentDue counted walking sales too and overstated it.
describe("customer due counts listed customers only", () => {
  const tenantId = new mongoose.Types.ObjectId();

  beforeAll(connectTestDb);
  afterEach(clearTestDb);
  afterAll(disconnectTestDb);

  // The aggregation the dashboard runs for the Customer box.
  const LISTED_ONLY = [
    { $match: { "customerType.type": "listed" } },
    { $group: { _id: null, totalDue: { $sum: "$presentDue" } } },
  ];

  const sale = (type, presentDue, extra = {}) =>
    runForTenant(tenantId, () =>
      salesModel.collection.insertOne({
        tenantId,
        presentDue,
        customerType:
          type === "listed"
            ? { type: "listed", customerId: new mongoose.Types.ObjectId(), walking: null }
            : { type: "walking", walking: { customerName: "Walk-in" }, customerId: null },
        date: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        ...extra,
      }),
    );

  const totalDue = () =>
    runForTenant(tenantId, async () => {
      const [row] = await salesModel.aggregate(LISTED_ONLY);
      return row?.totalDue || 0;
    });

  it("counts a listed customer's unpaid amount", async () => {
    await sale("listed", 1200);
    expect(await totalDue()).toBe(1200);
  });

  it("leaves a walking customer's unpaid amount out", async () => {
    await sale("walking", 2350);
    expect(await totalDue()).toBe(0);
  });

  it("adds up only the listed sales when both kinds exist", async () => {
    await sale("listed", 1000);
    await sale("walking", 2350);
    await sale("listed", 500);
    await sale("walking", 90);

    // 1000 + 500 — the 2350 and 90 belong to walk-ins
    expect(await totalDue()).toBe(1500);
  });

  it("is zero when every sale is to a walking customer", async () => {
    await sale("walking", 700);
    await sale("walking", 300);
    expect(await totalDue()).toBe(0);
  });
});
