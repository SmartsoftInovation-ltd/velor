// Per-tenant settings sections. One definition drives validation, storage,
// masking, feature flags and which fields a tenant owner may edit.
//
// Field types: string | uri | email | boolean | number | integer | enum | secret
// required: field must be set while the section is active (see isActive)
// ownerEditable: a tenant owner may change it from the dashboard

const SECTIONS = {
  general: {
    path: "general",
    isActive: () => true,
    fields: {
      invoicePrefix: { type: "string", pattern: /^[A-Z0-9]{2,8}$/, uppercase: true, default: "INV" },
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
      provider: { type: "enum", values: ["bulksmsbd"], default: "bulksmsbd" },
      apiUrl: { type: "uri", default: "", required: true },
      balanceUrl: { type: "uri", default: "" },
      apiKey: { type: "secret", required: true },
      senderId: { type: "string", default: "", required: true },
    },
  },
  email: {
    path: "email",
    isActive: (s) => s.mode === "smtp",
    // "platform" sends through the platform's own mailbox, which must exist
    isConfigured: (s) =>
      s.mode === "smtp" || (s.mode === "platform" && Boolean(process.env.HOST_MAIL && process.env.HOST_APP_PASSWORD)),
    fields: {
      mode: { type: "enum", values: ["platform", "smtp", "disabled"], default: "platform" },
      fromName: { type: "string", default: "" },
      fromEmail: { type: "email", default: "" },
      replyTo: { type: "email", default: "" },
      smtpHost: { type: "string", default: "", required: true },
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
  groq: {
    path: "ai/groq",
    isActive: (s) => s.enabled,
    fields: {
      enabled: { type: "boolean", default: false },
      apiKey: { type: "secret", pattern: /^gsk_/, required: true },
      model: { type: "string", default: "llama-3.3-70b-versatile" },
      temperature: { type: "number", min: 0, max: 1, default: 0.3 },
    },
  },
};

module.exports = { SECTIONS };
