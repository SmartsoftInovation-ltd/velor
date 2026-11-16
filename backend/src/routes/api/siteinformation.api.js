const express = require("express");
const _ = express.Router();
const { singleFileUpload } = require("../../middleware/multer.middleware");
const { authGuard } = require("../../middleware/authMiddleware");
const { authorize } = require("../../middleware/checkPermission.middleware");
const siteInformationController = require("../../controller/siteinformation.controller");
const returnPolicyController = require("../../controller/returnPolicy.controller");

_.route("/create-siteinformation").post(
  authGuard,
  authorize("site-information", "add"),
  singleFileUpload("image"),
  siteInformationController.createSiteInformation,
);

_.route("/get-siteinformation").get(
  authGuard,
  authorize("site-information", "view"),
  siteInformationController.getAllSiteInformation,
);

_.route("/single-siteinformation/:slug").get(
  authGuard,
  authorize("site-information", "view"),
  siteInformationController.getSingleSiteInformation,
);

_.route("/update-siteinformation/:slug").put(
  authGuard,
  authorize("site-information", "edit"),
  singleFileUpload("image"),
  siteInformationController.updateSiteInformation,
);

_.route("/delete-siteinformation/:slug").delete(
  authGuard,
  authorize("site-information", "delete"),
  siteInformationController.deleteSiteInformation,
);

// The return policy shown on the storefront; part of the website's information
_.route("/return-policy")
  .get(authGuard, authorize("site-information", "view"), returnPolicyController.getReturnPolicy)
  .put(authGuard, authorize("site-information", "edit"), returnPolicyController.saveReturnPolicy);

module.exports = _;
