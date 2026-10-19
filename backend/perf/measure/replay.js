/**
 * Phase B of one scenario (child process): replay every command captured in phase A against the
 * perf DB — explain("executionStats") + timing (3 warm-up + 20 runs, fewer when one run is slow).
 * Reads are executed for real (cursor fully drained with getMore). Writes are EXPLAINED ONLY
 * (explain never applies a write). Inserts are counted, not replayed.
 *
 *   node perf/measure/replay.js <scenarioId>
 */
const { assertPerfTarget, assertConnectedTarget } = require("../lib/guard");
const target = assertPerfTarget();

const fs = require("fs");
const path = require("path");
const { performance } = require("perf_hooks");
const { MongoClient } = require("mongodb");
const { EJSON } = require("bson");
const { summarizeExplain, pct } = require("../lib/measure");
const { RAW_DIR } = require("./scenarios");

const id = process.argv[2];
const MAX_TIME_MS = Number(process.env.PERF_MAX_TIME_MS || 60000);
const round = (n) => Math.round(n * 100) / 100;
const STRIP = ["lsid", "$clusterTime", "txnNumber", "startTransaction", "autocommit", "$db", "$readPreference", "readConcern", "writeConcern", "maxTimeMS", "apiVersion", "signature"];
const READ = new Set(["find", "aggregate", "count", "distinct"]);
const WRITE = new Set(["update", "delete", "findAndModify"]);

const clean = (cmd) => {
  const out = {};
  for (const [k, v] of Object.entries(cmd)) if (!STRIP.includes(k)) out[k] = v;
  return out;
};

// Stable key for dedupe: command minus volatile fields, long arrays summarised
const shapeKey = (origin, name, cmd) => {
  const s = EJSON.stringify(cmd, (k, v) => (Array.isArray(v) && v.length > 20 ? `[${v.length} items]` : v));
  return `${origin}|${name}|${s}`;
};

const drain = async (db, res, coll) => {
  let n = res.cursor ? res.cursor.firstBatch.length : 0;
  let cid = res.cursor ? res.cursor.id : 0;
  let more = 0;
  while (cid && !(typeof cid === "object" ? cid.isZero?.() : cid === 0)) {
    const r = await db.command({ getMore: cid, collection: coll });
    n += r.cursor.nextBatch.length;
    cid = r.cursor.id;
    more++;
  }
  return { n, getMores: more };
};

/** Extra stats the summary helper does not keep: $lookup collection scans and the input of blocking $sort. */
const lookupDetail = (ex) => {
  const out = [];
  const visit = (node) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach(visit);
    if (node.$lookup && (node.collectionScans != null || node.indexesUsed)) {
      out.push({ from: node.$lookup.from, collectionScans: node.collectionScans ?? null, indexesUsed: node.indexesUsed || [], docsExamined: node.totalDocsExamined ?? null, keysExamined: node.totalKeysExamined ?? null, nReturned: node.nReturned ?? null, ms: node.executionTimeMillisEstimate ?? null });
    }
    if (node.stage === "EQ_LOOKUP") out.push({ from: node.foreignCollection, strategy: node.strategy, indexName: node.indexName || null, sbe: true });
    for (const v of Object.values(node)) if (v && typeof v === "object") visit(v);
  };
  visit(ex);
  return out;
};

/** Docs that came out of the first ($match / cursor) stage — the denominator for docsExamined. */
const matchedDocs = (ex) => {
  if (Array.isArray(ex.stages) && ex.stages[0]?.$cursor) return ex.stages[0].nReturned ?? ex.stages[0].$cursor?.executionStats?.nReturned ?? null;
  return ex.executionStats?.nReturned ?? null;
};

/** Largest input fed into a blocking $sort / $group (aggregate) — explains in-memory work. */
const blockingInputs = (ex) => {
  const res = { sortInput: 0, groupInput: 0, facetInput: 0, usedDisk: false };
  if (!Array.isArray(ex.stages)) return res;
  let prev = null;
  for (const s of ex.stages) {
    const name = Object.keys(s).find((k) => k.startsWith("$"));
    const input = prev ?? 0;
    if (name === "$sort") res.sortInput = Math.max(res.sortInput, input);
    if (name === "$group") res.groupInput = Math.max(res.groupInput, input);
    if (name === "$facet") {
      res.facetInput = Math.max(res.facetInput, input);
      if (JSON.stringify(s.$facet).includes('"$sort"')) res.sortInput = Math.max(res.sortInput, input);
    }
    if (s.usedDisk) res.usedDisk = true;
    prev = s.nReturned ?? (name === "$cursor" ? s.$cursor?.executionStats?.nReturned : prev);
  }
  return res;
};

const main = async () => {
  const cmdFile = path.join(RAW_DIR, `${id}.commands.ndjson`);
  const outFile = path.join(RAW_DIR, `${id}.queries.json`);
  if (!fs.existsSync(cmdFile)) throw new Error(`no capture for ${id}`);
  const lines = fs.readFileSync(cmdFile, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));

  const client = new MongoClient(target.uri, { appName: "velor-perf-replay" });
  await client.connect();
  const db = client.db();
  assertConnectedTarget({ db, name: db.databaseName, host: target.hosts[0] });

  // Safety net: maxTimeMS is checked only at interrupt points; kill anything of ours running
  // KILL_AFTER_S past its limit so a slow pipeline can never keep loading the server.
  const KILL_AFTER_S = Math.ceil(MAX_TIME_MS / 1000) + 15;
  const killed = [];
  const timer = setInterval(async () => {
    try {
      const ops = await client.db("admin").command({ currentOp: 1, active: true, appName: "velor-perf-replay", secs_running: { $gte: KILL_AFTER_S } });
      for (const op of ops.inprog || []) {
        if (!String(op.ns || "").startsWith(`${db.databaseName}.`)) continue;
        killed.push({ opid: op.opid, secs: op.secs_running });
        await client.db("admin").command({ killOp: 1, op: op.opid });
      }
    } catch {}
  }, 2000);
  timer.unref();

  // Group the captured commands
  const groups = new Map();
  let inserts = 0;
  for (const l of lines) {
    if (l.cmd === "getMore") continue;
    const name = l.cmd;
    if (!l.body) continue;
    const cmd = clean(EJSON.parse(l.body, { relaxed: false }));
    if (name === "insert") {
      inserts++;
    }
    const key = shapeKey(l.origin, name, cmd);
    const g = groups.get(key);
    if (g) g.count++;
    else groups.set(key, { origin: l.origin, via: l.via, name, coll: cmd[name], cmd, count: 1, firstN: l.n });
  }
  // Collapse identical origin+name+coll groups that differ only by values (loops): keep the first, count all
  const byOrigin = new Map();
  for (const g of groups.values()) {
    const k = `${g.origin}|${g.name}|${g.coll}|${g.via}`;
    const prev = byOrigin.get(k);
    if (prev) {
      prev.count += g.count;
      prev.variants++;
    } else byOrigin.set(k, { ...g, variants: 1 });
  }

  // Commands whose server op the endpoint watchdog killed: proven slower than the endpoint limit.
  const epFile = path.join(RAW_DIR, `${id}.endpoint.json`);
  const ep = fs.existsSync(epFile) ? JSON.parse(fs.readFileSync(epFile, "utf8")) : null;
  const killedColls = new Set((ep?.killed || []).map((k) => String(k.ns).split(".").slice(1).join(".")));
  const lastReadOn = new Map();
  for (const g of byOrigin.values()) if (READ.has(g.name) && killedColls.has(g.coll) && (!lastReadOn.has(g.coll) || g.firstN > lastReadOn.get(g.coll).firstN)) lastReadOn.set(g.coll, g);
  const killedGroups = new Set(lastReadOn.values());

  const results = [];
  for (const g of byOrigin.values()) {
    const r = { origin: g.origin, via: g.via, command: g.name, collection: g.coll, callsPerRequest: g.count, distinctShapes: g.variants, firstSeq: g.firstN };
    r.commandText = EJSON.stringify(g.cmd, (k, v) => (Array.isArray(v) && v.length > 20 ? `[${v.length} items]` : typeof v === "string" && v.length > 200 ? v.slice(0, 200) + "…" : v), 0, { relaxed: true }).slice(0, 4000);
    if (!READ.has(g.name) && !WRITE.has(g.name)) {
      r.kind = g.name === "insert" ? "insert" : "other";
      results.push(r);
      continue;
    }
    r.kind = READ.has(g.name) ? "read" : "write";
    const inner = { ...g.cmd, maxTimeMS: MAX_TIME_MS };
    if (g.name === "update" && inner.updates?.length > 1) inner.updates = inner.updates.slice(0, 1);
    if (g.name === "delete" && inner.deletes?.length > 1) inner.deletes = inner.deletes.slice(0, 1);
    if (g.name === "aggregate" && !inner.cursor) inner.cursor = {};
    if (killedGroups.has(g)) {
      r.timedOut = true;
      r.timedOutBy = `endpoint watchdog killed it after ${ep.timeoutS}s`;
      try {
        const qp = await db.command({ explain: inner, verbosity: "queryPlanner", maxTimeMS: MAX_TIME_MS });
        const sum = summarizeExplain(qp);
        Object.assign(r, { plan: sum.plan, stages: [...new Set(sum.stages)].slice(0, 30), indexUsed: sum.indexUsed, inMemorySort: sum.inMemorySort, planOnly: true });
      } catch {}
      r.p50Ms = ep.timeoutS * 1000;
      r.p95Ms = ep.timeoutS * 1000;
      r.runs = 0;
      results.push(r);
      console.log(`[replay] ${id} ${g.name} ${g.coll} ${g.origin} x${g.count} plan=${r.plan || "-"} TIMEOUT (endpoint kill, plan only)`);
      continue;
    }
    try {
      const t0 = performance.now();
      const ex = await db.command({ explain: inner, verbosity: "executionStats", maxTimeMS: MAX_TIME_MS });
      r.explainWallMs = round(performance.now() - t0);
      const sum = summarizeExplain(ex);
      r.plan = sum.plan;
      r.stages = [...new Set(sum.stages)].slice(0, 30);
      r.indexUsed = sum.indexUsed;
      r.keysExamined = sum.keysExamined;
      r.docsExamined = sum.docsExamined;
      r.nReturned = sum.nReturned;
      r.inMemorySort = sum.inMemorySort;
      r.usedDisk = sum.usedDisk;
      r.explainMs = sum.explainMs;
      r.lookups = lookupDetail(ex);
      r.matched = matchedDocs(ex);
      r.blocking = blockingInputs(ex);
      if (r.blocking.usedDisk) r.usedDisk = true;
      // Lookup work counts as examined documents
      r.lookupDocsExamined = r.lookups.reduce((s, l) => s + (l.docsExamined || 0), 0);
      r.lookupCollScans = r.lookups.reduce((s, l) => s + (l.collectionScans || 0), 0);
    } catch (e) {
      r.explainError = `${e.codeName || e.code || ""} ${e.message}`.trim();
      r.timedOut = e.code === 50 || /time limit|MaxTimeMS|timed? ?out|interrupted|killed/i.test(e.message);
      // Still record the winning plan (queryPlanner explain does not execute the query)
      try {
        const qp = await db.command({ explain: inner, verbosity: "queryPlanner", maxTimeMS: MAX_TIME_MS });
        const sum = summarizeExplain(qp);
        r.plan = sum.plan;
        r.stages = [...new Set(sum.stages)].slice(0, 30);
        r.indexUsed = sum.indexUsed;
        r.inMemorySort = sum.inMemorySort;
        r.planOnly = true;
      } catch {}
    }

    if (r.kind === "read" && !r.timedOut) {
      const run = async () => {
        const res = await db.command({ ...g.cmd, maxTimeMS: MAX_TIME_MS });
        if (res.cursor) return drain(db, res, g.coll);
        return { n: res.n ?? res.values?.length ?? 0, getMores: 0 };
      };
      try {
        const t0 = performance.now();
        const firstRun = await run();
        const first = performance.now() - t0;
        r.rows = firstRun.n;
        r.getMores = firstRun.getMores;
        let warmup = 2;
        let runs = 20;
        if (first > 10000) {
          warmup = 0;
          runs = 1;
        } else if (first > 2000) {
          warmup = 0;
          runs = 3;
        } else if (first > 500) {
          warmup = 1;
          runs = 10;
        }
        const samples = [];
        for (let i = 0; i < warmup + runs; i++) {
          const t = performance.now();
          await run();
          if (i >= warmup) samples.push(performance.now() - t);
        }
        if (!samples.length) samples.push(first);
        samples.sort((a, b) => a - b);
        r.p50Ms = round(pct(samples, 50));
        r.p95Ms = round(pct(samples, 95));
        r.runs = samples.length;
        r.warmup = warmup + 1;
        r.firstMs = round(first);
      } catch (e) {
        r.runError = `${e.codeName || e.code || ""} ${e.message}`.trim();
        if (e.code === 50 || /time limit|MaxTimeMS|timed? ?out|interrupted|killed/i.test(e.message)) r.timedOut = true;
      }
    }
    if (r.timedOut) {
      r.p50Ms = MAX_TIME_MS;
      r.p95Ms = MAX_TIME_MS;
      r.runs = 0;
    }
    results.push(r);
    console.log(`[replay] ${id} ${g.name} ${g.coll} ${g.origin} x${g.count} plan=${r.plan || "-"} docs=${r.docsExamined ?? "-"} ret=${r.nReturned ?? "-"} p95=${r.p95Ms ?? "-"}${r.timedOut ? " TIMEOUT" : ""}${r.explainError ? " ERR " + r.explainError.slice(0, 120) : ""}`);
  }
  clearInterval(timer);
  fs.writeFileSync(outFile, JSON.stringify({ id, maxTimeMS: MAX_TIME_MS, killed, inserts, commands: lines.length, queries: results, runAt: new Date().toISOString() }, null, 1));
  await client.close();
};

main().catch((e) => {
  console.error(`[replay] ${id} FAILED`, e);
  process.exit(1);
});
