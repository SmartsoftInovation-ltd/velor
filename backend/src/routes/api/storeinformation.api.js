const express = require("express");
const _ = express.Router();
const { singleFileUpload } = require("../../middleware/multer.middleware");
const { authGuard } = require("../../middleware/authMiddleware");
const { authorize, authorizeAny } = require("../../middleware/checkPermission.middleware");
const storeInformationController = require("../../controller/storeInformation.controller");

_.route("/store-information")
  .post(
    authGuard,
    authorize("store-information", "add"),
    singleFileUpload("image"),
    storeInformationController.createStoreInformation,
  )
  // Every printed invoice reads the store's details from here, so the older
  // Site Information grant still opens it
  .get(
    authGuard,
    authorizeAny(["store-information", "view"], ["site-information", "view"]),
    storeInformationController.getAllStoreInformation,
  );

_.route("/store-information/search").get(
  authGuard,
  authorize("store-information", "view"),
  storeInformationController.searchStoreInformation,
);

_.route("/store-information-branding").get(
  authGuard,
  storeInformationController.getStoreBranding,
);

_.route("/store-information/:slug")
  .get(
    authGuard,
    authorize("store-information", "view"),
    storeInformationController.getSingleStoreInformation,
  )
  .put(
    authGuard,
    authorize("store-information", "edit"),
    singleFileUpload("image"),
    storeInformationController.updateStoreInformation,
  )
  .delete(
    authGuard,
    authorize("store-information", "delete"),
    storeInformationController.deleteStoreInformation,
  );

_.route("/store-information/:slug/activate").put(
  authGuard,
  authorize("store-information", "edit"),
  storeInformationController.activateStoreInformation,
);

_.route("/store-information/:slug/deactivate").put(
  authGuard,
  authorize("store-information", "edit"),
  storeInformationController.deactivateStoreInformation,
);

module.exports = _;
