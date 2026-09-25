const express = require("express");
const _ = express.Router();
const salesController = require("../../controller/sales.controller");
const {
  createSalesSchema,
  updateSalesSchema,
} = require("../../validation/sales.validation");
const validate = require("../../middleware/validate");
const { authGuard } = require("../../middleware/authMiddleware");
const { authorize, authorizeAny } = require("../../middleware/checkPermission.middleware");

// Each salesType has its own permission module, so a user can be allowed to
// take sale orders without being allowed to make direct sales, and vice versa.
const SALES_TYPE_MODULE = {
  retailsale: "retail-sales",
  wholesale: "wholesale-sales",
  retailsaleorder: "retail-sale-order",
  wholesaleorder: "whole-sale-order",
};

// /create-sales handles every salesType (req.body.salesType); route to the
// matching permission module instead of always requiring "retail-sales".
const authorizeSalesCreate = (req, res, next) => {
  const module = SALES_TYPE_MODULE[req.body?.salesType] || "retail-sales";
  return authorize(module, "add")(req, res, next);
};

// The sale order screens read the same list and product search as sales, so a
// sale-order-only user needs these too.
const SALES_READERS = [
  ["retail-sales", "view"],
  ["retail-sale-order", "view"],
  ["retail-sale-order", "add"],
  ["whole-sale-order", "view"],
  ["whole-sale-order", "add"],
];

_.route("/create-sales").post(authGuard, authorizeSalesCreate, validate(createSalesSchema), salesController.createSales);
_.route("/get-sales").get(authGuard, authorizeAny(...SALES_READERS), salesController.getAllSales);
_.route("/get-sales-products").get(authGuard, authorizeAny(...SALES_READERS), salesController.searchProductsAndVariants);
_.route("/update-sales/:saleId").put(authGuard, authorize("retail-sales", "edit"), validate(updateSalesSchema), salesController.updateSales);
_.route("/delete-sales/:saleId").delete(authGuard, authorize("retail-sales", "delete"), salesController.deleteSales);

module.exports = _;
