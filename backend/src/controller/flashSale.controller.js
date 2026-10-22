const FlashSale = require("../models/flashSale.model");
const Product = require("../models/product.model");
const Variant = require("../models/variant.model");
const { customError } = require("../lib/CustomError");
const { asynchandeler } = require("../lib/asyncHandeler");
const { apiResponse } = require("../utils/apiResponse");
const { statusCodes } = require("../constant/constant");

/**
 * Website Management → Flash Sale. A sale lists products or single variants
 * with a sale price, between a start and an end time. While it runs the
 * storefront shows those prices and checkout charges them (flashSale.service).
 */

const OBJECT_ID = /^[a-f0-9]{24}$/i;

const statusOf = (sale, now = new Date()) => {
  if (!sale.isActive) return "off";
  if (now < sale.startsAt) return "scheduled";
  if (now >= sale.endsAt) return "ended";
  return "running";
};

const summary = (sale) => ({
  _id: sale._id,
  title: sale.title,
  startsAt: sale.startsAt,
  endsAt: sale.endsAt,
  isActive: sale.isActive,
  status: statusOf(sale),
  itemCount: sale.items.length,
  updatedAt: sale.updatedAt,
});

const findOr404 = async (id) => {
  if (!OBJECT_ID.test(id)) throw new customError("Invalid id", statusCodes.BAD_REQUEST);
  const sale = await FlashSale.findById(id);
  if (!sale) throw new customError("Flash sale not found", statusCodes.NOT_FOUND);
  return sale;
};

/**
 * Checks the items against the catalogue: each product exists, each variant
 * belongs to its product, nothing is listed twice, and every sale price is
 * below the item's current retail price.
 */
const checkItems = async (items) => {
  const seen = new Set();
  for (const i of items) {
    const key = `${i.product}:${i.variant || ""}`;
    if (seen.has(key)) throw new customError("An item is listed twice in this sale", statusCodes.BAD_REQUEST);
    seen.add(key);
  }

  const productIds = [...new Set(items.map((i) => i.product))];
  const products = await Product.find({ _id: { $in: productIds } }).select("name retailPrice variantType").lean();
  if (products.length !== productIds.length) throw new customError("A chosen product was not found", statusCodes.NOT_FOUND);
  const productById = new Map(products.map((p) => [String(p._id), p]));

  const variantIds = items.map((i) => i.variant).filter(Boolean);
  const variants = await Variant.find({ _id: { $in: variantIds } }).select("product variantName retailPrice").lean();
  const variantById = new Map(variants.map((v) => [String(v._id), v]));

  for (const i of items) {
    const variant = i.variant ? variantById.get(i.variant) : null;
    if (i.variant && String(variant?.product) !== i.product) {
      throw new customError("A chosen variant does not belong to its product", statusCodes.BAD_REQUEST);
    }
    const product = productById.get(i.product);
    // Its variants can be priced differently, so one sale price for all of them could undercut some
    if (!i.variant && product.variantType === "multipleVariant") {
      throw new customError(`Pick the variants of ${product.name} to put them on sale`, statusCodes.BAD_REQUEST);
    }
    const retail = variant ? variant.retailPrice : product.retailPrice;
    const name = variant ? `${product.name} (${variant.variantName})` : product.name;
    if (i.salePrice >= retail) {
      throw new customError(`The sale price of ${name} must be below its price of ${retail}`, statusCodes.BAD_REQUEST);
    }
  }
  return items.map((i) => ({ product: i.product, variant: i.variant || null, salePrice: i.salePrice }));
};

// Two live sales at once would give an item two prices
const assertNoOverlap = async ({ startsAt, endsAt, isActive }, exceptId) => {
  if (!isActive) return;
  const clash = await FlashSale.findOne({
    isActive: true,
    startsAt: { $lt: endsAt },
    endsAt: { $gt: startsAt },
    ...(exceptId ? { _id: { $ne: exceptId } } : {}),
  })
    .select("title")
    .lean();
  if (clash) throw new customError(`This time overlaps the flash sale "${clash.title}"`, statusCodes.CONFLICT);
};

exports.list = asynchandeler(async (req, res) => {
  const sales = await FlashSale.find().sort({ startsAt: -1 }).lean();
  return apiResponse.sendSuccess(res, statusCodes.OK, "Flash sales", { sales: sales.map(summary) });
});

// One sale with what the edit form shows for each item
exports.get = asynchandeler(async (req, res) => {
  const sale = await findOr404(req.params.id);
  await sale.populate([
    { path: "items.product", select: "name slug thumbnail retailPrice stock variantType" },
    { path: "items.variant", select: "variantName size color thumbnail retailPrice stockVariant" },
  ]);
  const items = sale.items
    .filter((i) => i.product)
    .map((i) => ({
      product: i.product._id,
      variant: i.variant?._id ?? null,
      salePrice: i.salePrice,
      productName: i.product.name,
      variantName: i.variant?.variantName ?? "",
      size: i.variant?.size ?? "",
      color: i.variant?.color ?? "",
      image: i.variant?.thumbnail?.url || i.product.thumbnail?.url || "",
      retailPrice: (i.variant ? i.variant.retailPrice : i.product.retailPrice) ?? 0,
      stock: (i.variant ? i.variant.stockVariant : i.product.stock) ?? 0,
    }));
  return apiResponse.sendSuccess(res, statusCodes.OK, "Flash sale", { sale: { ...summary(sale), items } });
});

exports.create = asynchandeler(async (req, res) => {
  const items = await checkItems(req.body.items);
  await assertNoOverlap(req.body);
  const sale = await FlashSale.create({ ...req.body, items });
  return apiResponse.sendSuccess(res, statusCodes.CREATED, "Flash sale created", { sale: summary(sale) });
});

exports.update = asynchandeler(async (req, res) => {
  const sale = await findOr404(req.params.id);
  const items = await checkItems(req.body.items);
  await assertNoOverlap(req.body, sale._id);
  sale.set({ ...req.body, items });
  await sale.save();
  return apiResponse.sendSuccess(res, statusCodes.OK, "Flash sale saved", { sale: summary(sale) });
});

exports.remove = asynchandeler(async (req, res) => {
  const sale = await findOr404(req.params.id);
  await sale.deleteOne();
  return apiResponse.sendSuccess(res, statusCodes.OK, "Flash sale deleted", { _id: sale._id });
});
