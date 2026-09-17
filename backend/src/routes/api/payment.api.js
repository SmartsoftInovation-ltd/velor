const express = require("express");
const _ = express.Router();
const paymentController = require("../../controller/payment.controller");
const { legacyRoute } = require("../../middleware/legacyRoute.middleware");

_.use(legacyRoute);

_.route("/success").post(paymentController.successPayment);
_.route("/fail").post(paymentController.failPayment);
_.route("/cancel").post(paymentController.cancelPayment);
_.route("/ipn").post(paymentController.ipnPayment);

module.exports = _;
