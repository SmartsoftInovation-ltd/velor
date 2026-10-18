const crypto = require("crypto");
const mongoose = require("mongoose");

// Slugs double as the dashboard workspace id and the storefront subdomain
const RESERVED_TENANT_SLUGS = [
  "www", "app", "api", "admin", "platform", "mail", "smtp", "static", "cdn",
  "assets", "docs", "help", "support", "status", "blog", "dashboard", "login",
];

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;

const generateWebhookKey = () => crypto.randomBytes(32).toString("base64url");

const tenantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      validate: [
        {
          validator: (v) => SLUG_PATTERN.test(v),
          message: "Slug must be 3-30 characters: lowercase letters, digits and inner hyphens",
        },
        {
          validator: (v) => !RESERVED_TENANT_SLUGS.includes(v),
          message: (props) => `"${props.value}" is a reserved slug`,
        },
      ],
    },
    status: {
      type: String,
      enum: ["provisioning", "active", "suspended", "cancelled"],
      default: "provisioning",
    },
    // Why the status last changed (e.g. suspension reason); cleared on activation
    statusReason: { type: String, default: "", trim: true },
    statusChangedAt: { type: Date, default: null },
    ownerUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    plan: { type: String, default: "standard", trim: true },
    limits: {
      maxStaff: { type: Number, default: null, min: 0 },
    },
    // What the platform sells this store for. price is per cycle; renewsAt is
    // when the next payment is due (null for a one-time sale). Feeds the
    // Platform Console dashboard.
    billing: {
      price: { type: Number, default: 0, min: 0 },
      cycle: { type: String, enum: ["monthly", "yearly", "one-time"], default: "monthly" },
      startedAt: { type: Date, default: null },
      renewsAt: { type: Date, default: null },
    },
    // Identifies the tenant in webhook/callback URLs; the provider secret proves the caller
    webhookKey: {
      type: String,
      unique: true,
      immutable: true,
      default: generateWebhookKey,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "PlatformUser", default: null },
  },
  { timestamps: true },
);

module.exports =
  mongoose.models.Tenant || mongoose.model("Tenant", tenantSchema);
module.exports.RESERVED_TENANT_SLUGS = RESERVED_TENANT_SLUGS;
