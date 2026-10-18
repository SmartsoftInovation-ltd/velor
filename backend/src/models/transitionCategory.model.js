const mongoose = require("mongoose");
const { tenantPlugin } = require("../tenancy/tenantPlugin");
const { default: slugify } = require("slugify");
const { customError } = require("../lib/CustomError");
const { statusCodes } = require("../constant/constant");

const transitionCategorySchema = new mongoose.Schema(
  {
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
    isActive: {
      type: Boolean,
      default: true,
    },
    // locks this category to one transaction type — "cash recived" (+) or "cash payment" (-)
    allowedType: {
      type: String,
      enum: ["cash recived", "cash payment"],
      required: true,
    },
    // Set on the categories the app books its own payments under (see
    // utils/systemCategory.util.js). Hidden from the category list and the
    // Add Transaction dropdown, and closed to edit and delete.
    isSystem: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

// make a slug using name
transitionCategorySchema.pre("save", function (next) {
  if (this.isModified("name")) {
    this.slug = slugify(this.name, { lower: true, strict: true });
  }
  next();
});

// check this slug already exist or not
transitionCategorySchema.pre("save", async function (next) {
  try {
    const existingTransitionCategory = await this.constructor.findOne({
      slug: this.slug,
    });
    if (
      existingTransitionCategory &&
      existingTransitionCategory._id &&
      existingTransitionCategory._id.toString() !== this._id.toString()
    ) {
      return next(
        new customError(
          `${this.name} already exists Try another`,
          statusCodes.BAD_REQUEST,
        ),
      );
    }
    next();
  } catch (error) {
    next(error);
  }
});

// when update then make a slug using name
transitionCategorySchema.pre("findOneAndUpdate", async function (next) {
  const update = this.getUpdate();
  if (update.name) {
    update.slug = slugify(update.name, { lower: true, strict: true });
  }
  next();
});

transitionCategorySchema.plugin(tenantPlugin);
module.exports =
  mongoose.models.TransitionCategory ||
  mongoose.model("TransitionCategory", transitionCategorySchema);
