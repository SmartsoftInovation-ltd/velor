const mongoose = require("mongoose");
const { connectTestDb, clearTestDb, disconnectTestDb } = require("../helpers/db");
const { runForTenant } = require("../../src/tenancy/context");

jest.mock("../../src/config/redis.config", () => require("../mocks/redisCache"));

const productModel = require("../../src/models/product.model");
const variantModel = require("../../src/models/variant.model");
const { buildLowStockStages } = require("../../src/utils/lowStock.util");

// An item is low once its stock is at or below the Stock Amount entered on it.
// Every variant of a multi-variant product is judged on its own stock, never
// the parent product's (which is always 0), and an empty Stock Amount means 0.
describe("low stock list", () => {
  const tenantId = new mongoose.Types.ObjectId();

  beforeAll(connectTestDb);
  afterEach(clearTestDb);
  afterAll(disconnectTestDb);

  const product = (name, fields = {}) =>
    runForTenant(tenantId, async () => {
      const { insertedId } = await productModel.collection.insertOne({
        tenantId,
        name,
        isActive: true,
        stock: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...fields,
      });
      return insertedId;
    });

  const variant = (productId, variantName, fields = {}) =>
    runForTenant(tenantId, () =>
      variantModel.collection.insertOne({
        tenantId,
        product: productId,
        variantName,
        isActive: true,
        stockVariant: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...fields,
      }),
    );

  const lowNames = () =>
    runForTenant(tenantId, async () => {
      const rows = await productModel.aggregate([
        ...buildLowStockStages({ isActive: { $ne: false } }),
        { $sort: { name: 1, "stockRows.variantName": 1 } },
      ]);
      return rows.map((r) =>
        r.stockRows.variantName === "Single" ? r.name : `${r.name}/${r.stockRows.variantName}`,
      );
    });

  it("lists a single product at or below its Stock Amount", async () => {
    await product("At", { variantType: "singleVariant", stock: 5, alertQuantity: 5 });
    await product("Below", { variantType: "singleVariant", stock: 2, alertQuantity: 5 });
    await product("Above", { variantType: "singleVariant", stock: 6, alertQuantity: 5 });
    expect(await lowNames()).toEqual(["At", "Below"]);
  });

  it("treats an empty Stock Amount as 0", async () => {
    await product("Out", { variantType: "singleVariant", stock: 0 });
    await product("InStock", { variantType: "singleVariant", stock: 1 });
    expect(await lowNames()).toEqual(["Out"]);
  });

  it("judges each variant on its own stock, not the parent product's", async () => {
    const shirt = await product("Shirt", { variantType: "multipleVariant", stock: 0 });
    await variant(shirt, "M", { stockVariant: 20, alertQuantity: 3 });
    await variant(shirt, "L", { stockVariant: 3, alertQuantity: 3 });
    await variant(shirt, "XL", { stockVariant: 0 });
    await variant(shirt, "S", { stockVariant: 1 });
    expect(await lowNames()).toEqual(["Shirt/L", "Shirt/XL"]);
  });

  it("skips a multi-variant product with no variants yet", async () => {
    await product("Empty", { variantType: "multipleVariant", stock: 0 });
    expect(await lowNames()).toEqual([]);
  });
});
