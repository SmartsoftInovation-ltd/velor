const PlatformAuditLog = require("../models/platform/platformAuditLog.model");

const recordPlatformAudit = ({ req, actor, actorEmail, action, tenantId = null, changes = [], metadata }) =>
  PlatformAuditLog.create({
    actor: actor?._id || null,
    actorEmail: actor?.email || actorEmail || "",
    action,
    tenantId,
    changes,
    metadata,
    ip: req?.ip || "",
    userAgent: req?.get?.("user-agent") || "",
  });

module.exports = { recordPlatformAudit };
