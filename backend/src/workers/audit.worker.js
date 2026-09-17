"use strict";

require("dotenv").config();
require("module-alias/register");

const { Worker } = require("bullmq");
const { tenantJob } = require("@/tenancy/queue");
const { startSettingsInvalidationListener } = require("@/settings/settings.service");
const { AUDIT_QUEUE_NAME } = require("@/queues/audit.queue");
const { connection } = require("@/config/redis.config");
const { auditLogModel } = require("@/models/auditLog.model");
const { dbConnect } = require("@/database/db");

dbConnect()
  .then(() => {
    startSettingsInvalidationListener().catch((err) =>
      console.error("Settings invalidation listener failed:", err.message),
    );
    console.log("✅ Audit worker DB connected");
    startAuditWorker();
  })
  .catch((err) => {
    console.error("❌ Audit worker DB connection failed:", err.message);
    process.exit(1);
  });

function startAuditWorker() {
  const worker = new Worker(
    AUDIT_QUEUE_NAME,
    tenantJob(async (job) => {
      // insert via native driver — bypasses the immutability pre-hooks
      // and skips schema re-validation on a payload the service already shaped
      // tenantId is stamped explicitly: the native driver skips the tenant plugin
      const { tenantId, ...entry } = job.data;
      await auditLogModel.collection.insertOne({
        ...entry,
        ...(tenantId && { tenantId: toObjectId(tenantId) }),
        createdAt: entry.createdAt ? new Date(entry.createdAt) : new Date(),
        ...(entry.user?.id && {
          user: { ...entry.user, id: toObjectId(entry.user.id) },
        }),
        ...(entry.entity?.id && {
          entity: { ...entry.entity, id: toObjectId(entry.entity.id) },
        }),
      });
      return { logged: true };
    }),
    { connection, concurrency: 25 },
  );

  worker.on("failed", (job, err) => {
    console.error(`[audit.worker] job ${job?.id} failed:`, err.message);
  });

  worker.on("ready", () => {
    console.log("🚀 Audit worker is ready and listening for jobs...");
  });
}

function toObjectId(id) {
  const mongoose = require("mongoose");
  return mongoose.Types.ObjectId.isValid(id)
    ? new mongoose.Types.ObjectId(id)
    : id;
}
