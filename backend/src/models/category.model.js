const mongoose = require("mongoose");
const { tenantPlugin } = require("../tenancy/tenantPlugin");
const { default: slugify } = require("slugify");
const { customError } = require("../lib/CustomError");
const { statusCodes } = require("../constant/constant");
const Counter = require("./counter.model");
const { getInvoicePrefix } = require("../integrations/config");

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

const categorySchema = new mongoose.Schema(
  {
    // Sequential, never-reused display serial — e.g. CAT-INV-01
    categorySerialId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
    },
    subcategories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Subcategory",
      },
    ],
    image: {
      type: imageSchema,
      default: () => ({}),
    },
    discount: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Discount",
    },
    sizeChart: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SizeChart",
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

// Compound index: most queries filter isActive and sort by createdAt
categorySchema.index({ isActive: 1, createdAt: -1 });
categorySchema.index({ name: 1 });

categorySchema.pre("save", function (next) {
  if (this.isModified("name")) {
    this.slug = slugify(this.name, { lower: true, strict: true });
  }
  next();
});

categorySchema.pre("save", async function (next) {
  try {
    const existing = await this.constructor.findOne({
      slug: this.slug,
      _id: { $ne: this._id },
    });
    if (existing) {
      return next(
        new customError(
          `Category "${this.name}" already exists`,
          statusCodes.BAD_REQUEST,
        ),
      );
    }
    next();
  } catch (error) {
    next(error);
  }
});

// Gives a category the next CAT-<prefix>-NN serial. Also used by the backfill
// migration for categories created before serials existed.
categorySchema.statics.assignSerial = async function (doc, session) {
  const counter = await Counter.findOneAndUpdate(
    { key: "CATEGORY_SERIAL" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, session },
  );

  const padded = String(counter.seq).padStart(2, "0");
  doc.categorySerialId = `CAT-${await getInvoicePrefix()}-${padded}`;
  await this.updateOne(
    { _id: doc._id },
    { $set: { categorySerialId: doc.categorySerialId } },
    { session },
  );
};

// Auto-generate a sequential, never-reused categorySerialId after first save
categorySchema.post("save", async function (doc, next) {
  try {
    if (doc.categorySerialId) return next();
    await doc.constructor.assignSerial(doc, doc.$session());
    next();
  } catch (error) {
    next(error);
  }
});

categorySchema.plugin(tenantPlugin);
const Category =
  mongoose.models.Category || mongoose.model("Category", categorySchema);

module.exports = Category;
