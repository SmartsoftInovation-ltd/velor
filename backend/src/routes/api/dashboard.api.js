const express = require("express");
const _ = express.Router();
const dashboardController = require("../../controller/dashboard.controller");
const { authGuard } = require("../../middleware/authMiddleware");
const { authorize } = require("../../middleware/checkPermission.middleware");

_.route("/overview").get(
  authGuard,
  authorize("dashboard", "view"),
  dashboardController.getOverview,
);

_.route("/invoices").get(
  authGuard,
  authorize("dashboard-total-invoices", "view"),
  dashboardController.getInvoiceStats,
);

_.route("/sales-summary").get(
  authGuard,
  authorize("dashboard-total-sale", "view"),
  dashboardController.getSalesSummary,
);

_.route("/transaction-summary").get(
  authGuard,
  authorize("dashboard-total-transaction", "view"),
  dashboardController.getTransactionSummary,
);

_.route("/inventory-summary").get(
  authGuard,
  authorize("dashboard-inventory-items", "view"),
  dashboardController.getInventorySummary,
);

_.route("/customer-summary").get(
  authGuard,
  authorize("dashboard-customer", "view"),
  dashboardController.getCustomerSummary,
);

_.route("/supplier-summary").get(
  authGuard,
  authorize("dashboard-supplier", "view"),
  dashboardController.getSupplierSummary,
);

_.route("/employee-summary").get(
  authGuard,
  authorize("dashboard-employee", "view"),
  dashboardController.getEmployeeSummary,
);

_.route("/purchase-summary").get(
  authGuard,
  authorize("dashboard-purchase-items", "view"),
  dashboardController.getPurchaseSummary,
);

_.route("/sold-items-summary").get(
  authGuard,
  authorize("dashboard-sold-items", "view"),
  dashboardController.getSoldItemsSummary,
);

_.route("/inventory-value-summary").get(
  authGuard,
  authorize("dashboard-inventory-value", "view"),
  dashboardController.getInventoryValueSummary,
);

_.route("/stock-cost-summary").get(
  authGuard,
  authorize("dashboard-stock-cost-value", "view"),
  dashboardController.getStockCostSummary,
);

_.route("/product-status-summary").get(
  authGuard,
  authorize("dashboard-total-products", "view"),
  dashboardController.getProductStatusSummary,
);

_.route("/supplier-payment-summary").get(
  authGuard,
  authorize("dashboard-supplier-payment", "view"),
  dashboardController.getSupplierPaymentSummary,
);

_.route("/customer-due-payment-summary").get(
  authGuard,
  authorize("dashboard-customer-due-payment", "view"),
  dashboardController.getCustomerDuePaymentSummary,
);

_.route("/inflow-transaction-summary").get(
  authGuard,
  authorize("dashboard-inflow-transactions", "view"),
  dashboardController.getInflowTransactionSummary,
);

_.route("/outflow-transaction-summary").get(
  authGuard,
  authorize("dashboard-outflow-transactions", "view"),
  dashboardController.getOutflowTransactionSummary,
);

_.route("/day-cash-summary").get(
  authGuard,
  authorize("dashboard-day-cash-summary", "view"),
  dashboardController.getDayCashSummary,
);

_.route("/accounts-balance-summary").get(
  authGuard,
  authorize("dashboard-accounts-balance", "view"),
  dashboardController.getAccountsBalanceSummary,
);

module.exports = _;
