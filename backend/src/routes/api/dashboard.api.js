const express = require("express");
const _ = express.Router();
const dashboardController = require("../../controller/dashboard.controller");
const { authGuard } = require("../../middleware/authMiddleware");
const { authorize } = require("../../middleware/checkPermission.middleware");
const { dashboardLimiter } = require("../../middleware/rateLimit.middleware");

// Every route below is an aggregation batch over the whole store, so they share
// a tighter per-user limit than the global one. It sits after authGuard on each
// route, so it counts the signed-in user rather than a shared office IP.
_.route("/overview").get(
  authGuard,
  dashboardLimiter,
  authorize("dashboard", "view"),
  dashboardController.getOverview,
);

_.route("/top-selling-products").get(
  authGuard,
  dashboardLimiter,
  authorize("dashboard-top-selling-products", "view"),
  dashboardController.getTopSellingProducts,
);

_.route("/invoices").get(
  authGuard,
  dashboardLimiter,
  authorize("dashboard-total-invoices", "view"),
  dashboardController.getInvoiceStats,
);

_.route("/sales-summary").get(
  authGuard,
  dashboardLimiter,
  authorize("dashboard-total-sale", "view"),
  dashboardController.getSalesSummary,
);

_.route("/transaction-summary").get(
  authGuard,
  dashboardLimiter,
  authorize("dashboard-total-transaction", "view"),
  dashboardController.getTransactionSummary,
);

_.route("/inventory-summary").get(
  authGuard,
  dashboardLimiter,
  authorize("dashboard-inventory-items", "view"),
  dashboardController.getInventorySummary,
);

_.route("/customer-summary").get(
  authGuard,
  dashboardLimiter,
  authorize("dashboard-customer", "view"),
  dashboardController.getCustomerSummary,
);

_.route("/supplier-summary").get(
  authGuard,
  dashboardLimiter,
  authorize("dashboard-supplier", "view"),
  dashboardController.getSupplierSummary,
);

_.route("/employee-summary").get(
  authGuard,
  dashboardLimiter,
  authorize("dashboard-employee", "view"),
  dashboardController.getEmployeeSummary,
);

_.route("/purchase-summary").get(
  authGuard,
  dashboardLimiter,
  authorize("dashboard-purchase-items", "view"),
  dashboardController.getPurchaseSummary,
);

_.route("/sold-items-summary").get(
  authGuard,
  dashboardLimiter,
  authorize("dashboard-sold-items", "view"),
  dashboardController.getSoldItemsSummary,
);

_.route("/inventory-value-summary").get(
  authGuard,
  dashboardLimiter,
  authorize("dashboard-inventory-value", "view"),
  dashboardController.getInventoryValueSummary,
);

_.route("/stock-cost-summary").get(
  authGuard,
  dashboardLimiter,
  authorize("dashboard-stock-cost-value", "view"),
  dashboardController.getStockCostSummary,
);

_.route("/product-status-summary").get(
  authGuard,
  dashboardLimiter,
  authorize("dashboard-total-products", "view"),
  dashboardController.getProductStatusSummary,
);

_.route("/supplier-payment-summary").get(
  authGuard,
  dashboardLimiter,
  authorize("dashboard-supplier-payment", "view"),
  dashboardController.getSupplierPaymentSummary,
);

_.route("/customer-due-payment-summary").get(
  authGuard,
  dashboardLimiter,
  authorize("dashboard-customer-due-payment", "view"),
  dashboardController.getCustomerDuePaymentSummary,
);

_.route("/inflow-transaction-summary").get(
  authGuard,
  dashboardLimiter,
  authorize("dashboard-inflow-transactions", "view"),
  dashboardController.getInflowTransactionSummary,
);

_.route("/outflow-transaction-summary").get(
  authGuard,
  dashboardLimiter,
  authorize("dashboard-outflow-transactions", "view"),
  dashboardController.getOutflowTransactionSummary,
);

_.route("/day-cash-summary").get(
  authGuard,
  dashboardLimiter,
  authorize("dashboard-day-cash-summary", "view"),
  dashboardController.getDayCashSummary,
);

_.route("/accounts-balance-summary").get(
  authGuard,
  dashboardLimiter,
  authorize("dashboard-accounts-balance", "view"),
  dashboardController.getAccountsBalanceSummary,
);

module.exports = _;
