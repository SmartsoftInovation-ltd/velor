const Product = require("../models/product.model");
const Variant = require("../models/variant.model");
const { customerModel: Customer } = require("../models/customer.model");
const { searchWordsOf } = require("../utils/searchWords.util");

const BATCH = 1000;

// Gives every existing product, variant and customer of the store its
// `searchWords` (the lower-case words of its name), which the product searches
// and the report customer picker match through an index (BUG-P2-004 / P2-011 /
// P2-002). New and renamed items get them from
// the model hooks. Native driver, in batches: no hooks, and no store loaded
// whole into memory.
const backfill = async (collection, tenantId, field) => {
  let updated = 0;
  let ops = [];
  const cursor = collection.find(
    { tenantId, searchWords: { $exists: false } },
    { projection: { [field]: 1 } },
  );
  for await (const doc of cursor) {
    ops.push({
      updateOne: { filter: { _id: doc._id }, update: { $set: { searchWords: searchWordsOf(doc[field]) } } },
    });
    if (ops.length === BATCH) {
      updated += (await collection.bulkWrite(ops, { ordered: false })).modifiedCount;
      ops = [];
    }
  }
  if (ops.length) updated += (await collection.bulkWrite(ops, { ordered: false })).modifiedCount;
  return updated;
};

module.exports = {
  name: "015-backfill-search-words",
  up: async ({ tenant }) => ({
    products: await backfill(Product.collection, tenant._id, "name"),
    variants: await backfill(Variant.collection, tenant._id, "variantName"),
    customers: await backfill(Customer.collection, tenant._id, "fullName"),
  }),
};
