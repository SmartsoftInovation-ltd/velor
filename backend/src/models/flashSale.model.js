const mongoose = require("mongoose");
const { tenantPlugin } = require("../tenancy/tenantPlugin");

/**
 * A time-boxed sale: between `startsAt` and `endsAt` every listed product (or
 * single variant) sells at its `salePrice`. Checkout charges that price
 * (shopOrder.controller), and the storefront shows it beside the retail price.
 * Sales of one store may not overlap, so an item never has two sale prices.
 */
const itemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    // Empty: the whole product, every variant at this price
    variant: { type: mongoose.Schema.Types.ObjectId, ref: "Variant", default: null },
    salePrice: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const flashSaleSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 80 },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
    items: { type: [itemSchema], default: [] },
  },
  { timestamps: true },
);

flashSaleSchema.index({ startsAt: 1, endsAt: 1 });

flashSaleSchema.plugin(tenantPlugin);

module.exports = mongoose.models.FlashSale || mongoose.model("FlashSale", flashSaleSchema);
