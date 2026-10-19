/**
 * Phase A of one scenario (child process): boot the real Express app in-process against the perf DB,
 * call the endpoint once with command capture (cache forced to miss), then time it.
 *
 *   node perf/measure/endpoint.js <scenarioId>
 *
 * Writes reports/phase2/measure/raw/<id>.commands.ndjson and <id>.endpoint.json.
 */
const { assertPerfTarget } = require("../lib/guard");
const target = assertPerfTarget();

const fs = require("fs");
const path = require("path");
const { performance } = require("perf_hooks");

// App secrets for in-process token signing (perf only; never the .env values)
process.env.ACCESS_TOKEN_SECRET = "perf-access-secret-perf-access-secret-000001";
process.env.REFRESH_TOKEN_SCCERET = "perf-refresh-secret-perf-refresh-secret-0001";
process.env.RATE_LIMIT_MAX = "1000000";

require("module-alias/register");
const mongoose = require("mongoose");
const capture = require("./capture");
capture.install(mongoose);

const { MongoClient } = require("mongodb");
const { assertConnectedTarget } = require("../lib/guard");
const { pct } = require("../lib/measure");
const { RAW_DIR, loadScenario, buildContext } = require("./scenarios");

const id = process.argv[2];
const ENDPOINT_TIMEOUT_S = Number(process.env.PERF_ENDPOINT_TIMEOUT_S || 60);
const round = (n) => Math.round(n * 100) / 100;

const main = async () => {
  fs.mkdirSync(RAW_DIR, { recursive: true });
  const cmdFile = path.join(RAW_DIR, `${id}.commands.ndjson`);
  const outFile = path.join(RAW_DIR, `${id}.endpoint.json`);
  fs.rmSync(cmdFile, { force: true });

  await mongoose.connect(target.uri, { autoIndex: false, monitorCommands: true, appName: "velor-perf-app", maxPoolSize: 20 });
  assertConnectedTarget(mongoose.connection);
  const rec = capture.createRecorder(mongoose.connection.getClient(), { file: cmdFile });

  // Watchdog on its own client: kills app ops running longer than the endpoint timeout.
  const wd = new MongoClient(target.uri, { appName: "velor-perf-watchdog" });
  await wd.connect();
  if (!/perf/i.test(wd.db().databaseName)) throw new Error("watchdog not on perf db");
  const killed = [];
  const timer = setInterval(async () => {
    try {
      const ops = await wd.db("admin").command({ currentOp: 1, active: true, appName: "velor-perf-app", secs_running: { $gte: ENDPOINT_TIMEOUT_S } });
      for (const op of ops.inprog || []) {
        if (!String(op.ns || "").startsWith(`${target.dbName}.`)) continue;
        killed.push({ opid: op.opid, ns: op.ns, secs: op.secs_running, op: op.op });
        await wd.db("admin").command({ killOp: 1, op: op.opid });
      }
    } catch {}
  }, 1000);
  timer.unref();

  const { cache } = require("../../src/config/redis.config");
  const cacheStats = capture.instrumentCache(cache);
  const { server } = require("../../src/app");
  const request = require("supertest");

  // Let Mongoose finish its lazy per-model collection creation before anything is measured
  await Promise.all(mongoose.modelNames().map((n) => mongoose.model(n).init().catch(() => {})));
  const ctx = await buildContext(mongoose);
  const sc = loadScenario(id, ctx);
  const token = ctx.token;

  const call = async () => {
    let r = request(server)[sc.method.toLowerCase()](`/api/v1${sc.url}`)
      .set("Authorization", `Bearer ${token}`)
      .set("x-tenant", ctx.tenantSlug)
      .timeout({ response: (ENDPOINT_TIMEOUT_S + 30) * 1000 });
    const body = typeof sc.body === "function" ? sc.body(ctx) : sc.body;
    if (body) r = r.send(body);
    return r;
  };

  const runOnce = async (tag) => {
    rec.reset(tag);
    rec.active = true;
    const t = performance.now();
    let res;
    let error = null;
    try {
      res = await call();
    } catch (e) {
      error = e.message;
    }
    const ms = performance.now() - t;
    rec.active = false;
    // Let late commands (fire-and-forget audit, cache writes) land before the next run
    await new Promise((r) => setTimeout(r, 30));
    return {
      ms,
      status: res?.status ?? null,
      bytes: res?.text ? Buffer.byteLength(res.text) : res?.body ? Buffer.byteLength(JSON.stringify(res.body)) : 0,
      rows: res?.body?.data ? (Array.isArray(res.body.data) ? res.body.data.length : null) : null,
      message: res && res.status >= 400 ? res.body?.message : undefined,
      roundTrips: rec.count,
      byCommand: { ...rec.byCommand },
      events: rec.events.map((e) => ({ cmd: e.cmd, coll: e.coll, origin: e.origin, via: e.via })),
      error,
    };
  };

  if (sc.before) await sc.before(ctx);
  cacheStats.forceMiss = sc.cache !== "hit";
  const first = await runOnce("capture");
  const timedOut = killed.length > 0 || /timeout/i.test(first.error || "");

  // Adaptive run count: the protocol (3 warm-up + 20) unless one call is slow.
  let warmup = 3;
  let runs = 20;
  if (sc.runs) runs = sc.runs;
  if (first.ms > 20000 || timedOut) {
    warmup = 0;
    runs = 0;
  } else if (first.ms > 5000) {
    warmup = 0;
    runs = 2;
  } else if (first.ms > 1000) {
    warmup = 1;
    runs = 5;
  } else if (first.ms > 300) {
    warmup = 1;
    runs = 10;
  }
  const samples = [];
  const trips = [];
  let lastStatus = first.status;
  for (let i = 0; i < warmup + runs; i++) {
    if (sc.beforeEach) await sc.beforeEach(ctx, i);
    const r = await runOnce("time");
    lastStatus = r.status;
    if (i >= warmup) {
      samples.push(r.ms);
      trips.push(r.roundTrips);
    }
  }
  samples.sort((a, b) => a - b);
  const all = samples.length ? samples : [first.ms];
  const out = {
    id,
    endpoint: `${sc.method} /api/v1${sc.url.split("?")[0]}`,
    url: sc.url,
    scenario: sc.scenario,
    body: typeof sc.body === "function" ? sc.body(ctx) : sc.body || null,
    cacheMode: cacheStats.forceMiss ? "forced-miss" : "normal",
    first: { ...first, events: undefined },
    firstEvents: first.events,
    p50Ms: round(pct(all, 50)),
    p95Ms: round(pct(all, 95)),
    minMs: round(all[0]),
    maxMs: round(all.at(-1)),
    runs: samples.length,
    warmup,
    roundTrips: Math.max(first.roundTrips, ...trips),
    roundTripsMin: Math.min(first.roundTrips, ...(trips.length ? trips : [first.roundTrips])),
    lastStatus,
    timedOut,
    killed,
    timeoutS: ENDPOINT_TIMEOUT_S,
    rssMB: Math.round(process.memoryUsage().rss / 1048576),
    runAt: new Date().toISOString(),
  };
  fs.writeFileSync(outFile, JSON.stringify(out, null, 1));
  console.log(`[endpoint] ${id} status=${first.status} first=${round(first.ms)}ms p50=${out.p50Ms} p95=${out.p95Ms} runs=${out.runs} trips=${out.roundTrips} bytes=${first.bytes}${timedOut ? " TIMEOUT" : ""}`);
  clearInterval(timer);
  await wd.close();
  process.exit(0);
};

main().catch((e) => {
  console.error(`[endpoint] ${id} FAILED`, e);
  process.exit(1);
});
