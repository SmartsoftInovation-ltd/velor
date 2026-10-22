const express = require("express");
const controller = require("../../controller/flashSale.controller");
const { authGuard } = require("../../middleware/authMiddleware");
const { authorize } = require("../../middleware/checkPermission.middleware");
const { validateBody } = require("../../validation/platform/validateBody");
const { flashSaleSchema } = require("../../validation/flashSale.validation");

// Website Management → Flash Sale (staff). The storefront reads /shop/flash-sale.
const _ = express.Router();

_.get("/", authGuard, authorize("flash-sale", "view"), controller.list);
_.get("/:id", authGuard, authorize("flash-sale", "view"), controller.get);
_.post("/", authGuard, authorize("flash-sale", "add"), validateBody(flashSaleSchema), controller.create);
_.put("/:id", authGuard, authorize("flash-sale", "edit"), validateBody(flashSaleSchema), controller.update);
_.delete("/:id", authGuard, authorize("flash-sale", "delete"), controller.remove);

module.exports = _;
