const Merchant = require("../models/marchant.model");
const settings = require("../settings/settings.service");

// Copies the single-tenant .env configuration and courier Merchant documents
// into the tenant's settings. Sections the tenant already has are left alone.

const present = (...values) => values.every((v) => v !== undefined && v !== null && v !== "");

const sectionPatches = async (env) => {
  const pathao = await Merchant.collection.findOne({ serviceProvider: "pathao" });
  const steadfast = await Merchant.collection.findOne({ serviceProvider: "steadfast" });
  const prefix = (env.INVOICE_PREFIX || "").toUpperCase();

  const general = {};
  if (/^[A-Z0-9]{2,8}$/.test(prefix)) general.invoicePrefix = prefix;
  if (/^(\+8801|01)\d{9}$/.test(env.ORDER_HOT_LINE_NUMBER || "")) general.orderHotline = env.ORDER_HOT_LINE_NUMBER;
  if (/^https?:\/\//.test(env.FACEBOOK_URL || "")) general.facebookUrl = env.FACEBOOK_URL;
  if (/^https?:\/\//.test(env.FRONTEND_URL || "")) general.storefrontUrl = env.FRONTEND_URL;

  return {
    general,
    sms: present(env.BULK_SMS_URL, env.BULK_SMS_API_KEY, env.BULK_SMS_SENDER_ID)
      ? { enabled: true, apiUrl: env.BULK_SMS_URL, apiKey: env.BULK_SMS_API_KEY, senderId: env.BULK_SMS_SENDER_ID }
      : null,
    // The legacy .env mailbox was a Gmail account, imported as this store's own
    // SMTP sender — every store sends its own email.
    email: present(env.HOST_MAIL, env.HOST_APP_PASSWORD)
      ? {
          mode: "smtp",
          smtpHost: "smtp.gmail.com",
          smtpPort: 587,
          smtpSecure: false,
          smtpUser: env.HOST_MAIL,
          smtpPassword: env.HOST_APP_PASSWORD,
          fromEmail: env.HOST_MAIL,
          ...(env.MAIL_FROM_NAME ? { fromName: env.MAIL_FROM_NAME } : {}),
        }
      : null,
    sslcommerz: present(env.SSLC_STORE_ID, env.SSLC_STORE_PASSWORD)
      ? { enabled: true, storeId: env.SSLC_STORE_ID, storePassword: env.SSLC_STORE_PASSWORD, isLive: env.NODE_ENV === "production" }
      : null,
    // Legacy Pathao data has no merchant login (username/password): imported disabled
    pathao: pathao
      ? {
          baseUrl: pathao.baseURL,
          clientId: pathao.merchantID,
          clientSecret: pathao.merchantSecret,
          ...(pathao.store_id ? { storeId: String(pathao.store_id) } : {}),
          ...(env.WEBHOOK_SECRET || pathao.webhookSecret ? { webhookSecret: env.WEBHOOK_SECRET || pathao.webhookSecret } : {}),
        }
      : null,
    steadfast: steadfast
      ? {
          enabled: present(steadfast.baseURL, steadfast.merchantID, steadfast.merchantSecret),
          baseUrl: steadfast.baseURL,
          apiKey: steadfast.merchantID,
          secretKey: steadfast.merchantSecret,
          ...(env.STEADFAST_API_KEY || steadfast.webhookSecret ? { webhookToken: env.STEADFAST_API_KEY || steadfast.webhookSecret } : {}),
        }
      : null,
    cloudinary: present(env.CLOUD_NAME, env.CLOUDINARY_API_KEY, env.CLOUDINARY_API_SECRET)
      ? { enabled: true, cloudName: env.CLOUD_NAME, apiKey: env.CLOUDINARY_API_KEY, apiSecret: env.CLOUDINARY_API_SECRET }
      : null,
  };
};

module.exports = {
  name: "001-import-env-settings",
  async up({ tenant, env = process.env }) {
    const TenantSettings = require("../models/platform/tenantSettings.model");
    const existing = (await TenantSettings.findOne({ tenantId: tenant._id }).lean())?.data || {};
    const imported = [];
    const skipped = [];

    for (const [section, patch] of Object.entries(await sectionPatches(env))) {
      if (!patch || !Object.keys(patch).length) {
        skipped.push({ section, reason: "nothing to import" });
      } else if (existing[section]) {
        skipped.push({ section, reason: "already configured" });
      } else {
        try {
          await settings.updateSection(tenant._id, section, patch);
          imported.push(section);
        } catch (error) {
          skipped.push({ section, reason: error.message });
        }
      }
    }

    return { imported, skipped };
  },
};
