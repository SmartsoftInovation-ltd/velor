const SSLCommerzPayment = require("sslcommerz-lts");
const { getSslCommerzConfig } = require("./config");

// SSLCommerz requires a customer email; guests may not provide one
const FALLBACK_CUSTOMER_EMAIL = "customer@example.com";

const client = async () => {
  const config = await getSslCommerzConfig();
  return { config, sslcz: new SSLCommerzPayment(config.storeId, config.storePassword, config.isLive) };
};

// Opens a payment session on the current tenant's store; returns the gateway URL
const createPaymentSession = async (payment) => {
  const { config, sslcz } = await client();
  const response = await sslcz.init({
    currency: "BDT",
    ...payment,
    cus_email: payment.cus_email || FALLBACK_CUSTOMER_EMAIL,
    success_url: config.callbackUrls.success,
    fail_url: config.callbackUrls.fail,
    cancel_url: config.callbackUrls.cancel,
    ipn_url: config.callbackUrls.ipn,
  });

  if (!response?.GatewayPageURL) {
    throw new Error(`SSLCommerz session failed: ${response?.failedreason || "no gateway URL"}`);
  }
  return response.GatewayPageURL;
};

const validatePayment = async (valId) => {
  const { sslcz } = await client();
  return sslcz.validate({ val_id: valId });
};

module.exports = { createPaymentSession, validatePayment };
