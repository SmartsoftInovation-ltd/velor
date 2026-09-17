const Role = require("../models/role.model");
const Permission = require("../models/permisson.model");
const { apiResponse } = require("../utils/apiResponse");
const { customError } = require("../lib/CustomError");
const { statusCodes } = require("../constant/constant");
const { asynchandeler } = require("../lib/asyncHandeler");
const { bumpNsVersion } = require("../utils/cache.util");
const rbac = require("../tenancy/rbac");

const findRoleForEdit = async (req) => {
  const { slug } = req.params;
  if (!slug) throw new customError("Role slug not provided", statusCodes.BAD_REQUEST);
  const role = await Role.findOne({ slug }).populate("permissions.permission");
  if (!role) throw new customError("Role not found", statusCodes.NOT_FOUND);
  rbac.assertCanEditRole(req.user, role);
  return role;
};

const NS = "role";

exports.createRole = asynchandeler(async (req, res) => {
  const { name } = req.body;
  const role = new Role({ name });
  await role.save();
  await bumpNsVersion(NS);
  apiResponse.sendSuccess(res, statusCodes.CREATED, "Role created successfully", role);
});

exports.getAllRoles = asynchandeler(async (req, res) => {
  const roles = await Role.find();
  if (!roles) throw new customError("Roles not found", statusCodes.NOT_FOUND);
  apiResponse.sendSuccess(res, statusCodes.OK, "Roles fetched successfully", roles);
});

exports.getRoleByslug = asynchandeler(async (req, res) => {
  if (!req.params.slug) throw new customError("Role slug not provided", statusCodes.BAD_REQUEST);
  const role = await Role.findOne({ slug: req.params.slug });
  if (!role) throw new customError("Role not found", statusCodes.NOT_FOUND);
  apiResponse.sendSuccess(res, statusCodes.OK, "Role fetched successfully", role);
});

exports.updateRole = asynchandeler(async (req, res) => {
  const { slug } = req.params;
  await findRoleForEdit(req);
  // Permissions change only through assignPermissionsToRole (escalation-checked)
  const changes = {};
  if (req.body.name !== undefined) changes.name = req.body.name;
  if (req.body.isActive !== undefined) changes.isActive = req.body.isActive;
  const role = await Role.findOneAndUpdate({ slug }, changes, { new: true });
  if (!role) throw new customError("Role not found", statusCodes.NOT_FOUND);
  await bumpNsVersion(NS);
  apiResponse.sendSuccess(res, statusCodes.OK, "Role updated successfully", role);
});

exports.deleteRole = asynchandeler(async (req, res) => {
  const { slug } = req.params;
  await findRoleForEdit(req);
  const role = await Role.findOneAndDelete({ slug });
  if (!role) throw new customError("Role not found", statusCodes.NOT_FOUND);
  await bumpNsVersion(NS);
  apiResponse.sendSuccess(res, statusCodes.OK, "Role deleted successfully", role);
});

// GET /role/:slug/permissions — returns role with populated permissions
exports.getRolePermissions = asynchandeler(async (req, res) => {
  const role = await Role.findOne({ slug: req.params.slug })
    .populate({ path: "permissions.permission", model: "Permission", select: "permissionName slug isActive" });
  if (!role) throw new customError("Role not found", statusCodes.NOT_FOUND);
  apiResponse.sendSuccess(res, statusCodes.OK, "Role permissions fetched successfully", role);
});

// PUT /role/:slug/permissions — replaces role's full permission set
exports.assignPermissionsToRole = asynchandeler(async (req, res) => {
  const { permissions } = req.body; // [{ permissionId, actions: ["view","add",...] }]
  const role = await findRoleForEdit(req);
  await rbac.assertCanGrantPermissions(req.user, permissions || []);
  if (!rbac.isOwner(req.user)) {
    const ids = (permissions || []).map((p) => p.permissionId).filter(Boolean);
    const privileged = await Permission.exists({ _id: { $in: ids }, slug: { $in: ["create-user", "create-role"] } });
    if (privileged) {
      throw new customError("Only the store owner can give roles user or role management", statusCodes.FORBIDDEN);
    }
  }

  // Validate each permissionId exists
  const rolePermissions = [];
  for (const p of (permissions || [])) {
    if (!p.permissionId || !p.actions?.length) continue;
    const exists = await Permission.findById(p.permissionId);
    if (!exists) continue;
    rolePermissions.push({ permission: p.permissionId, actions: p.actions });
  }

  role.permissions = rolePermissions;
  await role.save();
  await bumpNsVersion(NS);

  // Re-fetch with populated permission details for the response
  const updatedRole = await Role.findOne({ slug: req.params.slug })
    .populate({
      path: "permissions.permission",
      model: "Permission",
      select: "permissionName slug isActive",
    });

  apiResponse.sendSuccess(res, statusCodes.OK, "Role permissions updated successfully", updatedRole);
});
