const { getTenantId, runForTenant } = require("./context");

// Background jobs must run for the tenant that enqueued them.

const withTenant = (data = {}) => {
  const tenantId = data.tenantId || getTenantId()?.toString();
  return tenantId ? { ...data, tenantId } : data;
};

// Stamps the current tenant on every job added to a BullMQ queue
const tenantAwareQueue = (queue) => {
  const add = queue.add.bind(queue);
  const addBulk = queue.addBulk.bind(queue);
  queue.add = (name, data, opts) => add(name, withTenant(data), opts);
  queue.addBulk = (jobs) => addBulk(jobs.map((job) => ({ ...job, data: withTenant(job.data) })));
  return queue;
};

// Wraps a worker processor so it runs inside the job's tenant context
const tenantJob = (processor) => async (job) => {
  const tenantId = job.data?.tenantId;
  if (tenantId) return runForTenant(tenantId, () => processor(job));
  if (process.env.TENANCY_MODE === "strict") {
    throw new Error(`Job ${job.id} has no tenantId`);
  }
  return processor(job);
};

module.exports = { tenantAwareQueue, tenantJob };
