const { string } = require("joi");
const mongoose = require("mongoose");
const { tenantPlugin } = require("../tenancy/tenantPlugin");
const slugify = require("slugify");
const { customError } = require("../lib/CustomError");
const { statusCodes } = require("../constant/constant");

const roleSchema = new mongoose.Schema(
  {
    slug: { type: String, unique: true },
    name: { type: String, required: true, unique: true, default: "user" },
    isActive: { type: Boolean, default: true },
    permissions: [
      {
        permission: { type: mongoose.Schema.Types.ObjectId, ref: "Permission" },
        actions: [{ type: String }],
      },
    ],
  },
  { timestamps: true },
);

// Slugs are security-relevant: authorize() grants a blanket bypass to any role
// whose slug is exactly "superadmin", so the slug must never be attacker-
// controlled. It is always derived from `name`, never accepted from input.
const RESERVED_ROLE_SLUGS = ["superadmin"];

const deriveSlug = (name) => slugify(name, { lower: true, strict: true });

// make a slug using name
roleSchema.pre("save", function (next) {
  if (this.isModified("name")) {
    this.slug = deriveSlug(this.name);
  }
  next();
});

// `findOneAndUpdate` does not fire the "save" hook, so without this a request
// body carrying { slug: "superadmin" } was written straight to the document —
// which handed the caller the authorize() superadmin bypass on every route.
roleSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate() || {};
  const $set = update.$set || update;

  // The slug is never writable directly.
  delete $set.slug;
  if (update.$set) delete update.$set.slug;
  else delete update.slug;

  // Renaming a role re-derives its slug, so the two cannot drift apart.
  if ($set.name) {
    const nextSlug = deriveSlug($set.name);
    if (RESERVED_ROLE_SLUGS.includes(nextSlug)) {
      return next(
        new customError(
          `"${$set.name}" is a reserved role name`,
          statusCodes.FORBIDDEN,
        ),
      );
    }
    if (update.$set) update.$set.slug = nextSlug;
    else update.slug = nextSlug;
  }

  this.setUpdate(update);
  return next();
});

// A second role slugging to "superadmin" would silently mint another
// all-access role, so the reserved set may only be created by the seeder.
roleSchema.pre("save", function (next) {
  if (this.isModified("name") && RESERVED_ROLE_SLUGS.includes(this.slug)) {
    if (!this.$locals?.allowReservedSlug) {
      return next(
        new customError(
          `"${this.name}" is a reserved role name`,
          statusCodes.FORBIDDEN,
        ),
      );
    }
  }
  next();
});

// check this slug already exist or not
roleSchema.pre("save", async function (next) {
  try {
    const existingRole = await this.constructor.findOne({ slug: this.slug });
    if (existingRole && existingRole._id.toString() !== this._id.toString()) {
      return next(
        new customError(
          `Role with slug ${this.slug} or name ${this.name} already exists`,
          statusCodes.BAD_REQUEST,
        ),
      );
    }
    next();
  } catch (error) {
    next(error);
  }
});
roleSchema.plugin(tenantPlugin);
module.exports = mongoose.models.Role || mongoose.model("Role", roleSchema);
