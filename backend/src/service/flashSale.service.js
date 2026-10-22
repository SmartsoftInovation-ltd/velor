const FlashSale = require("../models/flashSale.model");

/**
 * The flash sale running now in the current store, and the price it sets.
 *
 * Read on every storefront and checkout request, so it is one small indexed
 * query; sales are few and short. Prices are always resolved here, never
 * trusted from the client.
 */

const runningSale = async (now = new Date()) =>
  FlashSale.findOne({ isActive: true, startsAt: { $lte: now }, endsAt: { $gt: now } })
    .sort({ endsAt: 1 })
    .lean();

/**
 * Sale price lookup for one running sale: a variant entry beats a whole
 * product entry. Never above the retail price, in case retail was cut after
 * the sale was set up.
 */
const pricer = (sale) => {
  const byVariant = new Map();
  const byProduct = new Map();
  for (const item of sale?.items ?? []) {
    if (item.variant) byVariant.set(String(item.variant), item.salePrice);
    else byProduct.set(String(item.product), item.salePrice);
  }

  return ({ productId, variantId, retailPrice }) => {
    const fromVariant = variantId ? byVariant.get(String(variantId)) : undefined;
    const price = fromVariant ?? byProduct.get(String(productId));
    return price === undefined ? null : Math.min(price, retailPrice ?? price);
  };
};

/** { sale, priceFor } for the store's running sale; priceFor returns null for items not on sale. */
const currentPricing = async () => {
  const sale = await runningSale();
  return { sale, priceFor: pricer(sale) };
};

module.exports = { runningSale, pricer, currentPricing };
