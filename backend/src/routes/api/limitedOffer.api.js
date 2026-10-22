const express = require("express");
const controller = require("../../controller/limitedOffer.controller");
const { authGuard } = require("../../middleware/authMiddleware");
const { authorize } = require("../../middleware/checkPermission.middleware");
const { validateBody } = require("../../validation/platform/validateBody");
const { addLimitedOfferSchema, updateLimitedOfferSchema } = require("../../validation/limitedOffer.validation");

// Website Management → Limited Offer (staff). The storefront reads /shop/limited-offers.
const _ = express.Router();

_.get("/", authGuard, authorize("limited-offer", "view"), controller.list);
_.post("/", authGuard, authorize("limited-offer", "add"), validateBody(addLimitedOfferSchema), controller.add);
_.patch("/:id", authGuard, authorize("limited-offer", "edit"), validateBody(updateLimitedOfferSchema), controller.update);
_.delete("/:id", authGuard, authorize("limited-offer", "delete"), controller.remove);

module.exports = _;
