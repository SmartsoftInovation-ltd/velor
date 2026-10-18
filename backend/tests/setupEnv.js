const fs = require("fs");
const path = require("path");

process.env.NODE_ENV = "test";

// Dummy test values (tests/setup/test.env). The real backend/.env is never read:
// `dotenv` is mapped to tests/mocks/dotenv.js in jest.config.js.
const testEnv = fs.readFileSync(path.join(__dirname, "setup/test.env"), "utf8");
for (const line of testEnv.split(/\r?\n/)) {
  const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2];
}

// Each Jest worker gets its own database index on the private test Redis
// (tests/setup/redisServer.js), so FLUSHDB in one file never hits another.
if (process.env.REDIS_TEST_URL) {
  process.env.REDIS_URL = `${process.env.REDIS_TEST_URL}/${Number(process.env.JEST_WORKER_ID || 1) % 32}`;
}
