const mongoose = require("mongoose");

const PLATFORM_AUDIT_ACTIONS = [
  "PLATFORM_LOGIN",
  "PLATFORM_LOGIN_FAILED",
  // Second factor: the code was texted, and whether it was answered correctly
  "PLATFORM_LOGIN_OTP_SENT",
  "PLATFORM_LOGIN_OTP_FAILED",
  "PLATFORM_LOGOUT",
  "TENANT_CREATED",
  "TENANT_UPDATED",
  "TENANT_SUSPENDED",
  "TENANT_ACTIVATED",
  "TENANT_OWNER_PASSWORD_SET",
  "TENANT_SETTINGS_UPDATED",
];

// Records what platform operators did. `changes` holds field names only —
// never values, because settings changes will include secrets.
const platformAuditLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "PlatformUser", default: null },
    actorEmail: { type: String, default: "" },
    action: { type: String, enum: PLATFORM_AUDIT_ACTIONS, required: true },
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", default: null },
    changes: [{ type: String }],
    metadata: { type: mongoose.Schema.Types.Mixed, default: undefined },
    ip: { type: String, default: "" },
    userAgent: { type: String, default: "" },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

platformAuditLogSchema.index({ tenantId: 1, createdAt: -1 });
platformAuditLogSchema.index({ actor: 1, createdAt: -1 });

module.exports =
  mongoose.models.PlatformAuditLog ||
  mongoose.model("PlatformAuditLog", platformAuditLogSchema);
module.exports.PLATFORM_AUDIT_ACTIONS = PLATFORM_AUDIT_ACTIONS;
