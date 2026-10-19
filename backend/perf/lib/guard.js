/**
 * Phase 2 safety guard. Call assertPerfTarget() at the start of EVERY perf script.
 *
 * Refuses to run unless:
 *   - PERF_MONGO_URI is set (loaded from .env.perf, overriding anything in .env)
 *   - every host in the URI is local (localhost / 127.0.0.1 / ::1 / a local perf container name)
 *   - the database name contains "perf"
 *   - PERF_REDIS_URL (if set) is local too
 * After connecting, assertConnectedTarget(conn) re-checks the database name the
 * driver actually uses, so a URI typo can never land on dev/staging/production.
 */
const path = require("path");
const dotenv = require("dotenv");

const ENV_FILE = path.join(__dirname, "..", "..", ".env.perf");
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
// Local Docker service / container names from docker-compose.perf.yml
const LOCAL_CONTAINERS = new Set(["mongo-perf", "velor-mongo-perf", "redis-perf", "velor-redis-perf"]);

class PerfGuardError extends Error {
  constructor(msg) {
    super(`[perf-guard] REFUSING TO RUN: ${msg}`);
    this.name = "PerfGuardError";
  }
}

const loadPerfEnv = () => {
  // override: true so values from .env (remote DATABASE_URL etc.) never win
  dotenv.config({ path: ENV_FILE, override: true });
};

const parseMongoUri = (uri) => {
  const m = /^mongodb(\+srv)?:\/\/(?:[^@/]*@)?([^/?]+)(?:\/([^?]*))?(?:\?.*)?$/.exec(uri || "");
  if (!m) throw new PerfGuardError(`cannot parse PERF_MONGO_URI`);
  if (m[1]) throw new PerfGuardError("mongodb+srv URIs are remote by definition");
  const hosts = m[2].split(",").map((h) => {
    if (h.startsWith("[")) return h.slice(0, h.indexOf("]") + 1);
    return h.split(":")[0];
  });
  return { hosts, dbName: decodeURIComponent(m[3] || "") };
};

const isLocalHost = (h) => LOCAL_HOSTS.has(h.toLowerCase()) || LOCAL_CONTAINERS.has(h.toLowerCase());

const assertPerfTarget = () => {
  loadPerfEnv();
  const uri = process.env.PERF_MONGO_URI;
  if (!uri) throw new PerfGuardError("PERF_MONGO_URI is not set (expected in .env.perf)");
  const { hosts, dbName } = parseMongoUri(uri);
  const bad = hosts.filter((h) => !isLocalHost(h));
  if (bad.length) throw new PerfGuardError(`non-local Mongo host(s): ${bad.join(", ")}`);
  if (!dbName) throw new PerfGuardError("PERF_MONGO_URI has no database name");
  if (!/perf/i.test(dbName)) throw new PerfGuardError(`database name "${dbName}" does not contain "perf"`);

  const redisUrl = process.env.PERF_REDIS_URL;
  if (redisUrl) {
    let host;
    try {
      host = new URL(redisUrl).hostname;
    } catch {
      throw new PerfGuardError("cannot parse PERF_REDIS_URL");
    }
    if (!isLocalHost(host)) throw new PerfGuardError(`non-local Redis host: ${host}`);
  }

  // Point the app's own config at the perf targets BEFORE any src/ module is required,
  // so nothing in src/ can reach the DATABASE_URL / REDIS_URL from .env.
  process.env.DATABASE_URL = uri;
  if (redisUrl) process.env.REDIS_URL = redisUrl;
  return { uri, hosts, dbName, redisUrl };
};

const assertConnectedTarget = (conn) => {
  const name = conn?.db?.databaseName || conn?.name;
  if (!name || !/perf/i.test(name)) throw new PerfGuardError(`connected database "${name}" does not contain "perf"`);
  const host = conn.host || "";
  if (host && !isLocalHost(host)) throw new PerfGuardError(`connected to non-local host ${host}`);
  return name;
};

module.exports = { assertPerfTarget, assertConnectedTarget, parseMongoUri, PerfGuardError };

if (require.main === module) {
  try {
    const t = assertPerfTarget();
    console.log(`[perf-guard] OK hosts=${t.hosts.join(",")} db=${t.dbName} redis=${t.redisUrl || "-"}`);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
