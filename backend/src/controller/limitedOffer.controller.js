const LimitedOffer = require("../models/limitedOffer.model");
const Product = require("../models/product.model");
const Variant = require("../models/variant.model");
const { customError } = require("../lib/CustomError");
const { asynchandeler } = require("../lib/asyncHandeler");
const { apiResponse } = require("../utils/apiResponse");
const { statusCodes } = require("../constant/constant");
const { bumpNsVersion } = require("../utils/cache.util");
const { storefrontOrigin } = require("../service/storefrontUrl.service");

/**
 * Website Management → Limited Offer: the products and variants a seller
 * features in the storefront's "Limited offers" section. The storefront reads
 * them through GET /shop/limited-offers (shopCatalog.controller).
 */

// The storefront list is cached under this namespace; every change here refreshes it
const NS = "limited-offer";

const OBJECT_ID = /^[a-f0-9]{24}$/i;

const imageOf = (doc) => doc?.thumbnail?.url || doc?.image?.find?.((i) => i?.url)?.url || "";

// What the dashboard list shows for one entry
const present = (entry, origin) => {
  const { product, variant } = entry;
  const path = product ? `/product/${product.slug}${variant ? `?variant=${variant._id}` : ""}` : "";
  return {
    _id: entry._id,
    priority: entry.priority,
    isActive: entry.isActive,
    createdAt: entry.createdAt,
    product: product ? { _id: product._id, name: product.name, slug: product.slug, isActive: product.isActive !== false } : null,
    variant: variant
      ? { _id: variant._id, name: variant.variantName, size: variant.size, color: variant.color, isActive: variant.isActive !== false }
      : null,
    image: imageOf(variant) || imageOf(product),
    price: (variant ? variant.retailPrice : product?.retailPrice) ?? 0,
    stock: (variant ? variant.stockVariant : product?.stock) ?? 0,
    // Where "View on website" opens; empty until the store has a domain or storefront URL
    storefrontUrl: origin && path ? `${origin}${path}` : "",
  };
};

const listEntries = async () => {
  const [entries, origin] = await Promise.all([
    LimitedOffer.find()
      .sort({ priority: 1, createdAt: -1 })
      .populate("product", "name slug thumbnail image retailPrice stock isActive")
      .populate("variant", "variantName size color thumbnail image retailPrice stockVariant isActive")
      .lean(),
    storefrontOrigin(),
  ]);
  return entries.map((entry) => present(entry, origin));
};

exports.list = asynchandeler(async (req, res) => {
  const items = await listEntries();
  return apiResponse.sendSuccess(res, statusCodes.OK, "Limited offers", { items });
});

const keyOf = (product, variant) => `${product}:${variant || ""}`;

/**
 * Adds one or many picks in a single request. Picks already in Limited Offer
 * (or repeated in the request) are skipped rather than failing the batch; a
 * product that does not exist, or a variant of another product, fails it.
 */
exports.add = asynchandeler(async (req, res) => {
  const { items, priority } = req.body;

  const productIds = [...new Set(items.map((i) => i.product))];
  const found = await Product.find({ _id: { $in: productIds } }).select("_id").lean();
  if (found.length !== productIds.length) throw new customError("A chosen product was not found", statusCodes.NOT_FOUND);

  const variantIds = items.map((i) => i.variant).filter(Boolean);
  if (variantIds.length) {
    const variants = await Variant.find({ _id: { $in: variantIds } }).select("_id product").lean();
    const ownerOf = new Map(variants.map((v) => [String(v._id), String(v.product)]));
    // Every variant must exist and belong to the product it was picked under
    if (items.some((i) => i.variant && ownerOf.get(i.variant) !== i.product)) {
      throw new customError("A chosen variant does not belong to its product", statusCodes.BAD_REQUEST);
    }
  }

  const existing = await LimitedOffer.find({ product: { $in: productIds } }).select("product variant").lean();
  const taken = new Set(existing.map((e) => keyOf(e.product, e.variant)));

  const fresh = [];
  for (const item of items) {
    const key = keyOf(item.product, item.variant);
    if (taken.has(key)) continue;
    taken.add(key);
    fresh.push({ product: item.product, variant: item.variant || null, priority: priority + fresh.length });
  }

  if (fresh.length) {
    try {
      await LimitedOffer.insertMany(fresh, { ordered: false });
    } catch (error) {
      // A pick added by someone else a moment ago: the unique index skips it
      if (error.code !== 11000 && !error.writeErrors?.every((e) => e.code === 11000)) throw error;
    }
    await bumpNsVersion(NS);
  }

  const skipped = items.length - fresh.length;
  const message = fresh.length
    ? `Added ${fresh.length} to Limited Offer${skipped ? `, ${skipped} already there` : ""}`
    : "Everything chosen is already in Limited Offer";
  return apiResponse.sendSuccess(res, statusCodes.CREATED, message, {
    added: fresh.length,
    skipped,
    items: await listEntries(),
  });
});

exports.update = asynchandeler(async (req, res) => {
  if (!OBJECT_ID.test(req.params.id)) throw new customError("Invalid id", statusCodes.BAD_REQUEST);
  const entry = await LimitedOffer.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
  if (!entry) throw new customError("Entry not found", statusCodes.NOT_FOUND);

  await bumpNsVersion(NS);
  return apiResponse.sendSuccess(res, statusCodes.OK, "Limited Offer updated", { items: await listEntries() });
});

exports.remove = asynchandeler(async (req, res) => {
  if (!OBJECT_ID.test(req.params.id)) throw new customError("Invalid id", statusCodes.BAD_REQUEST);
  const entry = await LimitedOffer.findByIdAndDelete(req.params.id);
  if (!entry) throw new customError("Entry not found", statusCodes.NOT_FOUND);

  await bumpNsVersion(NS);
  return apiResponse.sendSuccess(res, statusCodes.OK, "Removed from Limited Offer", { items: await listEntries() });
});
