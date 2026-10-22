const mongoose = require("mongoose");
const { tenantPlugin } = require("../tenancy/tenantPlugin");

/**
 * A product, or one variant of it, the seller has picked for the storefront's
 * "Limited offers" section. Without a variant the whole product is shown; with
 * one, the card shows that option's price and photo and opens on it.
 */
const limitedOfferSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    variant: { type: mongoose.Schema.Types.ObjectId, ref: "Variant", default: null },
    // Lower shows first, like banners
    priority: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// One entry per product (or per variant) in each store; tenantPlugin prefixes tenantId
limitedOfferSchema.index({ product: 1, variant: 1 }, { unique: true });

limitedOfferSchema.plugin(tenantPlugin);

module.exports = mongoose.models.LimitedOffer || mongoose.model("LimitedOffer", limitedOfferSchema);
