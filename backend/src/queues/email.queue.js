const { Queue } = require("bullmq");
const { connection } = require("@/config/redis.config");
const { tenantAwareQueue } = require("@/tenancy/queue");
const { queuePrefix } = require("./prefix");

const EMAIL_QUEUE_NAME = "email";

const emailQueue = tenantAwareQueue(new Queue(EMAIL_QUEUE_NAME, {
  prefix: queuePrefix(),
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 3000 },
    removeOnComplete: 500,
    removeOnFail: 1000,
  },
}));

module.exports = { emailQueue, EMAIL_QUEUE_NAME };
