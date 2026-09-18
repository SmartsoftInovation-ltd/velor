const path = require("path");
const fs = require("fs");

/**
 * Queues and their workers find each other through Redis, not the database.
 *
 * A test run and a live server pointed at the same Redis share the same queue,
 * so a job a test enqueues is delivered to whatever worker happens to be
 * running — and that worker writes it to the database in *its* `.env`. This is
 * not hypothetical: it is how test fixtures (`staff@shop.test`) reached the
 * live `auditlogs` collection, invisible in the test output because the test
 * itself passed.
 *
 * Two things must hold, and both are checked here from the source rather than
 * by starting Redis: the prefix must differ per environment, and every queue
 * and worker must actually pass it.
 */

const { queuePrefix } = require("../../src/queues/prefix");

const load = (env) => {
  const saved = process.env.NODE_ENV;
  process.env.NODE_ENV = env;
  try {
    return queuePrefix();
  } finally {
    process.env.NODE_ENV = saved;
  }
};

const sourcesIn = (dir) => {
  const full = path.join(__dirname, "../..", dir);
  return fs
    .readdirSync(full)
    .filter((name) => name.endsWith(".js"))
    .map((name) => ({ name, source: fs.readFileSync(path.join(full, name), "utf8") }));
};

describe("background job queues are separated by environment", () => {
  it("gives each environment its own Redis keyspace", () => {
    expect(load("test")).toBe("bull-test");
    expect(load("production")).toBe("bull-production");
    expect(load("development")).toBe("bull-development");

    // The whole point: a test's jobs must be invisible to a live worker
    expect(load("test")).not.toBe(load("production"));
  });

  it("every queue passes the prefix", () => {
    const queues = sourcesIn("src/queues").filter(({ name }) => name.endsWith(".queue.js"));

    expect(queues.length).toBeGreaterThan(0);
    for (const { name, source } of queues) {
      expect(`${name}: ${source.includes("prefix: queuePrefix()")}`).toBe(`${name}: true`);
    }
  });

  // A worker without the prefix listens on keys nothing writes to, so its jobs
  // silently never run — the opposite failure, equally quiet.
  it("every worker passes the same prefix", () => {
    const workers = sourcesIn("src/workers").filter(({ name }) => name.endsWith(".worker.js"));

    expect(workers.length).toBeGreaterThan(0);
    for (const { name, source } of workers) {
      expect(`${name}: ${source.includes("prefix: queuePrefix()")}`).toBe(`${name}: true`);
    }
  });
});
