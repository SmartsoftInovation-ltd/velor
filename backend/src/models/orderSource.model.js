const mongoose = require("mongoose");
const { tenantPlugin } = require("../tenancy/tenantPlugin");
const { customError } = require("../lib/CustomError");
const { statusCodes } = require("../constant/constant");

/**
 * Where an order came from, as the shop describes it: Messenger, WhatsApp, Imo,
 * Instagram, over the phone, and whatever channel the shop starts selling on
 * next. Every shop names these differently, so the list is data rather than an
 * enum — staff add to it from the order screen.
 *
 * This is not the same thing as `Order.channel`. `channel` says which software
 * wrote the order (storefront or dashboard) and reports rely on it; this says
 * which conversation the customer came through.
 */
// The storefront's own source. Orders taken on the site are stamped with it so
// "where did this order come from" has one answer for every order, and it is
// seeded (and protected from deletion) rather than typed by hand each time.
const WEBSITE_SOURCE = "Website";

const orderSourceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// Two "WhatsApp" rows would split the same channel across two report lines.
orderSourceSchema.pre("save", async function (next) {
  if (!this.isModified("name")) return next();
  try {
    const existing = await this.constructor.findOne({
      _id: { $ne: this._id },
      name: new RegExp(`^${this.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
    });
    if (existing) {
      return next(new customError(`"${this.name}" already exists`, statusCodes.BAD_REQUEST));
    }
    return next();
  } catch (error) {
    return next(error);
  }
});

orderSourceSchema.plugin(tenantPlugin);

const OrderSource = mongoose.models.OrderSource || mongoose.model("OrderSource", orderSourceSchema);

module.exports = OrderSource;
module.exports.WEBSITE_SOURCE = WEBSITE_SOURCE;
