const express = require("express");
const _ = express.Router();
const reportController = require("../../controller/report.controller");
const { authGuard } = require("../../middleware/authMiddleware");
const { authorize, authorizeAny } = require("../../middleware/checkPermission.middleware");
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
_.route("/customer-invoice-profit").post(
  authGuard,
  reportLimiter,
  authorize("customer-invoice-profit-report", "view"),
  reportController.getCustomerInvoiceProfitReport,
);
_.route("/invoice-profit").post(
  authGuard,
  reportLimiter,
  authorize("invoice-profit-report", "view"),
  reportController.getInvoiceProfitReport,
);
_.route("/product-profit").post(
  authGuard,
  reportLimiter,
  authorize("product-profit-report", "view"),
  reportController.getProductProfitReport,
);
_.route("/user-sales-product").post(
  authGuard,
  reportLimiter,
  authorize("user-sales-product-report", "view"),
  reportController.getUserSalesProductReport,
);
_.route("/user-sales-invoice").post(
  authGuard,
  reportLimiter,
  authorize("user-sales-invoice-report", "view"),
  reportController.getUserSalesInvoiceReport,
);
_.route("/product-sales-return-summary").post(
  authGuard,
  reportLimiter,
  authorize("product-sales-return-summary-report", "view"),
  reportController.getProductSalesReturnSummaryReport,
);
_.route("/product-sales-return").post(
  authGuard,
  reportLimiter,
  authorize("product-sales-return-report", "view"),
  reportController.getProductSalesReturnReport,
);
_.route("/push-sales-product").post(
  authGuard,
  reportLimiter,
  authorize("push-sales-product-report", "view"),
  reportController.getPushSalesProductReport,
);
_.route("/top-sales-product").post(
  authGuard,
  reportLimiter,
  authorize("top-sales-product-report", "view"),
  reportController.getTopSalesProductReport,
);
_.route("/top-customer").post(
  authGuard,
  reportLimiter,
  authorize("top-customer-report", "view"),
  reportController.getTopCustomerReport,
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
_.route("/supplier-ledger").post(
  authGuard,
  reportLimiter,
  authorize("supplier-ledger-report", "view"),
  reportController.getSupplierLedgerReport,
);
_.route("/supplier-balance-summary").post(
  authGuard,
  reportLimiter,
  authorize("supplier-balance-summary-report", "view"),
  reportController.getSupplierBalanceSummaryReport,
);
_.route("/supplier-dues").post(
  authGuard,
  reportLimiter,
  authorize("supplier-dues-report", "view"),
  reportController.getSupplierDuesReport,
);
// The supplier dropdown is shared by the ledger, balance summary and dues.
_.route("/supplier-ledger/suppliers").get(
  authGuard,
  reportLimiter,
  authorizeAny(
    ["supplier-ledger-report", "view"],
    ["supplier-balance-summary-report", "view"],
    ["supplier-dues-report", "view"],
  ),
  reportController.getSupplierLedgerSuppliers,
);
_.route("/transaction-report").post(
  authGuard,
  reportLimiter,
  authorize("transaction-report", "view"),
  reportController.getTransactionReport,
);
_.route("/transaction-summary").post(
  authGuard,
  reportLimiter,
  authorize("transaction-summary", "view"),
  reportController.getTransactionSummaryReport,
);
_.route("/all-transaction-summary").post(
  authGuard,
  reportLimiter,
  authorize("all-transaction-summary", "view"),
  reportController.getAllTransactionSummaryReport,
);
_.route("/accounts-ledger").post(
  authGuard,
  reportLimiter,
  authorize("accounts-ledger", "view"),
  reportController.getAccountsLedgerReport,
);
_.route("/account-day-transaction").post(
  authGuard,
  reportLimiter,
  authorize("account-day-transaction", "view"),
  reportController.getAccountDayTransactionReport,
);
_.route("/account-transaction-summary").post(
  authGuard,
  reportLimiter,
  authorize("account-transaction-summary", "view"),
  reportController.getAccountTransactionSummaryReport,
);
_.route("/account-balance").post(
  authGuard,
  reportLimiter,
  authorize("account-balance", "view"),
  reportController.getAccountBalanceReport,
);
_.route("/fund-handover").post(
  authGuard,
  reportLimiter,
  authorize("fund-handover", "view"),
  reportController.getFundHandoverReport,
);
// The account / category dropdowns are shared by the transaction reports.
_.route("/transaction-report/options").get(
  authGuard,
  reportLimiter,
  authorizeAny(
    ["transaction-report", "view"],
    ["transaction-summary", "view"],
    ["all-transaction-summary", "view"],
    ["accounts-ledger", "view"],
    ["account-day-transaction", "view"],
    ["fund-handover", "view"],
  ),
  reportController.getTransactionReportOptions,
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
