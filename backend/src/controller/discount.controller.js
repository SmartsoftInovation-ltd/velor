const { apiResponse } = require("../utils/apiResponse");
const { customError } = require("../lib/CustomError");
const { asynchandeler } = require("../lib/asyncHandeler");

const Discount = require("../models/discount.model");
const {
  validateDiscount,
  validateDiscountUpdate,
} = require("../validation/discount.validation");
const { statusCodes } = require("../constant/constant");
const {
  getCache,
  setCache,
  bumpNsVersion,
  buildCacheKey,
} = require("@/utils/cache.util");
const {
  assertDiscountTarget,
  clearDiscountEverywhere,
  applyDiscountByPlan,
} = require("../service/discountAssignment.service");

const NS = "discount";
const CACHE_TTL = 60 * 60; // 1 hour
const CACHE_TTL_LIST = 60 * 30; // 30 mins

// @desc create a new discount
exports.createDiscount = asynchandeler(async (req, res) => {
  const value = await validateDiscount(req);
  assertDiscountTarget(value.discountPlan, value);

  // create a new discount
  const discount = new Discount(value);
  await discount.save();

  await applyDiscountByPlan(discount);

  await bumpNsVersion(NS);
  await bumpNsVersion("product");
  await bumpNsVersion("category");
  await bumpNsVersion("subcategory");

  return apiResponse.sendSuccess(
    res,
    statusCodes.CREATED || 201,
    "Discount created successfully",
    discount,
  );
});

// @desc get all discounts
// Lists only show each reference's name, so skip the full product/variant docs.
const LIST_POPULATE = [
  { path: "category", select: "name slug" },
  { path: "subCategory", select: "name slug" },
  { path: "product", select: "name slug" },
  { path: "variant", select: "variantName slug" },
];

exports.getAllDiscounts = asynchandeler(async (req, res) => {
  const cacheKey = await buildCacheKey(NS, "all");
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Discounts fetched successfully",
      cached,
    );
  }

  const discounts = await Discount.find()
    .populate(LIST_POPULATE)
    .sort({ createdAt: -1 })
    .lean();

  // An empty list is a normal state, not an error: a 404 here made the
  // dashboard retry and hold the skeleton for seconds.
  await setCache(cacheKey, discounts, CACHE_TTL_LIST);

  return apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Discounts fetched successfully",
    discounts,
  );
});

// @desc search discount with the help of slug
exports.getDiscountBySlug = asynchandeler(async (req, res) => {
  const slug = req.params.slug;
  const cacheKey = await buildCacheKey(NS, `slug:${slug}`);
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Discount fetched successfully",
      cached,
    );
  }

  const discount = await Discount.findOne({ slug })
    .populate("category subCategory product variant")
    .lean();

  if (!discount) {
    throw new customError("Discount not found", statusCodes.NOT_FOUND);
  }

  await setCache(cacheKey, discount, CACHE_TTL);

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Discount fetched successfully",
    discount,
  );
});

// @desc update a discount by slug
exports.updateDiscount = asynchandeler(async (req, res) => {
  const { slug } = req.params;
  const updates = await validateDiscountUpdate(req);

  // Find the discount by slug
  const discount = await Discount.findOne({ slug });
  if (!discount) {
    throw new customError("Discount not found", statusCodes.NOT_FOUND);
  }

  // Update only the fields provided in the request body
  Object.keys(updates).forEach((key) => {
    discount[key] = updates[key];
  });

  assertDiscountTarget(discount.discountPlan, discount);

  // Save first — if validation/save fails, nothing else has been touched yet.
  await discount.save();

  // Wipe every existing reference to this discount (regardless of its
  // previous plan/target), then re-apply it against the current plan/target.
  // Clearing unconditionally — rather than only when the plan/target looks
  // changed — avoids missing a stale reference when only some target fields
  // are updated.
  await clearDiscountEverywhere(discount._id);
  await applyDiscountByPlan(discount);

  await bumpNsVersion(NS);
  await bumpNsVersion("product");
  await bumpNsVersion("category");
  await bumpNsVersion("subcategory");

  // Send success response
  return apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Discount updated successfully",
    discount,
  );
});

// @desc deactivate a discount by slug
exports.deactivateDiscount = asynchandeler(async (req, res) => {
  const { slug } = req.query;

  // Find the discount by slug
  const discount = await Discount.findOne({ slug, isActive: true });
  if (!discount) {
    throw new customError("Discount not found", statusCodes.NOT_FOUND);
  }

  // Deactivate the discount
  discount.isActive = false;
  await discount.save();

  await bumpNsVersion(NS);
  await bumpNsVersion("product");
  await bumpNsVersion("category");
  await bumpNsVersion("subcategory");

  // Send success response
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Discount deactivated successfully",
    discount,
  );
});

//@desc pagination form discount
exports.getDiscountPagination = asynchandeler(async (req, res) => {
  const { limit, page } = req.query;
  const skip = (page - 1) * limit;

  const cacheKey = await buildCacheKey(NS, `page:${page}:limit:${limit}`);
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Discounts fetched successfully",
      { ...cached, fromCache: true },
    );
  }

  const discounts = await Discount.find()
    .skip(skip)
    .limit(limit)
    .sort({ createdAt: -1 })
    .populate(LIST_POPULATE)
    .lean();

  const total = await Discount.countDocuments();
  const totalPages = Math.ceil(total / limit);

  const result = {
    discounts,
    page: parseInt(page),
    limit: parseInt(limit),
    total: parseInt(total),
    totalPages: parseInt(totalPages),
  };

  await setCache(cacheKey, result, CACHE_TTL_LIST);

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Discounts fetched successfully",
    result,
  );
});

// @desc active discount  by slug
exports.activateDiscount = asynchandeler(async (req, res) => {
  const { slug } = req.query;

  // Find the discount by slug
  const discount = await Discount.findOne({ slug, isActive: false });
  if (!discount) {
    throw new customError("Discount not found", statusCodes.NOT_FOUND);
  }

  // Activate the discount
  discount.isActive = true;
  await discount.save();

  await bumpNsVersion(NS);
  await bumpNsVersion("product");
  await bumpNsVersion("category");
  await bumpNsVersion("subcategory");

  // Send success response
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Discount activated successfully",
    discount,
  );
});

// @desc  permanent delte the discount
exports.deleteDiscount = asynchandeler(async (req, res) => {
  const { slug } = req.params;

  const discount = await Discount.findOne({ slug });
  if (!discount) {
    throw new customError("Discount not found", statusCodes.NOT_FOUND);
  }

  // Remove this discount's reference from every product/variant/category/subcategory
  await clearDiscountEverywhere(discount._id);

  // Now delete the discount document
  await Discount.findByIdAndDelete(discount._id);

  await bumpNsVersion(NS);
  await bumpNsVersion("product");
  await bumpNsVersion("category");
  await bumpNsVersion("subcategory");

  // Send success response
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Discount deleted successfully",
    discount,
  );
});
