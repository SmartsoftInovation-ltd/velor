const productModel = require("../models/product.model");
const variantModel = require("../models/variant.model");

const lineKey = (it) =>
  it?.variantId ? `v:${it.variantId}` : it?.productId ? `p:${it.productId}` : null;

/**
 * Freezes what each sale line's goods cost onto the line, so the profit of an
 * old invoice does not move when a later purchase changes the catalogue price.
 *
 * The cost is read from the catalogue here, never taken from the request. A
 * line that was already on the sale (`previousItems`) keeps the cost it was
 * first stamped with.
 */
const stampPurchasePrices = async (items, session, previousItems = []) => {
  if (!Array.isArray(items) || !items.length) return items;

  const stamped = new Map();
  for (const it of previousItems) {
    const key = lineKey(it);
    if (key && it.purchasePrice != null) stamped.set(key, it.purchasePrice);
  }

  const missing = items.filter((it) => !stamped.has(lineKey(it)));
  const idsOf = (field) => [...new Set(missing.map((it) => it?.[field]).filter(Boolean).map(String))];
  const priceMap = async (model, ids) => {
    if (!ids.length) return new Map();
    const docs = await model.find({ _id: { $in: ids } }).select("purchasePrice").session(session ?? null).lean();
    return new Map(docs.map((d) => [String(d._id), d.purchasePrice]));
  };
  const [variantPrices, productPrices] = await Promise.all([
    priceMap(variantModel, idsOf("variantId")),
    priceMap(productModel, idsOf("productId")),
  ]);

  // Same order the profit formula reads the catalogue in: the variant's
  // purchasePrice, falling back to the product's.
  return items.map((it) => ({
    ...it,
    purchasePrice:
      stamped.get(lineKey(it)) ??
      variantPrices.get(String(it?.variantId)) ??
      productPrices.get(String(it?.productId)) ??
      0,
  }));
};

module.exports = { stampPurchasePrices };
