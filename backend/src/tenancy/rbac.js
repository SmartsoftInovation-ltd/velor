const Permission = require("../models/permisson.model");
const Role = require("../models/role.model");
const User = require("../models/user.model");
const { customError } = require("../lib/CustomError");
const { statusCodes } = require("../constant/constant");

// "superadmin" is the pre-multi-tenancy owner role; migration 005 renames it
const OWNER_ROLE_SLUGS = ["owner", "superadmin"];
// Permissions that control who can do what: only the owner may shape roles holding them
// Permissions that hand out access to others; only the owner may give them to a role
const PRIVILEGED_PERMISSION_SLUGS = ["create-user", "create-role", "assign-role"];

const forbidden = (message, code) => new customError(message, statusCodes.FORBIDDEN, code);

const populatedUser = (userOrId) =>
  User.findById(userOrId?._id || userOrId)
    .populate({ path: "roles", populate: { path: "permissions.permission" } })
    .populate("permissions.permission");

const isOwner = (user) => (user?.roles || []).some((role) => OWNER_ROLE_SLUGS.includes(role?.slug));

// slug -> Set(actions) across active roles and direct grants; expects populated user
const effectiveActions = (user) => {
  const map = new Map();
  const add = (entry) => {
    const slug = entry.permission?.slug;
    if (!slug || entry.permission.isActive === false) return;
    if (!map.has(slug)) map.set(slug, new Set());
    (entry.actions || []).forEach((action) => map.get(slug).add(action));
  };
  (user.roles || []).filter((role) => role.isActive !== false).forEach((role) => (role.permissions || []).forEach(add));
  (user.permissions || []).forEach(add);
  return map;
};

// grants: [{ permissionId | permission, actions }]
const assertCanGrantPermissions = async (actor, grants = []) => {
  if (isOwner(actor)) return;
  const held = effectiveActions(actor);

  for (const grant of grants) {
    const id = grant.permissionId || grant.permission?._id || grant.permission;
    if (!id || !grant.actions?.length) continue;
    const permission = grant.permission?.slug ? grant.permission : await Permission.findById(id).lean();
    if (!permission) continue;
    for (const action of grant.actions) {
      if (!held.get(permission.slug)?.has(action)) {
        throw forbidden(`You cannot grant ${permission.slug}:${action} because you do not hold it`);
      }
    }
  }
};

const assertCanAssignRole = async (actor, roleId) => {
  if (!roleId) return;
  const role = await Role.findById(roleId).populate("permissions.permission").lean();
  if (!role) throw new customError("Role not found", statusCodes.NOT_FOUND);
  if (OWNER_ROLE_SLUGS.includes(role.slug)) {
    throw forbidden("The owner role cannot be assigned here");
  }
  await assertCanGrantPermissions(actor, role.permissions);
};

const assertCanManageUser = async (actor, target) => {
  const targetUser = target?.roles?.[0]?.slug ? target : await populatedUser(target);
  if (!targetUser) throw new customError("User not found", statusCodes.NOT_FOUND);
  if (isOwner(targetUser) && !isOwner(actor)) {
    throw forbidden("Only the store owner can change the owner's account");
  }
  return targetUser;
};

const assertCanEditRole = (actor, role) => {
  if (OWNER_ROLE_SLUGS.includes(role.slug)) throw forbidden("The owner role cannot be changed");
  if (isOwner(actor)) return;
  const privileged = (role.permissions || []).some((p) => PRIVILEGED_PERMISSION_SLUGS.includes(p.permission?.slug));
  if (privileged) throw forbidden("Only the store owner can change roles that manage users or roles");
};

// Counts active staff (users with a role) against the tenant's plan limit
const assertStaffCapacity = async (tenant) => {
  const max = tenant?.limits?.maxStaff;
  if (max === null || max === undefined) return;
  const staff = await User.countDocuments({ isActive: true, "roles.0": { $exists: true } });
  if (staff >= max) {
    throw forbidden(`Staff limit reached (${max}). Contact support to upgrade.`, "STAFF_LIMIT_REACHED");
  }
};

module.exports = {
  OWNER_ROLE_SLUGS,
  isOwner,
  effectiveActions,
  populatedUser,
  assertCanGrantPermissions,
  assertCanAssignRole,
  assertCanManageUser,
  assertCanEditRole,
  assertStaffCapacity,
};
