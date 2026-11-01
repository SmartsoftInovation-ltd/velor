const express = require("express");
const _ = express.Router();
const roleController = require("../../controller/role.controller");
const { authGuard } = require("../../middleware/authMiddleware");
const {
  authorize,
  authorizeAny,
} = require("../../middleware/checkPermission.middleware");

// Every route here is permission-guarded. authorize() already lets a superadmin
// through before it checks anything, so guarding these does not lock superadmin
// out — leaving them ungated was granting access to every logged-in user, and
// the two read routes to anyone at all.

_.route("/create-role")
  .post(
    authGuard,
    authorize("create-role", "add"),
    roleController.createRole
  );

// The role list also backs the role dropdown on the user add/edit screens,
// which are granted "create-user" — so either permission may read it.
_.route("/all-role")
  .get(
    authGuard,
    authorizeAny(["create-role", "view"], ["create-user", "view"], ["create-user", "add"], ["create-user", "edit"], ["assign-role", "view"]),
    roleController.getAllRoles
  );

_.route("/singlerole/:slug")
  .get(authGuard, authorize("create-role", "view"), roleController.getRoleByslug);

_.route("/updaterole/:slug")
  .put(
    authGuard,
    authorize("create-role", "edit"),
    roleController.updateRole
  );

_.route("/deleterole/:slug")
  .delete(
    authGuard,
    authorize("create-role", "delete"),
    roleController.deleteRole
  );

_.route("/role/:slug/permissions")
  .get(
    authGuard,
    // The Assign Role Permission page has its own permission
    authorizeAny(["create-role", "view"], ["assign-role", "view"]),
    roleController.getRolePermissions
  )
  .put(
    authGuard,
    authorizeAny(["create-role", "edit"], ["assign-role", "edit"]),
    roleController.assignPermissionsToRole
  );

module.exports = _;
