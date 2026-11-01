const mongoose = require("mongoose");
const { connectTestDb, clearTestDb, disconnectTestDb } = require("../helpers/db");
const { runForTenant } = require("../../src/tenancy/context");

jest.mock("../../src/config/redis.config", () => require("../mocks/redisCache"));

const productModel = require("../../src/models/product.model");
const variantModel = require("../../src/models/variant.model");
const { getAllVariants } = require("../../src/controller/variant.controller");

// Variant list search: any part of the variant's name or of its product's
// name (variant names are often one glued word), or a barcode / sku prefix
describe("variant list search", () => {
  const tenantId = new mongoose.Types.ObjectId();

  beforeAll(connectTestDb);
  afterEach(async () => {
    await clearTestDb();
    require("../mocks/redisCache").__reset();
  });
  afterAll(disconnectTestDb);

  // Raw inserts, with the searchWords the model hooks would have written
  const insertProduct = async (name) => {
    const { insertedId } = await productModel.collection.insertOne({
      tenantId, name, variantType: "multipleVariant", searchWords: name.toLowerCase().split(/\s+/), createdAt: new Date(),
    });
    return { _id: insertedId };
  };

  const search = (term) =>
    runForTenant(tenantId, async () => {
      let body;
      let error;
      const res = { status: () => res, json: (b) => (body = b) };
      await getAllVariants({ query: { search: term } }, res, (err) => (error = err));
      if (error) throw error;
      return body.data.variants.map((v) => v.variantName).sort();
    });

  beforeEach(async () => {
    const shirt = await insertProduct("CASUAL FULL SHIRT");
    const pant = await insertProduct("JEANS PANT");
    await variantModel.collection.insertMany([
      { tenantId, product: shirt._id, variantName: "CASUALFULLSHIRT", searchWords: ["casualfullshirt"], barCode: "111222", createdAt: new Date() },
      { tenantId, product: shirt._id, variantName: "CASUALFULLSHIRT2", searchWords: ["casualfullshirt2"], barCode: "111333", createdAt: new Date() },
      { tenantId, product: pant._id, variantName: "JEANSPANT", searchWords: ["jeanspant"], barCode: "999000", createdAt: new Date() },
    ]);
  });

  it("finds variants by a word of their product's name", async () => {
    expect(await search("shirt")).toEqual(["CASUALFULLSHIRT", "CASUALFULLSHIRT2"]);
    expect(await search("casual full")).toEqual(["CASUALFULLSHIRT", "CASUALFULLSHIRT2"]);
    expect(await search("jeans")).toEqual(["JEANSPANT"]);
  });

  it("matches any part of the name, in any case", async () => {
    expect(await search("ullshirt2")).toEqual(["CASUALFULLSHIRT2"]);
    expect(await search("ANSPA")).toEqual(["JEANSPANT"]);
    // "ull" is inside the product name "CASUAL FULL SHIRT"
    expect(await search("ull")).toEqual(["CASUALFULLSHIRT", "CASUALFULLSHIRT2"]);
  });

  it("still finds a variant by its own name and by barcode", async () => {
    expect(await search("jeanspant")).toEqual(["JEANSPANT"]);
    expect(await search("111333")).toEqual(["CASUALFULLSHIRT2"]);
  });
});
