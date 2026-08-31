const { customError } = require("../lib/CustomError");
const { asynchandeler } = require("../lib/asyncHandeler");
const { statusCodes } = require("../constant/constant");

// Collect every action the user holds for one module slug, union'd across
// their roles and their direct user-level grants (most permissive wins).
const actionsForModule = (user, moduleName) => {
  const module = moduleName?.toString()?.toLowerCase();
  const effectiveActions = new Set();

  for (const role of user.roles || []) {
    if (!role.isActive) continue;
    for (const p of role.permissions || []) {
      if (p.permission?.slug === module) {
        (p.actions || []).forEach((a) => effectiveActions.add(a));
      }
    }
  }

  for (const p of user.permissions || []) {
    if (p.permission?.slug === module) {
      (p.actions || []).forEach((a) => effectiveActions.add(a));
    }
  }

  return effectiveActions;
};

const isSuperAdminUser = (user) =>
  (user?.roles || []).some((role) => role?.slug === "superadmin");

const authorize = (moduleName, action) =>
  asynchandeler(async (req, res, next) => {
    if (!req.user || !req.user._id) {
      throw new customError("Unauthorized: User not found in request", statusCodes.UNAUTHORIZED);
    }

    // Superadmin bypasses all checks
    if (isSuperAdminUser(req.user)) return next();

    if (actionsForModule(req.user, moduleName).has(action)) {
      return next();
    }

    throw new customError(
      `Access denied: User "${req.user.name}" is not authorized for ${moduleName}:${action}`,
      statusCodes.FORBIDDEN
    );
  });

// Passes when the user satisfies ANY of the given [module, action] pairs.
// Needed for shared lookup endpoints — the role list, for example, is read both
// by role administration and by the user add/edit screens, which are granted
// "create-user" rather than "create-role".
const authorizeAny = (...pairs) =>
  asynchandeler(async (req, res, next) => {
    if (!req.user || !req.user._id) {
      throw new customError("Unauthorized: User not found in request", statusCodes.UNAUTHORIZED);
    }

    if (isSuperAdminUser(req.user)) return next();

    const allowed = pairs.some(([moduleName, action]) =>
      actionsForModule(req.user, moduleName).has(action),
    );
    if (allowed) return next();

    const described = pairs.map(([m, a]) => `${m}:${a}`).join(" or ");
    throw new customError(
      `Access denied: User "${req.user.name}" is not authorized for ${described}`,
      statusCodes.FORBIDDEN
    );
  });

module.exports = { authorize, authorizeAny };
