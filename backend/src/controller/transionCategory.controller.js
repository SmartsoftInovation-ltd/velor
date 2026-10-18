const { customError } = require("../lib/CustomError");
const { apiResponse } = require("../utils/apiResponse");
const { asynchandeler } = require("../lib/asyncHandeler");
const TransactionCategory = require("../models/transitionCategory.model");
const { statusCodes } = require("../constant/constant");
const { default: slugify } = require("slugify");
const { SYSTEM_CATEGORY_SLUGS } = require("../utils/systemCategory.util");

const ALLOWED_TYPES = ["cash recived", "cash payment"];

// The app's own payment categories (Sales Payment, Supplier Payment, ...) are
// isSystem: they never appear in this list and cannot be edited or deleted.
// A seller category may not take one of their names either, or the payment
// flow would pick it up as its own on the next payment.
const NOT_SYSTEM = { isSystem: { $ne: true } };
const isReservedName = (name) =>
  SYSTEM_CATEGORY_SLUGS.includes(slugify(String(name), { lower: true, strict: true }));
const reservedNameError = (name) =>
  new customError(
    `"${name}" is used by the system for its own payments. Try another name`,
    statusCodes.BAD_REQUEST,
  );

// add new transaction category
exports.addTransactionCategories = asynchandeler(async (req, res) => {
  const { categories } = req.body;

  if (!Array.isArray(categories) || categories.length === 0) {
    throw new customError("Categories is required", statusCodes.BAD_REQUEST);
  }

  for (const c of categories) {
    if (!c || !c.name || !ALLOWED_TYPES.includes(c.allowedType)) {
      throw new customError(
        "Each category requires a name and a valid allowedType (cash recived or cash payment)",
        statusCodes.BAD_REQUEST,
      );
    }
    if (isReservedName(c.name)) throw reservedNameError(c.name);
  }

  const results = [];

  for (const c of categories) {
    const category = new TransactionCategory({ name: c.name, allowedType: c.allowedType });
    try {
      await category.save();
      results.push(category);
    } catch (err) {
      console.log(err.message);
    }
  }

  apiResponse.sendSuccess(res, statusCodes.OK, "Categories added", results);
});

// get all transaction category
exports.getAllTransitionCategory = asynchandeler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
  const skip = (page - 1) * limit;

  const [categories, total] = await Promise.all([
    TransactionCategory.find(NOT_SYSTEM).sort({ createdAt: -1 }).skip(skip).limit(limit),
    TransactionCategory.countDocuments(NOT_SYSTEM),
  ]);

  if (!categories.length && page === 1) {
    return apiResponse.sendSuccess(res, statusCodes.OK, "Categories not found", {
      categories: [],
      total: 0,
      page,
      limit,
      hasNextPage: false,
    });
  }

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Categories fetched successfully",
    { categories, total, page, limit, hasNextPage: page * limit < total },
  );
});

// get single transaction category
exports.getSingleTransitionCategory = asynchandeler(async (req, res) => {
  const { slug } = req.params;
  const category = await TransactionCategory.findOne({ slug });
  if (!category) {
    throw new customError("Category not found", statusCodes.NOT_FOUND);
  }
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Category fetched successfully",
    category,
  );
});

// update transaction category
exports.updateTransactionCategory = asynchandeler(async (req, res) => {
  const { slug } = req.params;
  const { name, allowedType } = req.body;

  if (allowedType && !ALLOWED_TYPES.includes(allowedType)) {
    throw new customError(
      "allowedType must be cash recived or cash payment",
      statusCodes.BAD_REQUEST,
    );
  }

  if (name && isReservedName(name)) throw reservedNameError(name);

  const update = { name };
  if (allowedType) update.allowedType = allowedType;

  const category = await TransactionCategory.findOneAndUpdate(
    { slug, ...NOT_SYSTEM },
    update,
    { new: true },
  );
  if (!category) {
    throw new customError("Category not found", statusCodes.NOT_FOUND);
  }
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Category updated successfully",
    category,
  );
});

// delte transaction category
exports.deleteTransactionCategory = asynchandeler(async (req, res) => {
  const { slug } = req.params;
  const category = await TransactionCategory.findOneAndDelete({ slug, ...NOT_SYSTEM });
  if (!category) {
    throw new customError("Category not found", statusCodes.NOT_FOUND);
  }
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Category deleted successfully",
    category,
  );
});
