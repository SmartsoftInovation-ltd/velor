const express = require("express");
const _ = express.Router();
const orderSourceController = require("../../controller/orderSource.controller");
const { authGuard } = require("../../middleware/authMiddleware");
const { authorize } = require("../../middleware/checkPermission.middleware");

// The list is chosen and extended while entering an order, so it rides on the
// "order" module's own permissions rather than needing one of its own.
_.route("/").get(authGuard, authorize("order", "view"), orderSourceController.getOrderSources);
_.route("/").post(authGuard, authorize("order", "add"), orderSourceController.createOrderSource);
_.route("/:id").put(authGuard, authorize("order", "edit"), orderSourceController.updateOrderSource);
_.route("/:id").delete(authGuard, authorize("order", "delete"), orderSourceController.deleteOrderSource);

module.exports = _;
