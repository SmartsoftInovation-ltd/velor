const { Queue } = require("bullmq");
const { connection } = require("@/config/redis.config");
const { tenantAwareQueue } = require("@/tenancy/queue");

const IMAGE_QUEUE_NAME = "image-upload";

const imageQueue = tenantAwareQueue(new Queue(IMAGE_QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: 1000,
    removeOnFail: 2000,
  },
}));

module.exports = { imageQueue, IMAGE_QUEUE_NAME };
