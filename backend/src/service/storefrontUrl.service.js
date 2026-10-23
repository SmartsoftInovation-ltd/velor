const TenantDomain = require("../models/platform/tenantDomain.model");
const { getSettings } = require("../settings/settings.service");
const { getTenantId } = require("../tenancy/context");

/**
 * Where to send a shopper back to after an off-site payment.
 *
 * The payment gateway returns the customer to the API, not to the shop, so the
 * API has to redirect onward. It must pick the store the order belongs to: a
 * single configured `FRONTEND_URL` would land every seller's customers on
 * whichever shop happened to be in the environment file.
 *
 * Preference order:
 *   1. the tenant's primary verified domain — the address the shopper is on
 *   2. `general.storefrontUrl` from that tenant's settings, for a store whose
 *      domain is not registered here yet
 *   3. nothing, and the caller answers with JSON instead of redirecting
 */
const storefrontOrigin = async () => {
  const tenantId = getTenantId();
  if (!tenantId) return null;

  // Local development: the storefront runs on localhost, not on the store's
  // domain. Ignored in production, where it would send every store's
  // shoppers to one address.
  const devOrigin = process.env.PAYMENT_RETURN_ORIGIN?.trim();
  if (devOrigin && process.env.NODE_ENV !== "production") return devOrigin.replace(/\/+$/, "");

  const primary = await TenantDomain.findOne({ tenantId, isPrimary: true, status: "active" })
    .select("host")
    .lean();
  if (primary?.host) return `https://${primary.host}`;

  // Any verified domain is still that store's own address
  const anyActive = await TenantDomain.findOne({ tenantId, status: "active" }).select("host").lean();
  if (anyActive?.host) return `https://${anyActive.host}`;

  try {
    const settings = await getSettings();
    const configured = settings?.general?.storefrontUrl?.trim();
    if (configured) return configured.replace(/\/+$/, "");
  } catch {
    // A store with no settings row is not an error here; fall through to null
  }

  return null;
};

/**
 * Builds the URL a shopper returns to, carrying the invoice so the shop can
 * show them their order.
 */
const paymentReturnUrl = async (result, invoiceId) => {
  const origin = await storefrontOrigin();
  if (!origin) return null;

  const url = new URL(`${origin}/checkout/${result}`);
  if (invoiceId) url.searchParams.set("invoice", invoiceId);
  return url.toString();
};

module.exports = { storefrontOrigin, paymentReturnUrl };
