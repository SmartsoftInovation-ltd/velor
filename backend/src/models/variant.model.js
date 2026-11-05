const { statusCodes } = require("../constant/constant");
const mongoose = require("mongoose");
const { tenantPlugin } = require("../tenancy/tenantPlugin");
const { searchWordsPlugin } = require("../utils/searchWords.util");
const slugify = require("slugify");
const { customError } = require("../lib/CustomError");

// ─── Reusable subschemas ─────────────────────────────────────────────────────

const imageSchema = new mongoose.Schema(
  {
    url: { type: String, default: "" },
    publicId: { type: String, default: "" },
    // Cloudinary account the asset lives in (tenants can change accounts)
    cloudName: { type: String, default: "" },
    status: {
      type: String,
      enum: ["pending", "processing", "uploaded", "failed"],
      default: "pending",
    },
    localPath: { type: String, default: "" },
    tries: { type: Number, default: 0 },
    lastError: { type: String, default: "" },
  },
  { _id: false },
);

// SEO subdocument — search-engine + social-share metadata
const seoSchema = new mongoose.Schema(
  {
    metaTitle: { type: String, trim: true, maxlength: 70, default: "" },
    metaDescription: { type: String, trim: true, maxlength: 200, default: "" },
    metaKeywords: [{ type: String, trim: true, lowercase: true }],
    canonicalUrl: { type: String, trim: true, default: "" },
    focusKeyword: { type: String, trim: true, lowercase: true, default: "" },
    ogTitle: { type: String, trim: true, maxlength: 70, default: "" },
    ogDescription: { type: String, trim: true, maxlength: 200, default: "" },
    ogImage: { type: imageSchema, default: () => ({}) },
    twitterCard: {
      type: String,
      enum: ["summary", "summary_large_image", "app", "player"],
      default: "summary_large_image",
    },
    structuredData: { type: mongoose.Schema.Types.Mixed, default: null }, // JSON-LD
    noIndex: { type: Boolean, default: false },
    noFollow: { type: Boolean, default: false },
  },
  { _id: false },
);

const variantSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: false,
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
    },
    variantName: {
      type: String,
      required: false,
      trim: true,
    },

    // Unique per store, enforced by the database as well as by the pre-save
    // duplicate check below: two requests racing to claim the same SKU both pass
    // that check, and only a unique index stops the second write.
    // tenantPlugin turns these into { tenantId, sku } and { tenantId, barCode },
    // partial on the field so variants without one do not collide as null.
    sku: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
      match: [/^\d+$/, "SKU must contain only numbers"],
    },
    qrCode: { type: String },
    barCode: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },

    size: { type: String, trim: true, default: "N/A" },
    color: { type: String, trim: true, default: "N/A" },

    thumbnail: { type: imageSchema, default: () => ({}) },
    image: [imageSchema], // gallery

    // SEO
    seo: { type: seoSchema, default: () => ({}) },

    // Physical Attributes
    weight: { type: Number, default: 0, min: 0 },
    dimensions: {
      width: { type: Number, default: 0, min: 0 },
      height: { type: Number, default: 0, min: 0 },
      depth: { type: Number, default: 0, min: 0 },
    },

    // Quantity / stock
    stockVariant: { type: Number, min: 0, default: 0 },
    initialStock: { type: Number, min: 0, default: 0 },
    posSold: { type: Number, min: 0, default: 0 },
    webSold: { type: Number, min: 0, default: 0 },
    purchaseReturnStock: { type: Number, min: 0, default: 0 },
    salesReturnStock: { type: Number, min: 0, default: 0 },
    purchaseQuantityStock: { type: Number, min: 0, default: 0 },
    stockAdjustmentPlus: {
      type: Number,
      default: 0,
    },
    stockAdjustmentMinus: {
      type: Number,
      default: 0,
    },
    alertVariantStock: { type: Number, min: 0, default: 0 },

    // Pricing
    purchasePrice: { type: Number, min: 0, default: 0 },
    retailPrice: { type: Number, min: 0, default: 0 },
    wholesalePrice: { type: Number, min: 0, default: 0 },
    retailProfitMarginByPercentage: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    wholesaleProfitMarginPercentage: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    unit: {
      type: String,
      enum: ["Piece", "Kg", "Gram", "Packet", "pair", "liter", "Custom"],
    },
    groupUnit: { type: String },
    groupUnitQuantity: { type: Number },
    specifications: { type: String, default: null },
    alertQuantity: { type: Number, min: 0, default: 0 },
    stockAlert: { type: Boolean, default: false },
    instock: { type: Boolean },
    isActive: { type: Boolean, default: true, index: true },
    totalSales: { type: Number, default: 0 },

    salesReturn: [{ type: mongoose.Schema.Types.ObjectId, ref: "SalesReturn" }],
    byReturn: [{ type: mongoose.Schema.Types.ObjectId, ref: "ByReturn" }],
    courierReturn: [
      { type: mongoose.Schema.Types.ObjectId, ref: "CourierReturn" },
    ],
    discount: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Discount",
      default: null,
    },
    sizeChart: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SizeChart",
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// variant.model.js
variantSchema.index({
  variantName: "text",
  sku: "text",
  // barCode: "text",
});
// tenantPlugin prefixes each index with tenantId: every lookup runs inside one
// store, so an index that does not lead with tenantId can never serve a query.
// slug, sku and barCode need no entry here — their unique constraints already
// become { tenantId, <field> }.
variantSchema.index({ product: 1 });
variantSchema.index({ product: 1, isActive: 1 });
// Pickers page through name matches in name order, and a "contains" name
// search can read this index instead of every variant document
variantSchema.index({ variantName: 1 });
// Lists page newest first (BUG-P2-010)
variantSchema.index({ createdAt: -1, _id: -1 });

const UNIQUE_VARIANT_FIELDS = {
  variantName: "Variant name",
  sku: "SKU",
  barCode: "Barcode",
};

// calculate stock adjustment // adjustment plus
variantSchema.virtual("adjustmentMultipleVariantPlus").get(function () {
  return this.stockAdjustmentPlus || 0;
});

//calculate stock adjustment // adjustment minus
variantSchema.virtual("adjustmentMultipleVariantMinus").get(function () {
  return this.stockAdjustmentMinus || 0;
});

// get opening stock
variantSchema.virtual("openingStock").get(function () {
  return (
    this.stockVariant +
    (this.adjustmentMultipleVariantMinus || 0) -
    (this.adjustmentMultipleVariantPlus || 0)
  );
});

// get multiVariantOpening stock
variantSchema.virtual("multiVariantOpeningStock").get(function () {
  return this.stockVariant;
});

// Profit Margin Virtuals
variantSchema.virtual("retailProfitMarginAmount").get(function () {
  return (this.retailPrice || 0) - (this.purchasePrice || 0);
});

variantSchema.virtual("retailProfitMarginPercentage").get(function () {
  if (!this.purchasePrice) return 0;
  return (
    ((this.retailPrice - this.purchasePrice) / this.purchasePrice) *
    100
  ).toFixed(2);
});

variantSchema.virtual("wholesaleProfitMarginAmount").get(function () {
  return (this.wholesalePrice || 0) - (this.purchasePrice || 0);
});

variantSchema
  .virtual("calculatedWholesaleProfitMarginPercentage")
  .get(function () {
    if (!this.purchasePrice) return 0;
    return (
      ((this.wholesalePrice - this.purchasePrice) / this.purchasePrice) *
      100
    ).toFixed(2);
  });

// Consolidated pre-save hook: slugify + duplicate checks
variantSchema.pre("save", async function (next) {
  try {
    // 1. Slug generate
    if (this.isModified("variantName")) {
      this.slug = slugify(this.variantName, { lower: true, strict: true });
    }

    // 2. Duplicate checks
    const duplicateChecks = [];

    if (this.isModified("slug") && this.slug) {
      duplicateChecks.push({ slug: this.slug });
    }

    Object.keys(UNIQUE_VARIANT_FIELDS).forEach((field) => {
      if (this.isModified(field) && this[field]) {
        duplicateChecks.push({ [field]: this[field] });
      }
    });

    if (duplicateChecks.length > 0) {
      const existingVariant = await this.constructor.findOne({
        $or: duplicateChecks,
        _id: { $ne: this._id },
      });

      if (existingVariant?.slug === this.slug) {
        return next(
          new customError(
            `${this.variantName} already exists Try another`,
            400,
          ),
        );
      }

      const duplicateField = Object.keys(UNIQUE_VARIANT_FIELDS).find(
        (field) => this[field] && existingVariant?.[field] === this[field],
      );

      if (duplicateField) {
        return next(
          new customError(
            `${UNIQUE_VARIANT_FIELDS[duplicateField]} "${this[duplicateField]}" already exists`,
            400,
          ),
        );
      }
    }

    next();
  } catch (error) {
    next(error);
  }
});

// Keep slug update on findOneAndUpdate
variantSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate();
  if (update?.variantName && !update.slug) {
    update.slug = slugify(update.variantName, { lower: true, strict: true });
  }
  next();
});

// get all byReturn quantity data
variantSchema.virtual("totalByReturnQuantity").get(function () {
  return (this.byReturn || []).reduce(
    (total, item) => total + (item?.quantity || 0),
    0,
  );
});

// get all salesReturn quantity data
variantSchema.virtual("totalSalesReturnQuantity").get(function () {
  return (this.salesReturn || []).reduce(
    (total, item) => total + (item?.quantity || 0),
    0,
  );
});
// Indexed word-prefix search on the name (BUG-P2-004 / P2-011). Applied before
// tenantPlugin, which puts tenantId in front of the indexes declared so far.
variantSchema.plugin(searchWordsPlugin, { field: "variantName" });
// Scanned codes are matched exactly; every branch of the search's $or needs an index
variantSchema.index({ qrCode: 1 });

variantSchema.plugin(tenantPlugin);
module.exports =
  mongoose.models.Variant || mongoose.model("Variant", variantSchema);
