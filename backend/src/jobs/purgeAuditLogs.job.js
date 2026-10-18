"use strict";

const cron = require("node-cron");
const { auditLogModel } = require("../models/auditLog.model");
const { runAsPlatform } = require("../tenancy/context");

// Audit logs are kept for 30 days: today and the 30 days before it. Every
// night anything older is hard-deleted, for every store at once. The model
// blocks deletes from app code (logs are immutable), so the purge goes through
// the raw collection, in platform scope since it spans stores.
const AUDIT_RETENTION_DAYS = 30;

const retentionCutoff = (now = new Date()) =>
  new Date(now.getTime() - AUDIT_RETENTION_DAYS * 24 * 60 * 60 * 1000);

async function purgeAuditLogs() {
  try {
    const cutoff = retentionCutoff();
    const { deletedCount } = await runAsPlatform(() =>
      auditLogModel.collection.deleteMany({ createdAt: { $lt: cutoff } }),
    );
    console.log(`[AuditPurge] Deleted ${deletedCount} audit log(s) older than ${cutoff.toISOString()}`);
  } catch (err) {
    console.error("[AuditPurge] Failed:", err.message);
  }
}

// Every day at 3:00 AM (Dhaka), and once at startup so a server that was down
// at 3 AM still catches up
function scheduleAuditLogPurge() {
  cron.schedule("0 3 * * *", purgeAuditLogs, { timezone: "Asia/Dhaka" });
  purgeAuditLogs();
  console.log(`[AuditPurge] Scheduler registered — keeps ${AUDIT_RETENTION_DAYS} days, runs daily at 3:00 AM (Dhaka)`);
}

module.exports = { scheduleAuditLogPurge, purgeAuditLogs, retentionCutoff, AUDIT_RETENTION_DAYS };
