const express = require("express");
const paymentController = require("../../controller/payment.controller");
const courierController = require("../../controller/courier.controller");
const { resolveWebhookTenant } = require("../../middleware/webhookTenant.middleware");

// Provider callbacks, one URL set per tenant: /api/v1/hooks/<provider>/:webhookKey
const _ = express.Router();

_.post("/sslcommerz/:webhookKey/success", resolveWebhookTenant, paymentController.successPayment);
_.post("/sslcommerz/:webhookKey/fail", resolveWebhookTenant, paymentController.failPayment);
_.post("/sslcommerz/:webhookKey/cancel", resolveWebhookTenant, paymentController.cancelPayment);
_.post("/sslcommerz/:webhookKey/ipn", resolveWebhookTenant, paymentController.ipnPayment);
_.post("/pathao/:webhookKey", resolveWebhookTenant, courierController.handlePathaoHook);
_.post("/steadfast/:webhookKey", resolveWebhookTenant, courierController.handleSteadfastHook);

module.exports = _;
