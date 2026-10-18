const { waitFor } = require("./waitFor");

// Polls fn until it stops throwing (alias kept for the brief's naming)
const eventually = (fn, options) => waitFor(fn, options);

/**
 * Resolves when the BullMQ job reaches a final state.
 * Returns { state, job } — state is "completed" or "failed" (after every retry).
 */
const waitForJob = async (queue, jobId, { timeout = 25000, states = ["completed", "failed"] } = {}) =>
  waitFor(
    async () => {
      const job = await queue.getJob(jobId);
      if (!job) throw new Error(`job ${jobId} not found`);
      const state = await job.getState();
      if (!states.includes(state)) throw new Error(`job ${jobId} is ${state}`);
      return { state, job };
    },
    { timeout, interval: 25 },
  );

module.exports = { eventually, waitForJob, waitFor };
