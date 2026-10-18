const mongoose = require("mongoose");
const { auditLogModel, AUDIT_ACTIONS } = require("../models/auditLog.model");
const { apiResponse } = require("../utils/apiResponse");
const { asynchandeler } = require("../lib/asyncHandeler");
const { customError } = require("../lib/CustomError");
const { statusCodes } = require("../constant/constant");
const { retentionCutoff } = require("../jobs/purgeAuditLogs.job");

const MAX_LIMIT = 100;

// @desc get audit logs with filters + cursor pagination
// @query entityType, entityId, userId, action, from, to, cursor, limit
exports.getAuditLogs = asynchandeler(async (req, res) => {
  const { entityType, entityId, userId, action, from, to, cursor, limit } =
    req.query;

  const filter = {};
  if (entityType) filter["entity.type"] = entityType.toLowerCase();
  if (entityId) {
    if (!mongoose.Types.ObjectId.isValid(entityId)) {
      throw new customError("Invalid entityId", statusCodes.BAD_REQUEST);
    }
    filter["entity.id"] = new mongoose.Types.ObjectId(entityId);
  }
  if (userId) {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new customError("Invalid userId", statusCodes.BAD_REQUEST);
    }
    filter["user.id"] = new mongoose.Types.ObjectId(userId);
  }
  if (action) {
    if (!AUDIT_ACTIONS.includes(action)) {
      throw new customError("Invalid action", statusCodes.BAD_REQUEST);
    }
    filter.action = action;
  }
  // Only the 30-day retention window is ever shown: rows past it are purged
  // nightly, and until then they are hidden so the list never runs past it
  const cutoff = retentionCutoff();
  const fromDate = from ? new Date(from) : null;
  filter.createdAt = { $gte: fromDate && fromDate > cutoff ? fromDate : cutoff };
  if (to) filter.createdAt.$lte = new Date(to);
  // Cursor pagination — _id order ≈ time order, O(log n) at any depth
  if (cursor) {
    if (!mongoose.Types.ObjectId.isValid(cursor)) {
      throw new customError("Invalid cursor", statusCodes.BAD_REQUEST);
    }
    filter._id = { $lt: new mongoose.Types.ObjectId(cursor) };
  }

  const pageSize = Math.min(Number(limit) || 50, MAX_LIMIT);

  const logs = await auditLogModel
    .find(filter)
    .sort({ _id: -1 })
    .limit(pageSize + 1)
    .lean();

  const hasMore = logs.length > pageSize;
  if (hasMore) logs.pop();

  apiResponse.sendSuccess(res, statusCodes.OK, "Audit logs fetched", {
    logs,
    nextCursor: hasMore ? logs[logs.length - 1]._id : null,
    actions: AUDIT_ACTIONS,
  });
});

// @desc full timeline for one entity: /audit/entity/:type/:id
exports.getEntityTimeline = asynchandeler(async (req, res) => {
  const { type, id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new customError("Invalid entity id", statusCodes.BAD_REQUEST);
  }

  const logs = await auditLogModel
    .find({
      "entity.type": type.toLowerCase(),
      "entity.id": new mongoose.Types.ObjectId(id),
      createdAt: { $gte: retentionCutoff() },
    })
    .sort({ createdAt: -1 })
    .limit(MAX_LIMIT)
    .lean();

  apiResponse.sendSuccess(res, statusCodes.OK, "Entity timeline fetched", logs);
});
