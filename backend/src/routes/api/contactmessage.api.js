const express = require("express");
const { authGuard } = require("../../middleware/authMiddleware");
const { authorize } = require("../../middleware/checkPermission.middleware");
const contactMessageController = require("../../controller/contactMessage.controller");

/**
 * The dashboard's inbox for storefront Contact page messages. Gated by the
 * Website Settings permission ("site-information"), like the rest of that menu.
 */
const _ = express.Router();

_.get("/", authGuard, authorize("site-information", "view"), contactMessageController.list);
_.patch("/:id/read", authGuard, authorize("site-information", "edit"), contactMessageController.setRead);
_.delete("/:id", authGuard, authorize("site-information", "delete"), contactMessageController.remove);

module.exports = _;
