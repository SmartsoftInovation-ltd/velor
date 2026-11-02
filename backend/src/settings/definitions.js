// Per-tenant settings sections. One definition drives validation, storage,
// masking, feature flags and which fields a tenant owner may edit.
//
// Field types: string | uri | email | boolean | number | integer | enum | secret
// required: field must be set while the section is active (see isActive)
// ownerEditable: a tenant owner may change it from the dashboard
// readOnly: shown in the forms but nobody can change it; the default applies

const SECTIONS = {
  general: {
    path: "general",
    isActive: () => true,
    fields: {
      invoicePrefix: { type: "string", pattern: /^[A-Z0-9]{2,8}$/, uppercase: true, default: "INV" },
      // The storefront's brand color; empty keeps the storefront's own default
      primaryColor: { type: "string", pattern: /^#[0-9a-fA-F]{6}$/, default: "" },
      orderHotline: { type: "string", pattern: /^(\+8801|01)\d{9}$/, default: "", ownerEditable: true },
      facebookUrl: { type: "uri", default: "", ownerEditable: true },
      storefrontUrl: { type: "uri", default: "" },
      currency: { type: "string", default: "BDT" },
      timezone: { type: "string", default: "Asia/Dhaka" },
    },
  },
  sms: {
    path: "sms",
    isActive: (s) => s.enabled,
    fields: {
      enabled: { type: "boolean", default: false },
      provider: { type: "enum", values: ["bulksmsbd"], default: "bulksmsbd", readOnly: true },
      // Every seller uses the same BulkSMSBD endpoints, so they are fixed: only
      // the account (API key, sender ID) differs from store to store.
      apiUrl: { type: "uri", default: "http://bulksmsbd.net/api/smsapi", required: true, readOnly: true },
      balanceUrl: { type: "uri", default: "http://bulksmsbd.net/api/getBalanceApi", readOnly: true },
      apiKey: { type: "secret", required: true },
      senderId: { type: "string", default: "", required: true },
    },
  },
  email: {
    path: "email",
    isActive: (s) => s.mode === "smtp",
    fields: {
      // Every store sends through its own mail server. The platform mailbox is
      // not an option: a store's email must come from the store.
      mode: { type: "enum", values: ["smtp", "disabled"], default: "smtp" },
      fromName: { type: "string", default: "" },
      fromEmail: { type: "email", default: "" },
      smtpHost: { type: "string", default: "smtp.gmail.com", required: true },
      // Free-form so an unusual provider port still works; the dashboard offers
      // 587 and 465 as the two that matter.
      smtpPort: { type: "integer", min: 1, max: 65535, default: 587 },
      smtpSecure: { type: "boolean", default: false },
      smtpUser: { type: "string", default: "", required: true },
      smtpPassword: { type: "secret", required: true },
    },
  },
  sslcommerz: {
    path: "payment/sslcommerz",
    isActive: (s) => s.enabled,
    fields: {
      enabled: { type: "boolean", default: false },
      isLive: { type: "boolean", default: false },
      storeId: { type: "string", default: "", required: true },
      storePassword: { type: "secret", required: true },
    },
  },
  pathao: {
    path: "couriers/pathao",
    isActive: (s) => s.enabled,
    fields: {
      enabled: { type: "boolean", default: false },
      baseUrl: { type: "uri", default: "", required: true },
      clientId: { type: "string", default: "", required: true },
      clientSecret: { type: "secret", required: true },
      username: { type: "string", default: "", required: true },
      password: { type: "secret", required: true },
      storeId: { type: "string", default: "", required: true },
      webhookSecret: { type: "secret" },
    },
  },
  steadfast: {
    path: "couriers/steadfast",
    isActive: (s) => s.enabled,
    fields: {
      enabled: { type: "boolean", default: false },
      baseUrl: { type: "uri", default: "", required: true },
      apiKey: { type: "secret", required: true },
      secretKey: { type: "secret", required: true },
      webhookToken: { type: "secret" },
    },
  },
  cloudinary: {
    path: "cloudinary",
    isActive: (s) => s.enabled,
    fields: {
      enabled: { type: "boolean", default: false },
      cloudName: { type: "string", pattern: /^[a-z0-9_-]+$/i, default: "", required: true },
      apiKey: { type: "string", pattern: /^\d+$/, default: "", required: true },
      apiSecret: { type: "secret", required: true },
    },
  },
};

module.exports = { SECTIONS };
