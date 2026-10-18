const { connectTestDb, clearTestDb, disconnectTestDb } = require("./db");
const { flushRedis, closeRedis, closeAppRedis } = require("./redis");
const { setSettingsEnv } = require("./settings");

/**
 * Lifecycle for BullMQ worker tests: real Mongo, real Redis (this Jest
 * worker's own database), the real processor, no app.
 *
 *   const env = useWorkerEnv();
 *   const worker = env.track(startAuditWorker());   // closed after each test
 *
 * Each test starts with an empty Redis database (no leftover jobs) and an empty
 * Mongo database; every worker started through `track` is closed afterwards.
 */
const useWorkerEnv = ({ quiet = true } = {}) => {
  const workers = [];
  const env = {
    track: (worker) => {
      workers.push(worker);
      return worker;
    },
  };

  beforeAll(async () => {
    setSettingsEnv();
    await connectTestDb();
    require("../../src/settings/settings.service").setSettingsPublisher(async () => {});
    if (quiet) {
      jest.spyOn(console, "log").mockImplementation(() => {});
      jest.spyOn(console, "error").mockImplementation(() => {});
      jest.spyOn(console, "warn").mockImplementation(() => {});
    }
  });

  beforeEach(async () => {
    delete process.env.TENANCY_MODE;
    require("../../src/settings/settings.service").clearSettingsCache();
    await flushRedis();
  });

  afterEach(async () => {
    await Promise.all(workers.splice(0).map((w) => w.close()));
    await clearTestDb();
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    for (const mod of ["audit", "sms", "email", "image"]) {
      try {
        await require(`../../src/queues/${mod}.queue`)[`${mod}Queue`].close();
      } catch {
        // queue never loaded in this file
      }
    }
    await closeAppRedis();
    await closeRedis();
    await disconnectTestDb();
  });

  return env;
};

module.exports = { useWorkerEnv };
