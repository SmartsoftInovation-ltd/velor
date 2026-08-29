const Product = require("../models/product.model");
const Category = require("../models/category.model");
const Subcategory = require("../models/subcategory.model");
const Variant = require("../models/variant.model");
const { customError } = require("../lib/CustomError");
const { statusCodes } = require("../constant/constant");

// Every product/variant can only ever reference a single discount (the
// schema field is a scalar, not an array), so overwriting it with $set is
// always enough to enforce the "one active discount per item" rule — no
// precedence comparison against the item's previous discount is needed.

const TARGET_FIELD_BY_PLAN = {
  category: "category",
  subCategory: "subCategory",
  product: "product",
  variant: "variant",
};

// Throws if the plan requires a target id (category/subCategory/product/variant)
// that wasn't provided — prevents silently creating a discount that never
// gets attached to anything.
const assertDiscountTarget = (plan, value) => {
  if (plan === "flat") return;
  const field = TARGET_FIELD_BY_PLAN[plan];
  if (!value?.[field]) {
    throw new customError(
      `"${field}" is required when discount plan is "${plan}"`,
      statusCodes.BAD_REQUEST,
    );
  }
};

// Wipes every reference to this discount id, regardless of which plan/target
// originally created it. Used before re-applying an updated discount and
// before deleting one, so stale references never linger.
const clearDiscountEverywhere = async (discountId) => {
  await Promise.all([
    Product.updateMany({ discount: discountId }, { $set: { discount: null } }),
    Variant.updateMany({ discount: discountId }, { $set: { discount: null } }),
    Category.updateMany({ discount: discountId }, { $set: { discount: null } }),
    Subcategory.updateMany(
      { discount: discountId },
      { $set: { discount: null } },
    ),
  ]);
};

// Flat: every product AND every variant (single-variant products carry their
// own `discount` field; multi-variant products carry it on each Variant doc).
const applyFlatDiscount = async (discountId) => {
  await Promise.all([
    Product.updateMany({}, { $set: { discount: discountId } }),
    Variant.updateMany({}, { $set: { discount: discountId } }),
  ]);
};

// Category: the category itself, every subcategory under it, and every
// product (+ its variants) either directly in the category or in one of
// those subcategories.
const applyCategoryDiscount = async (discountId, categoryId) => {
  const subCategoryIds = await Subcategory.find({
    category: categoryId,
  }).distinct("_id");

  const productIds = await Product.find({
    $or: [{ category: categoryId }, { subcategory: { $in: subCategoryIds } }],
  }).distinct("_id");

  await Promise.all([
    Category.findByIdAndUpdate(categoryId, { $set: { discount: discountId } }),
    subCategoryIds.length
      ? Subcategory.updateMany(
          { _id: { $in: subCategoryIds } },
          { $set: { discount: discountId } },
        )
      : null,
    productIds.length
      ? Product.updateMany(
          { _id: { $in: productIds } },
          { $set: { discount: discountId } },
        )
      : null,
    productIds.length
      ? Variant.updateMany(
          { product: { $in: productIds } },
          { $set: { discount: discountId } },
        )
      : null,
  ]);
};

// SubCategory: the subcategory itself, and every product (+ its variants)
// under it.
const applySubCategoryDiscount = async (discountId, subCategoryId) => {
  const productIds = await Product.find({
    subcategory: subCategoryId,
  }).distinct("_id");

  await Promise.all([
    Subcategory.findByIdAndUpdate(subCategoryId, {
      $set: { discount: discountId },
    }),
    productIds.length
      ? Product.updateMany(
          { _id: { $in: productIds } },
          { $set: { discount: discountId } },
        )
      : null,
    productIds.length
      ? Variant.updateMany(
          { product: { $in: productIds } },
          { $set: { discount: discountId } },
        )
      : null,
  ]);
};

// Product: only that product, plus its own variants (if it has any).
const applyProductDiscount = async (discountId, productId) => {
  await Promise.all([
    Product.findByIdAndUpdate(productId, { $set: { discount: discountId } }),
    Variant.updateMany({ product: productId }, { $set: { discount: discountId } }),
  ]);
};

// Variant: only that single variant.
const applyVariantDiscount = async (discountId, variantId) => {
  await Variant.findByIdAndUpdate(variantId, { $set: { discount: discountId } });
};

// Applies a saved discount doc to whatever it targets, based on its plan.
const applyDiscountByPlan = async (discount) => {
  switch (discount.discountPlan) {
    case "flat":
      return applyFlatDiscount(discount._id);
    case "category":
      return discount.category
        ? applyCategoryDiscount(discount._id, discount.category)
        : null;
    case "subCategory":
      return discount.subCategory
        ? applySubCategoryDiscount(discount._id, discount.subCategory)
        : null;
    case "product":
      return discount.product
        ? applyProductDiscount(discount._id, discount.product)
        : null;
    case "variant":
      return discount.variant
        ? applyVariantDiscount(discount._id, discount.variant)
        : null;
    default:
      return null;
  }
};

module.exports = {
  assertDiscountTarget,
  clearDiscountEverywhere,
  applyDiscountByPlan,
};
