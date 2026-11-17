const mongoose = require("mongoose");
const { tenantPlugin } = require("../tenancy/tenantPlugin");

/**
 * A message a shopper sent from the storefront's Contact page. Staff read it
 * in the dashboard's Contact Messages list and mark it read.
 */
const contactMessageSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    subject: { type: String, trim: true, maxlength: 150, default: "" },
    message: { type: String, required: true, trim: true, maxlength: 500 },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true },
);

contactMessageSchema.index({ isRead: 1, createdAt: -1 });

contactMessageSchema.plugin(tenantPlugin);
module.exports = mongoose.models.ContactMessage || mongoose.model("ContactMessage", contactMessageSchema);
