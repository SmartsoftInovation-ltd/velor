const Tenant = require("../models/platform/tenant.model");
const { getTenantId } = require("../tenancy/context");
const settings = require("../settings/settings.service");

// Resolves third-party configuration for the current request.
// Inside a tenant context: the tenant's own settings (422 when not configured).
// Without a context (legacy single-tenant install, before migration): .env.

const tenantSettings = async () => {
  const tenantId = getTenantId();
  return tenantId ? { tenantId, values: await settings.getSettings(tenantId) } : null;
};

const requireConfigured = async (tenantId, featurePath, code, label) => {
  const features = await settings.getFeatures(tenantId);
  const configured = featurePath.split(".").reduce((obj, key) => obj?.[key], features);
  if (!configured) throw settings.featureNotConfigured(code, label);
};

const getGeneralConfig = async () => {
  const tenant = await tenantSettings();
  if (!tenant) {
    return {
      invoicePrefix: process.env.INVOICE_PREFIX || "INV",
      orderHotline: process.env.ORDER_HOT_LINE_NUMBER || "",
      facebookUrl: process.env.FACEBOOK_URL || "",
      storefrontUrl: process.env.FRONTEND_URL || "",
    };
  }
  const { invoicePrefix, orderHotline, facebookUrl, storefrontUrl } = tenant.values.general;
  return { invoicePrefix, orderHotline, facebookUrl, storefrontUrl };
};

const getInvoicePrefix = async () => (await getGeneralConfig()).invoicePrefix;

const getSmsConfig = async () => {
  const tenant = await tenantSettings();
  if (!tenant) {
    return {
      apiUrl: process.env.BULK_SMS_URL,
      apiKey: process.env.BULK_SMS_API_KEY,
      senderId: process.env.BULK_SMS_SENDER_ID,
      balanceUrl: "http://bulksmsbd.net/api/getBalanceApi",
    };
  }
  await requireConfigured(tenant.tenantId, "sms", "SMS_NOT_CONFIGURED", "SMS");
  const { apiUrl, apiKey, senderId, balanceUrl } = tenant.values.sms;
  return { apiUrl, apiKey, senderId, balanceUrl: balanceUrl || "http://bulksmsbd.net/api/getBalanceApi" };
};

const platformMailSender = () => {
  const user = process.env.HOST_MAIL;
  const pass = process.env.HOST_APP_PASSWORD;
  return user && pass ? { user, pass } : null;
};

const formatFrom = (name, address) => (name ? `${name} <${address}>` : address);

// Returns { transport, from, replyTo }, or null when legacy mail is not configured
const getMailConfig = async () => {
  const tenant = await tenantSettings();
  const sender = platformMailSender();

  if (!tenant) {
    if (!sender) return null;
    return {
      transport: { service: "gmail", auth: sender },
      from: formatFrom(process.env.MAIL_FROM_NAME, sender.user),
      replyTo: undefined,
    };
  }

  const email = tenant.values.email;
  const replyTo = email.replyTo || email.fromEmail || undefined;

  if (email.mode === "smtp") {
    await requireConfigured(tenant.tenantId, "email", "EMAIL_NOT_CONFIGURED", "Email");
    return {
      transport: {
        host: email.smtpHost,
        port: email.smtpPort,
        secure: email.smtpSecure,
        auth: { user: email.smtpUser, pass: email.smtpPassword },
      },
      from: formatFrom(email.fromName, email.fromEmail || email.smtpUser),
      replyTo,
    };
  }

  if (email.mode === "platform" && sender) {
    return {
      transport: { service: "gmail", auth: sender },
      from: formatFrom(email.fromName, sender.user),
      replyTo,
    };
  }

  throw settings.featureNotConfigured("EMAIL_NOT_CONFIGURED", "Email");
};

const getSslCommerzConfig = async () => {
  const tenant = await tenantSettings();
  if (!tenant) {
    const base = process.env.BACKEND_URL;
    return {
      storeId: process.env.SSLC_STORE_ID,
      storePassword: process.env.SSLC_STORE_PASSWORD,
      isLive: process.env.NODE_ENV === "production",
      callbackUrls: {
        success: `${base}/payment/success`,
        fail: `${base}/payment/fail`,
        cancel: `${base}/payment/cancel`,
        ipn: `${base}/payment/ipn`,
      },
    };
  }

  await requireConfigured(tenant.tenantId, "sslcommerz", "SSLCOMMERZ_NOT_CONFIGURED", "Online payment");
  const { storeId, storePassword, isLive } = tenant.values.sslcommerz;
  const record = await Tenant.findById(tenant.tenantId).select("webhookKey").lean();
  return {
    storeId,
    storePassword,
    isLive,
    callbackUrls: record ? settings.getWebhookUrls(record).sslcommerz : {},
  };
};

// Merchant-shaped config consumed by PathaoCourier / SteadFastCourier.
// Returns null without a tenant context: callers fall back to Merchant documents.
const getCourierConfig = async (provider) => {
  const tenant = await tenantSettings();
  if (!tenant) return null;

  await requireConfigured(tenant.tenantId, `couriers.${provider}`, "COURIER_NOT_CONFIGURED", `${provider} courier`);

  if (provider === "pathao") {
    const s = tenant.values.pathao;
    return {
      tenantId: tenant.tenantId,
      serviceProvider: "pathao",
      merchantID: s.clientId,
      merchantSecret: s.clientSecret,
      baseURL: s.baseUrl,
      store_id: s.storeId,
      username: s.username,
      password: s.password,
      webhookSecret: s.webhookSecret,
    };
  }

  if (provider === "steadfast") {
    const s = tenant.values.steadfast;
    return {
      tenantId: tenant.tenantId,
      serviceProvider: "steadfast",
      merchantID: s.apiKey,
      merchantSecret: s.secretKey,
      baseURL: s.baseUrl,
      webhookToken: s.webhookToken,
    };
  }

  throw new Error(`Unknown courier provider: ${provider}`);
};

const getCloudinaryConfig = async () => {
  const tenant = await tenantSettings();
  if (!tenant) {
    return {
      cloud_name: process.env.CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    };
  }
  await requireConfigured(tenant.tenantId, "cloudinary", "CLOUDINARY_NOT_CONFIGURED", "Image storage (Cloudinary)");
  const { cloudName, apiKey, apiSecret } = tenant.values.cloudinary;
  return { cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret };
};

const getGroqConfig = async () => {
  const tenant = await tenantSettings();
  if (!tenant) {
    return { apiKey: process.env.GROQ_API_KEY, model: "llama-3.3-70b-versatile", temperature: 0.3 };
  }
  await requireConfigured(tenant.tenantId, "ai", "AI_NOT_CONFIGURED", "AI assistant");
  const { apiKey, model, temperature } = tenant.values.groq;
  return { apiKey, model, temperature };
};

module.exports = {
  getGeneralConfig,
  getInvoicePrefix,
  getSmsConfig,
  getMailConfig,
  getSslCommerzConfig,
  getCourierConfig,
  getCloudinaryConfig,
  getGroqConfig,
};
