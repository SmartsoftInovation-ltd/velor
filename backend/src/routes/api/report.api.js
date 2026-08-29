const express = require("express");
const _ = express.Router();
const reportController = require("../../controller/report.controller");
const { authGuard } = require("../../middleware/authMiddleware");
const { authorize } = require("../../middleware/checkPermission.middleware");

_.route("/purchase-invoice").post(
  authGuard,
  authorize("purchase-invoice", "view"),
  reportController.getPurchaseInvoiceReport,
);
_.route("/purchase-product").post(
  authGuard,
  authorize("purchase-product-report", "view"),
  reportController.getPurchaseProductReport,
);
_.route("/purchase/suppliers").get(
  authGuard,
  authorize("purchase-invoice", "view"),
  reportController.getPurchaseInvoiceSuppliers,
);
_.route("/sales-invoice").post(
  authGuard,
  authorize("sales-invoice-report", "view"),
  reportController.getSalesInvoiceReport,
);
_.route("/sales-product").post(
  authGuard,
  authorize("sales-product-report", "view"),
  reportController.getSalesProductReport,
);
_.route("/sales-summary").post(
  authGuard,
  authorize("sales-summary-report", "view"),
  reportController.getSalesSummaryReport,
);
_.route("/sales/customers").get(
  authGuard,
  authorize("sales-invoice-report", "view"),
  reportController.getSalesInvoiceCustomers,
);
_.route("/sales/salesmen").get(
  authGuard,
  authorize("sales-invoice-report", "view"),
  reportController.getSalesInvoiceSalesmen,
);

module.exports = _;
