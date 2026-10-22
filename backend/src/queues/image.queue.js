const { Queue } = require("bullmq");
const { connection } = require("@/config/redis.config");
const { tenantAwareQueue } = require("@/tenancy/queue");
const { queuePrefix } = require("./prefix");
const { markHandedOff } = require("./uploadHandoff");

const IMAGE_QUEUE_NAME = "image-upload";

const imageQueue = tenantAwareQueue(new Queue(IMAGE_QUEUE_NAME, {
  prefix: queuePrefix(),
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: 1000,
    removeOnFail: 2000,
  },
}));

// Queuing a file hands it to the worker; the upload middleware stops managing it
const add = imageQueue.add.bind(imageQueue);
imageQueue.add = async (name, data, opts) => {
  const job = await add(name, data, opts);
  markHandedOff(data?.localPath);
  return job;
};
const addBulk = imageQueue.addBulk.bind(imageQueue);
imageQueue.addBulk = async (jobs) => {
  const added = await addBulk(jobs);
  jobs.forEach((job) => markHandedOff(job.data?.localPath));
  return added;
};

module.exports = { imageQueue, IMAGE_QUEUE_NAME };
