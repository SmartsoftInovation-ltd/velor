const express = require("express");
const _ = express.Router();
const salesReturnController = require("../../controller/salesReturn.controller");
const { authGuard } = require("../../middleware/authMiddleware");
const { authorize } = require("../../middleware/checkPermission.middleware");

_.route("/createsalesreturn").post(authGuard, authorize("sales-return", "add"), salesReturnController.createSalesReturn);
_.route("/allsalesreturn").get(authGuard, authorize("sales-return", "view"), salesReturnController.getAllSalesReturn);
_.route("/single-salesreturn/:id").get(authGuard, authorize("sales-return", "view"), salesReturnController.getSingleSalesReturn);
_.route("/update-salesreturn/:id").put(authGuard, authorize("sales-return", "edit"), salesReturnController.updateSalesReturn);
_.route("/delete-salesreturn/:id").delete(authGuard, authorize("sales-return", "delete"), salesReturnController.deleteSalesReturn);

module.exports = _;
