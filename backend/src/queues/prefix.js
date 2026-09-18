const { nodeEnv } = require("../config/nodeEnv");

/**
 * The BullMQ key prefix, which is what keeps one environment's jobs out of
 * another's queue.
 *
 * Queues and workers find each other through Redis, not through the database,
 * so a test run and a live server pointed at the same Redis are the same queue.
 * A job enqueued by a test is then picked up by whatever worker is running —
 * and that worker writes it to the database in *its* `.env`. That is how test
 * fixtures end up in a production collection, and nothing in the test output
 * shows it happening.
 *
 * Splitting the prefix by NODE_ENV means a test's jobs simply have nowhere to
 * be delivered: no live worker is listening on `bull-test`.
 */
// Read at call time rather than captured at import: a process that sets
// NODE_ENV after requiring a queue would otherwise get the wrong keyspace.
const queuePrefix = () => `bull-${nodeEnv()}`;

// Every queue and its worker must pass the same prefix, or the jobs are orphaned
module.exports = { queuePrefix };
