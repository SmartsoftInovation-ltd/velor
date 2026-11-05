const { customError } = require("../lib/CustomError");
const { apiResponse } = require("../utils/apiResponse");
const { asynchandeler } = require("../lib/asyncHandeler");
const Product = require("../models/product.model");
const Variant = require("../models/variant.model");
const StockAdjust = require("../models/stockadjust.model");
const { statusCodes } = require("../constant/constant");
const { getCache, setCache, bumpNsVersion, buildCacheKey } = require("@/utils/cache.util");
const { logAudit } = require("@/service/audit.service");
const { inTransaction } = require("@/utils/transaction.util");

const NS = "stock";
const CACHE_TTL = 60 * 30; // 30 minutes

// Swallow Redis errors so a cache miss never breaks the response
const safeGet  = async (key) =>           { try { return key ? await getCache(key) : null; } catch { return null; } };
const safeSet  = async (key, val, ttl) => { try { if (key) await setCache(key, val, ttl); } catch {} };
const safeKey  = async (ns, suffix) =>    { try { return await buildCacheKey(ns, suffix); } catch { return null; } };
const safeBump = async (ns) =>            { try { await bumpNsVersion(ns);                } catch {} };

/**
 * Move a product's or variant's stock and its adjustment counters in one
 * atomic update. Reading the document, adding in JS and saving it back let
 * parallel adjustments overwrite each other (20 × +1 added less than 20).
 * The counters never go below 0, as before. A change that would take the
 * stock below 0 does not match, and is refused.
 */
const applyAdjustment = (Model, id, stockField, { stock = 0, plus = 0, minus = 0 }, session) => {
  const counter = (field, change) => ({
    $max: [0, { $add: [{ $ifNull: [`$${field}`, 0] }, change] }],
  });
  const filter = stock < 0 ? { _id: id, [stockField]: { $gte: -stock } } : { _id: id };
  return Model.findOneAndUpdate(
    filter,
    [
      {
        $set: {
          [stockField]: { $add: [{ $ifNull: [`$${stockField}`, 0] }, stock] },
          stockAdjustmentPlus: counter("stockAdjustmentPlus", plus),
          stockAdjustmentMinus: counter("stockAdjustmentMinus", minus),
        },
      },
    ],
    { session },
  );
};

const adjustStock = async (Model, id, field, label, change, session) => {
  if (await applyAdjustment(Model, id, field, change, session)) return;
  if (await Model.exists({ _id: id }).session(session)) {
    throw new customError(
      `${label} stock cannot go below 0`,
      statusCodes.BAD_REQUEST,
    );
  }
  throw new customError(`${label} not found`, statusCodes.NOT_FOUND);
};

const adjustProduct = (id, change, session) => adjustStock(Product, id, "stock", "Product", change, session);
const adjustVariant = (id, change, session) => adjustStock(Variant, id, "stockVariant", "Variant", change, session);

// An adjustment quantity: a whole number of 0 or more; missing counts as 0.
// A negative increase silently decreased stock and the "plus" total.
const adjustQuantity = (value, name) => {
  if (value === undefined || value === null || value === "") return 0;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) {
    throw new customError(`${name} must be a whole number of 0 or more`, statusCodes.BAD_REQUEST);
  }
  return n;
};

//@desc create stock adjust
//@route POST /api/stock-adjust
//@access Private
exports.createStockAdjust = asynchandeler(async (req, res) => {
  const {
    variantId,
    productId,
    adjustReason,
    increaseQuantity,
    decreaseQuantity,
    date,
  } = req.body;

  if (!variantId && !productId) {
    throw new customError(
      "Please provide either productId or variantId",
      statusCodes.BAD_REQUEST,
    );
  }

  if (!adjustReason) {
    throw new customError(
      "Please provide all required fields",
      statusCodes.BAD_REQUEST,
    );
  }

  const plus = adjustQuantity(increaseQuantity, "increaseQuantity");
  const minus = adjustQuantity(decreaseQuantity, "decreaseQuantity");
  const change = { stock: plus - minus, plus, minus };

  // The stock moves first and the record is written in the same transaction,
  // so an unknown product or a decrease below 0 leaves no adjustment behind
  const stockAdjust = await inTransaction(async (session) => {
    if (productId) await adjustProduct(productId, change, session);
    if (variantId) await adjustVariant(variantId, change, session);
    const [created] = await StockAdjust.create(
      [
        {
          productId: productId || null,
          variantId: variantId || null,
          adjustReason,
          // Stored as edit stores them: an unused side is null
          increaseQuantity: plus || null,
          decreaseQuantity: minus || null,
          date,
        },
      ],
      { session },
    );
    return created;
  });

  await safeBump(NS);
  await safeBump("product");

  logAudit({
    req,
    action: "STOCK_ADJUST",
    entityType: "stockadjust",
    entityId: stockAdjust._id,
    entityLabel: adjustReason,
    after: stockAdjust,
  });

  return apiResponse.sendSuccess(
    res,
    statusCodes.CREATED,
    "Stock adjustment created successfully",
    stockAdjust,
  );
});

// @des view all product latest stock
exports.getAllStockAdjusts = asynchandeler(async (req, res) => {
  const page  = Math.max(1, parseInt(req.query.page,  10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const skip  = (page - 1) * limit;
  const q     = String(req.query.q || "").trim();

  // When a search query is present, filter by barcode or product/variant name
  // using an aggregation pipeline so we can match on joined fields.
  if (q) {
    const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const qRegex = new RegExp(escapeRegex(q), "i");

    const pipeline = [
      // join product
      {
        $lookup: {
          from: "products",
          localField: "productId",
          foreignField: "_id",
          as: "_product",
        },
      },
      { $unwind: { path: "$_product", preserveNullAndEmptyArrays: true } },
      // join variant
      {
        $lookup: {
          from: "variants",
          localField: "variantId",
          foreignField: "_id",
          as: "_variant",
        },
      },
      { $unwind: { path: "$_variant", preserveNullAndEmptyArrays: true } },
      // filter: barcode or name match on either product or variant
      {
        $match: {
          $or: [
            { "_product.name":    qRegex },
            { "_product.barCode": qRegex },
            { "_variant.variantName": qRegex },
            { "_variant.barCode":     qRegex },
            { "_variant.sku":         qRegex },
          ],
        },
      },
      { $sort: { createdAt: -1 } },
      // total count facet
      {
        $facet: {
          data:  [{ $skip: skip }, { $limit: limit }],
          total: [{ $count: "count" }],
        },
      },
    ];

    const [result] = await StockAdjust.aggregate(pipeline);
    const rawIds   = (result?.data ?? []).map((d) => d._id);
    const total    = result?.total?.[0]?.count ?? 0;

    // Re-fetch with full populate using the filtered _ids (preserves lean populate DX)
    const stockAdjusts = await StockAdjust.find({ _id: { $in: rawIds } })
      .populate({
        path: "productId",
        populate: { path: "subcategory" },
        select: "name barCode sku size color stock subcategory",
      })
      .populate({
        path: "variantId",
        populate: { path: "product", select: "name subcategory", populate: { path: "subcategory", select: "name" } },
        select: "variantName barCode sku size color stockVariant",
      })
      .sort({ createdAt: -1 })
      .lean();

    return apiResponse.sendSuccess(res, statusCodes.OK, "Stock adjustments retrieved successfully", {
      stockAdjusts,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      fromCache: false,
    });
  }

  // No search — plain paginated fetch with cache
  const cacheKey = await safeKey(NS, `adjusts:p${page}:l${limit}`);
  const cached   = await safeGet(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(res, statusCodes.OK, "Stock adjustments retrieved successfully", {
      ...cached,
      fromCache: true,
    });
  }

  const [stockAdjusts, total] = await Promise.all([
    StockAdjust.find()
      .populate({
        path: "productId",
        populate: { path: "subcategory", select: "name" },
        select: "name barCode sku size color stock subcategory",
      })
      .populate({
        path: "variantId",
        populate: { path: "product", select: "name subcategory", populate: { path: "subcategory", select: "name" } },
        select: "variantName barCode sku size color stockVariant",
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    StockAdjust.countDocuments(),
  ]);

  const payload = {
    stockAdjusts: stockAdjusts ?? [],
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
  await safeSet(cacheKey, payload, CACHE_TTL);

  return apiResponse.sendSuccess(res, statusCodes.OK,
    stockAdjusts.length ? "Stock adjustments retrieved successfully" : "Stock adjustments not found",
    { ...payload, fromCache: false },
  );
});

// @desc get all product category wise

exports.getAllProductCategoryWise = asynchandeler(async (req, res) => {
  const { category } = req.params;
  if (!category)
    throw new customError("Category is required", statusCodes.BAD_REQUEST);

  const cacheKey = await safeKey(NS, `cat:${category}`);
  const cached   = await safeGet(cacheKey);
  if (cached) return apiResponse.sendSuccess(res, statusCodes.OK, "Products retrieved successfully", cached);

  const products = await Product.find({ category }).populate(
    "category subcategory brand variant",
  );
  await safeSet(cacheKey, products, CACHE_TTL);
  apiResponse.sendSuccess(res, statusCodes.OK, "Products retrieved successfully", products);
});

exports.getAllProductSSubcategoryWise = asynchandeler(async (req, res) => {
  const { subcategory } = req.params;
  if (!subcategory)
    throw new customError("Subcategory is required", statusCodes.BAD_REQUEST);

  const cacheKey = await safeKey(NS, `subcat:${subcategory}`);
  const cached   = await safeGet(cacheKey);
  if (cached) return apiResponse.sendSuccess(res, statusCodes.OK, "Products retrieved successfully", cached);

  const products = await Product.find({ subcategory }).populate(
    "category subcategory brand variant",
  );
  if (!products || products.length === 0)
    throw new customError("Products not found", statusCodes.NOT_FOUND);
  await safeSet(cacheKey, products, CACHE_TTL);
  apiResponse.sendSuccess(res, statusCodes.OK, "Products retrieved successfully", products);
});

// @desc get all variant
exports.getAllVariants = asynchandeler(async (req, res, next) => {
  const page  = Math.max(1, parseInt(req.query.page  || "1", 10));
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit || "100", 10)));
  const skip  = (page - 1) * limit;

  const cacheKey = await safeKey(NS, `variants:p${page}:l${limit}`);
  const cached   = await safeGet(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(res, statusCodes.OK, "Variants fetched successfully", {
      ...cached,
      fromCache: true,
    });
  }

  // Run both queries + counts in parallel
  const [variants, singleProducts, totalVariants, totalSingle] = await Promise.all([
    Variant.find()
      .populate({ path: "product", populate: [{ path: "category", select: "name _id" }, { path: "subcategory", select: "name _id" }, { path: "brand", select: "name _id" }] })
      .select("variantName barCode sku size color stockVariant product")
      // _id settles equal dates, or paging could repeat one variant and skip another
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    Product.find({ variantType: "singleVariant" })
      .populate("category", "name _id")
      .populate("subcategory", "name _id")
      .populate("brand", "name _id")
      .select("name barCode sku size color stock category subcategory brand")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    Variant.countDocuments(),
    Product.countDocuments({ variantType: "singleVariant" }),
  ]);

  const total      = totalVariants + totalSingle;
  const totalPages = Math.ceil(total / limit);

  const payload = { variants, singleProducts, total, totalPages, page, limit };
  await safeSet(cacheKey, payload, CACHE_TTL);

  apiResponse.sendSuccess(res, statusCodes.OK, "Variants fetched successfully", {
    ...payload,
    fromCache: false,
  });
});

//@desc  get all single varinat product
exports.getSingleVariant = asynchandeler(async (req, res) => {
  const singleVariant = await Product.findOne({ variantType: "singleVariant" });

  if (!singleVariant) {
    throw new customError("Variant not found", statusCodes.NOT_FOUND);
  }
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Variant fetched successfully",
    singleVariant,
  );
});

//@desc delete stockadust by id  en delete en product stock decrease
exports.deleteStockAdjustById = asynchandeler(async (req, res) => {
  const { id } = req.params;
  if (!id)
    throw new customError(
      "Stock adjustment ID is required",
      statusCodes.BAD_REQUEST,
    );

  const stockAdjust = await StockAdjust.findById(id);
  if (!stockAdjust)
    throw new customError("Stock adjustment not found", statusCodes.NOT_FOUND);

  // Reverse the stock change on the source document before deleting
  const { productId, variantId, decreaseQuantity, increaseQuantity } =
    stockAdjust;
  const plus = increaseQuantity || 0;
  const minus = decreaseQuantity || 0;
  const reverse = { stock: minus - plus, plus: -plus, minus: -minus };
  await inTransaction(async (session) => {
    if (productId) await adjustProduct(productId, reverse, session);
    if (variantId) await adjustVariant(variantId, reverse, session);
    await StockAdjust.findByIdAndDelete(id, { session });
  });
  await safeBump(NS);
  await safeBump("product");

  logAudit({
    req,
    action: "DELETE",
    entityType: "stockadjust",
    entityId: stockAdjust._id,
    entityLabel: stockAdjust.adjustReason,
    before: stockAdjust,
  });

  return apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Stock adjustment deleted successfully",
    { id },
  );
});

//@desc  get single stock adjustment by id — full populate for view modal
exports.getStockAdjustById = asynchandeler(async (req, res) => {
  const { id } = req.params;
  if (!id)
    throw new customError("Stock adjustment ID is required", statusCodes.BAD_REQUEST);

  const stockAdjust = await StockAdjust.findById(id)
    .populate({
      path: "productId",
      populate: { path: "category subcategory brand", select: "name" },
      select: "name barCode sku size color stock groupUnit groupUnitQuantity unit purchasePrice retailPrice wholesalePrice subcategory category brand thumbnail",
    })
    .populate({
      path: "variantId",
      populate: {
        path: "product",
        select: "name subcategory category brand thumbnail",
        populate: { path: "subcategory category brand", select: "name" },
      },
      select: "variantName barCode sku size color stockVariant purchasePrice retailPrice wholesalePrice thumbnail",
    })
    .lean();

  if (!stockAdjust)
    throw new customError("Stock adjustment not found", statusCodes.NOT_FOUND);

  return apiResponse.sendSuccess(res, statusCodes.OK, "Stock adjustment retrieved", { stockAdjust });
});

//@desc  update stock adjustment (reason, date, quantities) and re-apply stock delta
exports.updateStockAdjustById = asynchandeler(async (req, res) => {
  const { id } = req.params;
  if (!id)
    throw new customError("Stock adjustment ID is required", statusCodes.BAD_REQUEST);

  const existing = await StockAdjust.findById(id);
  if (!existing)
    throw new customError("Stock adjustment not found", statusCodes.NOT_FOUND);

  const {
    increaseQuantity: newInc,
    decreaseQuantity: newDec,
    adjustReason,
    date,
  } = req.body;

  const oldInc = existing.increaseQuantity || 0;
  const oldDec = existing.decreaseQuantity || 0;
  const oldDelta = oldInc - oldDec;

  const resolvedInc = newInc != null ? adjustQuantity(newInc, "increaseQuantity") : oldInc;
  const resolvedDec = newDec != null ? adjustQuantity(newDec, "decreaseQuantity") : oldDec;
  const newDelta = resolvedInc - resolvedDec;

  const stockDiff = newDelta - oldDelta; // net change to apply on top of existing
  const incDiff = resolvedInc - oldInc; // change to apply to stockAdjustmentPlus
  const decDiff = resolvedDec - oldDec; // change to apply to stockAdjustmentMinus

  const beforeAdjust = existing.toObject();
  existing.increaseQuantity = resolvedInc || null;
  existing.decreaseQuantity = resolvedDec || null;
  if (adjustReason !== undefined) existing.adjustReason = adjustReason;
  if (date !== undefined) existing.date = date;

  // The stock and the record change together
  await inTransaction(async (session) => {
    if (stockDiff !== 0 || incDiff !== 0 || decDiff !== 0) {
      const change = { stock: stockDiff, plus: incDiff, minus: decDiff };
      if (existing.productId) await adjustProduct(existing.productId, change, session);
      if (existing.variantId) await adjustVariant(existing.variantId, change, session);
    }
    await existing.save({ session });
  });

  await safeBump(NS);
  await safeBump("product");

  logAudit({
    req,
    action: "UPDATE",
    entityType: "stockadjust",
    entityId: existing._id,
    entityLabel: existing.adjustReason,
    before: beforeAdjust,
    after: existing,
  });

  return apiResponse.sendSuccess(res, statusCodes.OK, "Stock adjustment updated successfully", { stockAdjust: existing });
});
