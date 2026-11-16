const mongoose = require("mongoose");
const { tenantPlugin } = require("../tenancy/tenantPlugin");

/**
 * The store's return policy, written in the dashboard's rich-text editor and
 * shown on the storefront's /returns page. One per store.
 */
const returnPolicySchema = new mongoose.Schema(
  {
    // Sanitized HTML (utils/richText.util.js); empty means the storefront shows its default policy
    content: { type: String, default: "" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

returnPolicySchema.plugin(tenantPlugin);
returnPolicySchema.index({ tenantId: 1 }, { unique: true });

module.exports = mongoose.models.ReturnPolicy || mongoose.model("ReturnPolicy", returnPolicySchema);
