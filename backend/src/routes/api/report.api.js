const express = require("express");
const _ = express.Router();
const reportController = require("../../controller/report.controller");
const { authGuard } = require("../../middleware/authMiddleware");
const { authorize } = require("../../middleware/checkPermission.middleware");
const { reportLimiter } = require("../../middleware/rateLimit.middleware");

// Every route below is an aggregation batch over the whole store, so they share
// a tighter per-user limit than the global one. It sits after authGuard on each
// route, so it counts the signed-in user rather than a shared office IP.
_.route("/purchase-invoice").post(
  authGuard,
  reportLimiter,
  authorize("purchase-invoice", "view"),
  reportController.getPurchaseInvoiceReport,
);
_.route("/purchase-product").post(
  authGuard,
  reportLimiter,
  authorize("purchase-product-report", "view"),
  reportController.getPurchaseProductReport,
);
_.route("/purchase-summary").post(
  authGuard,
  reportLimiter,
  authorize("purchase-summary", "view"),
  reportController.getPurchaseSummaryReport,
);
_.route("/purchase-return").post(
  authGuard,
  reportLimiter,
  authorize("purchase-return-report", "view"),
  reportController.getPurchaseReturnReport,
);
_.route("/purchase-return-summary").post(
  authGuard,
  reportLimiter,
  authorize("purchase-return-summary", "view"),
  reportController.getPurchaseReturnSummaryReport,
);
_.route("/stock").post(
  authGuard,
  reportLimiter,
  authorize("stock-report", "view"),
  reportController.getStockReport,
);
_.route("/stock-details").post(
  authGuard,
  reportLimiter,
  authorize("stock-details-report", "view"),
  reportController.getStockDetailsReport,
);
_.route("/product-ledger").post(
  authGuard,
  reportLimiter,
  authorize("product-ledger-report", "view"),
  reportController.getProductLedgerReport,
);
_.route("/ledger-items").get(
  authGuard,
  reportLimiter,
  authorize("product-ledger-report", "view"),
  reportController.getLedgerItems,
);
_.route("/size-color-stock").post(
  authGuard,
  reportLimiter,
  authorize("size-color-stock-report", "view"),
  reportController.getSizeColorStockReport,
);
_.route("/stock-adjustment").post(
  authGuard,
  reportLimiter,
  authorize("stock-adjustment-report", "view"),
  reportController.getStockAdjustmentReport,
);
_.route("/low-stock").post(
  authGuard,
  reportLimiter,
  authorize("low-stock-report", "view"),
  reportController.getLowStockReport,
);
_.route("/purchase/suppliers").get(
  authGuard,
  reportLimiter,
  authorize("purchase-invoice", "view"),
  reportController.getPurchaseInvoiceSuppliers,
);
_.route("/sales-invoice").post(
  authGuard,
  reportLimiter,
  authorize("sales-invoice-report", "view"),
  reportController.getSalesInvoiceReport,
);
_.route("/sales-product").post(
  authGuard,
  reportLimiter,
  authorize("sales-product-report", "view"),
  reportController.getSalesProductReport,
);
_.route("/sales-summary").post(
  authGuard,
  reportLimiter,
  authorize("sales-summary-report", "view"),
  reportController.getSalesSummaryReport,
);
_.route("/sales/customers").get(
  authGuard,
  reportLimiter,
  authorize("sales-invoice-report", "view"),
  reportController.getSalesInvoiceCustomers,
);
_.route("/sales/salesmen").get(
  authGuard,
  reportLimiter,
  authorize("sales-invoice-report", "view"),
  reportController.getSalesInvoiceSalesmen,
);
_.route("/customer-sales-invoice").post(
  authGuard,
  reportLimiter,
  authorize("customer-sales-invoice-report", "view"),
  reportController.getCustomerSalesInvoiceReport,
);
_.route("/customer-sales-product").post(
  authGuard,
  reportLimiter,
  authorize("customer-sales-product-report", "view"),
  reportController.getCustomerSalesProductReport,
);
_.route("/customer-sales-summary").post(
  authGuard,
  reportLimiter,
  authorize("customer-sales-summary-report", "view"),
  reportController.getCustomerSalesSummaryReport,
);
_.route("/supplier-purchase-invoice").post(
  authGuard,
  reportLimiter,
  authorize("supplier-purchase-invoice-report", "view"),
  reportController.getSupplierPurchaseInvoiceReport,
);
_.route("/supplier-payment").post(
  authGuard,
  reportLimiter,
  authorize("supplier-payment-report", "view"),
  reportController.getSupplierPaymentReport,
);
_.route("/supplier-payment/suppliers").get(
  authGuard,
  reportLimiter,
  authorize("supplier-payment-report", "view"),
  reportController.getSupplierPaymentSuppliers,
);
_.route("/supplier/suppliers").get(
  authGuard,
  reportLimiter,
  authorize("supplier-purchase-invoice-report", "view"),
  reportController.getSupplierReportSuppliers,
);
_.route("/customer/customers").get(
  authGuard,
  reportLimiter,
  authorize("customer-sales-invoice-report", "view"),
  reportController.getCustomerReportCustomers,
);
_.route("/customer-payment").post(
  authGuard,
  reportLimiter,
  authorize("customer-payment-report", "view"),
  reportController.getCustomerPaymentReport,
);
_.route("/customer-payment/customers").get(
  authGuard,
  reportLimiter,
  authorize("customer-payment-report", "view"),
  reportController.getCustomerPaymentCustomers,
);
_.route("/customer-balance-summary").post(
  authGuard,
  reportLimiter,
  authorize("customer-balance-summary-report", "view"),
  reportController.getCustomerBalanceSummaryReport,
);
_.route("/customer-balance-summary/filters").get(
  authGuard,
  reportLimiter,
  authorize("customer-balance-summary-report", "view"),
  reportController.getCustomerBalanceSummaryFilters,
);
_.route("/customer-ledger").post(
  authGuard,
  reportLimiter,
  authorize("customer-ledger-report", "view"),
  reportController.getCustomerLedgerReport,
);
_.route("/customer-due-list").post(
  authGuard,
  reportLimiter,
  authorize("customer-due-list-report", "view"),
  reportController.getCustomerDueListReport,
);
_.route("/employee-list").post(
  authGuard,
  reportLimiter,
  authorize("employee-list-report", "view"),
  reportController.getEmployeeListReport,
);
_.route("/employee-payment").post(
  authGuard,
  reportLimiter,
  authorize("employee-payment-report", "view"),
  reportController.getEmployeePaymentReport,
);
_.route("/employee-payment/employees").get(
  authGuard,
  reportLimiter,
  authorize("employee-payment-report", "view"),
  reportController.getEmployeePaymentEmployees,
);

module.exports = _;
