const { customError } = require("../lib/CustomError");
const { asynchandeler } = require("../lib/asyncHandeler");
const { apiResponse } = require("../utils/apiResponse");
const { validatePayment } = require("../integrations/sslcommerz");
const Order = require("../models/order.model");
const { statusCodes } = require("../constant/constant");
const { paymentReturnUrl } = require("../service/storefrontUrl.service");

/**
 * Sends the shopper back to the shop they bought from.
 *
 * The gateway returns the customer's browser to this API, so these three
 * callbacks are page loads, not API calls. Answering them with JSON leaves the
 * shopper looking at raw text; they belong back on the storefront.
 *
 * Which storefront is decided per tenant — the order's own store — because one
 * configured URL would send every seller's customers to the same shop. When no
 * storefront is known the JSON answer is kept, so an API client or a store with
 * no domain registered yet still gets a usable response.
 */
const finish = async (res, result, invoiceId, payload, message) => {
  const target = await paymentReturnUrl(result, invoiceId);
  if (target) return res.redirect(303, target);
  return apiResponse.sendSuccess(res, statusCodes.OK, message, payload);
};

// @desc success payment
exports.successPayment = asynchandeler(async (req, res) => {
  const invoiceId = req.body?.tran_id;
  return finish(res, "success", invoiceId, req.body, "Payment successful");
});

// @desc fail payment
exports.failPayment = asynchandeler(async (req, res) => {
  const { tran_id } = req.body;
  if (!tran_id) {
    throw new customError("Transaction ID missing", statusCodes.BAD_REQUEST);
  }

  // Update order payment status
  const updatedOrder = await Order.findOneAndUpdate(
    { invoiceId: tran_id },
    {
      paymentStatus: "failed",
      orderStatus: "failed",
      paymentGatewayData: req.body,
    },
    { new: true },
  );

  if (!updatedOrder) {
    throw new customError(
      "Order not found for this transaction",
      statusCodes.NOT_FOUND,
    );
  }

  return finish(res, "failed", tran_id, updatedOrder, "Payment failed. Order status updated.");
});

// @desc cancel payment
exports.cancelPayment = asynchandeler(async (req, res) => {
  const { tran_id } = req.body;
  if (!tran_id) {
    throw new customError("Transaction ID missing", statusCodes.BAD_REQUEST);
  }

  // Update order payment status
  const updatedOrder = await Order.findOneAndUpdate(
    { invoiceId: tran_id },
    {
      paymentStatus: "cancelled",
      orderStatus: "cancelled",
      paymentGatewayData: req.body,
    },
    { new: true },
  );

  if (!updatedOrder) {
    throw new customError(
      "Order not found for this transaction",
      statusCodes.NOT_FOUND,
    );
  }

  return finish(res, "cancelled", tran_id, updatedOrder, "Payment cancelled. Order status updated.");
});

// @desc ipn payment
exports.ipnPayment = asynchandeler(async (req, res) => {
  const { val_id } = req.body;
  if (!val_id) {
    throw new customError("Validation ID missing", statusCodes.BAD_REQUEST);
  }

  // Validate with the current tenant's store credentials
  const validationResponse = await validatePayment(val_id);
  console.log("Validation Response:", validationResponse);

  if (
    validationResponse?.status === "VALID" ||
    validationResponse?.status === "VALIDATED"
  ) {
    // Update order in DB
    const updatedOrder = await Order.findOneAndUpdate(
      { invoiceId: validationResponse.tran_id },
      {
        paymentStatus: "success",
        transactionId: validationResponse.tran_id,
        valId: validationResponse.val_id,
        paymentGatewayData: validationResponse,
        orderStatus: "confirmed",
      },
      { new: true },
    );

    if (!updatedOrder) {
      throw new customError(
        "Order not found for this transaction",
        statusCodes.NOT_FOUND,
      );
    }

    apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      updatedOrder,
      "Payment validated and order confirmed",
    );
  } else {
    throw new customError("Payment validation failed", statusCodes.BAD_REQUEST);
  }
});
