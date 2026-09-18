const crypto = require("crypto");
const mongoose = require("mongoose");

/**
 * Maps a storefront hostname to the tenant that owns it.
 *
 * This is the control plane for "which store is this request for?" on the
 * public site. The dashboard names its store with the `x-tenant` header, but a
 * shopper's browser cannot be trusted to name one — anyone can send any header.
 * The hostname, on the other hand, is fixed by DNS and TLS before the request
 * ever reaches us, so it is the only identifier a visitor cannot choose.
 *
 * A host is only honoured once `status` is "active", which happens after the
 * seller proves they control the domain (a DNS TXT record carrying
 * `verificationToken`). Without that step, adding someone else's hostname here
 * would quietly point their traffic at another tenant's catalogue.
 */

// Hosts the platform uses for itself. A tenant claiming one of these would
// shadow the API, dashboard or console for every store at once.
const RESERVED_HOST_LABELS = [
  "api", "app", "platform", "admin", "dashboard", "console",
  "www", "mail", "smtp", "cdn", "static", "assets",
];

const generateVerificationToken = () => crypto.randomBytes(24).toString("base64url");

// A hostname as it appears in a Host header: no scheme, no port, no trailing
// dot, lowercase. Unicode domains are stored punycode-encoded so that the
// bytes we compare against are the bytes a browser actually sends.
const normalizeHost = (value) => {
  if (typeof value !== "string") return value;
  let host = value.trim().toLowerCase();
  host = host.replace(/^[a-z][a-z0-9+.-]*:\/\//, ""); // strip scheme if pasted in
  host = host.replace(/\/.*$/, ""); // strip path
  host = host.replace(/:\d+$/, ""); // strip port
  host = host.replace(/\.$/, ""); // strip the root label's trailing dot
  try {
    host = new URL(`http://${host}`).hostname;
  } catch {
    return host; // leave it be; the validator below rejects it
  }
  return host;
};

// Deliberately permissive on length/TLD, strict on shape: labels of letters,
// digits and inner hyphens, at least two of them.
const HOST_PATTERN = /^(?=.{4,253}$)[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;

const tenantDomainSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    host: {
      type: String,
      required: true,
      unique: true,
      set: normalizeHost,
      validate: [
        {
          validator: (v) => HOST_PATTERN.test(v),
          message: (props) => `"${props.value}" is not a valid hostname`,
        },
        {
          // Only the first label is checked: "api.velor.com" is a tenant's own
          // subdomain and fine, but a bare "api" host is the platform's.
          validator: (v) => !RESERVED_HOST_LABELS.includes(v.split(".")[0]) || v.split(".").length > 2,
          message: (props) => `"${props.value}" is reserved by the platform`,
        },
      ],
    },
    // The canonical host, used for redirects back from payment and for links in
    // email. Exactly one per tenant, kept true by the hook below.
    isPrimary: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["pending", "verifying", "active", "failed"],
      default: "pending",
      index: true,
    },
    verificationToken: {
      type: String,
      required: true,
      immutable: true,
      default: generateVerificationToken,
    },
    verifiedAt: { type: Date, default: null },
    lastCheckedAt: { type: Date, default: null },
    // Shown to the operator so a failed check explains itself
    failureReason: { type: String, default: "", trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "PlatformUser", default: null },
  },
  { timestamps: true },
);

// Finding a tenant's canonical host is a per-request lookup on the payment path
tenantDomainSchema.index({ tenantId: 1, isPrimary: 1 });

/**
 * Keeps "primary" single-valued.
 *
 * Two primaries would make the redirect target ambiguous, and which one won
 * would depend on document order — a bug that only shows up once a seller adds
 * a second domain. Demoting the others here means callers can just set the flag.
 */
const demoteOtherPrimaries = async (model, { tenantId, _id }) => {
  await model.updateMany(
    { tenantId, isPrimary: true, ...(_id ? { _id: { $ne: _id } } : {}) },
    { $set: { isPrimary: false } },
  );
};

tenantDomainSchema.pre("save", async function ensureSinglePrimary(next) {
  if (this.isPrimary && this.isModified("isPrimary")) {
    await demoteOtherPrimaries(this.constructor, { tenantId: this.tenantId, _id: this._id });
  }
  next();
});

// This model is the map used to *find* a tenant, so it cannot itself be scoped
// to one — it is listed in tenancy/registry.js as a global model.
const TenantDomain = mongoose.model("TenantDomain", tenantDomainSchema);

module.exports = TenantDomain;
module.exports.normalizeHost = normalizeHost;
module.exports.RESERVED_HOST_LABELS = RESERVED_HOST_LABELS;
module.exports.demoteOtherPrimaries = demoteOtherPrimaries;
