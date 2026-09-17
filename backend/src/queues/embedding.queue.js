const { Queue } = require("bullmq");
const { connection } = require("@/config/redis.config");
const { tenantAwareQueue } = require("@/tenancy/queue");

const EMBEDDING_QUEUE_NAME = "embedding";

const embeddingQueue = tenantAwareQueue(new Queue(EMBEDDING_QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 3000 },
    removeOnComplete: 500,
    removeOnFail: 1000,
  },
}));

module.exports = { embeddingQueue, EMBEDDING_QUEUE_NAME };
