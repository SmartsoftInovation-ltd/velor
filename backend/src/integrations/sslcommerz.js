const SSLCommerzPayment = require("sslcommerz-lts");
const { getSslCommerzConfig } = require("./config");

// SSLCommerz requires a customer email; guests may not provide one
const FALLBACK_CUSTOMER_EMAIL = "customer@example.com";

// The gateway takes amounts as decimal(10,2) between these bounds (BDT)
const MIN_AMOUNT = 10;
const MAX_AMOUNT = 500000;

const client = async () => {
  const config = await getSslCommerzConfig();
  return { config, sslcz: new SSLCommerzPayment(config.storeId, config.storePassword, config.isLive) };
};

/**
 * Opens a payment session on the current tenant's store.
 *
 * Returns the page to send the shopper to and the session key, which is kept on
 * the order so its outcome can be asked of the gateway later — the browser's
 * return to success/fail/cancel is never taken as proof of anything.
 */
const createPaymentSession = async (payment) => {
  const { config, sslcz } = await client();
  const response = await sslcz.init({
    currency: "BDT",
    ...payment,
    total_amount: Number(payment.total_amount).toFixed(2),
    cus_email: payment.cus_email || FALLBACK_CUSTOMER_EMAIL,
    success_url: config.callbackUrls.success,
    fail_url: config.callbackUrls.fail,
    cancel_url: config.callbackUrls.cancel,
    ipn_url: config.callbackUrls.ipn,
  });

  if (!response?.GatewayPageURL) {
    throw new Error(`SSLCommerz session failed: ${response?.failedreason || "no gateway URL"}`);
  }
  return { gatewayUrl: response.GatewayPageURL, sessionKey: response.sessionkey ?? null };
};

// Order Validation API: the authoritative answer for one val_id
const validatePayment = async (valId) => {
  const { sslcz } = await client();
  return sslcz.validate({ val_id: encodeURIComponent(valId) });
};

// Transaction query: what the gateway knows about a session, or a tran_id
const querySession = async (sessionKey) => {
  const { sslcz } = await client();
  return sslcz.transactionQueryBySessionId({ sessionkey: encodeURIComponent(sessionKey) });
};

const queryTransaction = async (tranId) => {
  const { sslcz } = await client();
  return sslcz.transactionQueryByTransactionId({ tran_id: encodeURIComponent(tranId) });
};

module.exports = {
  createPaymentSession,
  validatePayment,
  querySession,
  queryTransaction,
  MIN_AMOUNT,
  MAX_AMOUNT,
};
