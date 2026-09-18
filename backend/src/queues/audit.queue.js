const { Queue } = require("bullmq");
const { connection } = require("@/config/redis.config");
const { tenantAwareQueue } = require("@/tenancy/queue");
const { queuePrefix } = require("./prefix");

const AUDIT_QUEUE_NAME = "audit-log";

const auditQueue = tenantAwareQueue(new Queue(AUDIT_QUEUE_NAME, {
  prefix: queuePrefix(),
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: 500,
    removeOnFail: 5000,
  },
}));

module.exports = { auditQueue, AUDIT_QUEUE_NAME };
