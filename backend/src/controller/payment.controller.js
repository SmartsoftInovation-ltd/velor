const { customError } = require("../lib/CustomError");
const { asynchandeler } = require("../lib/asyncHandeler");
const { apiResponse } = require("../utils/apiResponse");
const Order = require("../models/order.model");
const { statusCodes } = require("../constant/constant");
const { paymentReturnUrl } = require("../service/storefrontUrl.service");
const { settlePayment, reconcilePayment } = require("../service/onlinePayment.service");

/**
 * SSLCommerz callbacks. Reached through /hooks/sslcommerz/:webhookKey/*, which
 * opens the store's tenant context, so every lookup here is that store's only.
 *
 * success / fail / cancel are the shopper's browser coming back from the
 * gateway. Their bodies are not trusted: anybody can POST them. They name an
 * order, and the outcome is then read from the gateway itself
 * (onlinePayment.service). The IPN is the gateway's own server call, but it is
 * validated the same way before anything changes.
 */

// The browser is sent back to its own store with the outcome the server
// established, not the one the URL claimed
const finish = async (res, result, invoiceId, payload, message) => {
  // Back to the very site the order was placed on (checked against the store's domains)
  const order = invoiceId ? await Order.findOne({ invoiceId }).select("storefrontHost").lean() : null;
  const target = await paymentReturnUrl(result, invoiceId, order?.storefrontHost ?? null);
  if (target) return res.redirect(303, target);
  return apiResponse.sendSuccess(res, statusCodes.OK, message, payload);
};

const findOnlineOrder = (tranId) =>
  typeof tranId === "string" && tranId
    ? Order.findOne({ invoiceId: tranId, paymentMethod: "sslcommerz" })
    : null;

// Works out what really happened to the order the request names
const outcomeFor = async ({ val_id: valId, tran_id: tranId }, unpaidAs) => {
  if (typeof valId === "string" && valId) {
    const { result, order } = await settlePayment(valId);
    if (result === "success" || result === "review") return { result, invoiceId: order.invoiceId };
  }

  const order = await findOnlineOrder(tranId);
  if (!order) return { result: unpaidAs, invoiceId: null };
  return { result: await reconcilePayment(order, unpaidAs), invoiceId: order.invoiceId };
};

// The storefront knows success, failed, cancelled and pending; a payment held
// for review reads as pending to the shopper
const shownAs = (result) => (result === "review" ? "pending" : result);

// @desc shopper returns after paying
exports.successPayment = asynchandeler(async (req, res) => {
  const { result, invoiceId } = await outcomeFor(req.body ?? {}, "failed");
  return finish(res, shownAs(result), invoiceId ?? req.body?.tran_id, { result, invoiceId }, "Payment result");
});

// @desc shopper returns after a failed payment
exports.failPayment = asynchandeler(async (req, res) => {
  if (!req.body?.tran_id) throw new customError("Transaction ID missing", statusCodes.BAD_REQUEST);
  const { result, invoiceId } = await outcomeFor({ tran_id: req.body.tran_id }, "failed");
  if (!invoiceId) throw new customError("Order not found for this transaction", statusCodes.NOT_FOUND);
  return finish(res, shownAs(result), invoiceId ?? req.body.tran_id, { result, invoiceId }, "Payment result");
});

// @desc shopper cancelled on the gateway page
exports.cancelPayment = asynchandeler(async (req, res) => {
  if (!req.body?.tran_id) throw new customError("Transaction ID missing", statusCodes.BAD_REQUEST);
  const { result, invoiceId } = await outcomeFor({ tran_id: req.body.tran_id }, "cancelled");
  if (!invoiceId) throw new customError("Order not found for this transaction", statusCodes.NOT_FOUND);
  return finish(res, shownAs(result), invoiceId ?? req.body.tran_id, { result, invoiceId }, "Payment result");
});

// @desc IPN: the gateway's server-to-server notice, for every outcome
exports.ipnPayment = asynchandeler(async (req, res) => {
  const { val_id: valId, tran_id: tranId } = req.body ?? {};
  if (!valId && !tranId) throw new customError("Validation ID missing", statusCodes.BAD_REQUEST);

  const { result, invoiceId } = await outcomeFor({ val_id: valId, tran_id: tranId }, "failed");
  // Neither a validated payment nor an order of this store: nothing to record
  if (!invoiceId) throw new customError("Payment validation failed", statusCodes.BAD_REQUEST);
  // A gateway error above throws (500), so SSLCommerz retries the IPN later
  return apiResponse.sendSuccess(res, statusCodes.OK, "IPN received", { result, invoiceId });
});
