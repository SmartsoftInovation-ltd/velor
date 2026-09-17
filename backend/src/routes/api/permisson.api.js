const express = require("express");
const _ = express.Router();
const Permission = require("../../controller/permission.controller");
const { authGuard } = require("../../middleware/authMiddleware");
const { authorize } = require("../../middleware/checkPermission.middleware");
const { customError } = require("../../lib/CustomError");
const { statusCodes } = require("../../constant/constant");

// The permission catalog is shared by every store and managed by the platform
// (/api/v1/platform/permissions). Stores may only read it.
const platformManaged = (req, res, next) =>
  next(new customError("Permissions are managed by the platform", statusCodes.FORBIDDEN));

_.route("/addpermission").post(authGuard, platformManaged);
_.route("/allpermissions").get(authGuard, Permission.getAllPermissions);
_.route("/permission/:slug").get(
  authGuard,
  authorize("create-permission", "view"),
  Permission.getPermissionBySlug,
);
_.route("/permission-update/:slug").put(authGuard, platformManaged);
_.route("/permission-deactive/:slug").put(authGuard, platformManaged);
_.route("/permission-active/:slug").put(authGuard, platformManaged);
_.route("/delete-permission/:slug").delete(authGuard, platformManaged);

module.exports = _;
