const mongoose = require("mongoose");

// One document per tenant. `data` holds sections keyed as in settings/definitions.js;
// secret fields are stored as { value, last4, updatedAt } (settings/secret.js); older
// ones may still be encrypted until migration 010 converts them.
// Read and written only through settings/settings.service.js with an explicit tenantId.
const tenantSettingsSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true, unique: true },
    data: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
    version: { type: Number, default: 0 },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, default: null },
  },
  { timestamps: true, minimize: false },
);

module.exports =
  mongoose.models.TenantSettings || mongoose.model("TenantSettings", tenantSettingsSchema);
