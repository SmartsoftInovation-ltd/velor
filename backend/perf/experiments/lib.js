/**
 * MODE: experiment helpers. Perf DB only (guard at require time).
 * - Every experimental index is named "perfexp_*" so the restore step can never touch app indexes.
 * - Reads: explain(executionStats) + timing (first run, then adaptive repeats), maxTimeMS + killOp watchdog.
 * - Writes: insert/update N docs cloned from a real tenant document, timed per op, then removed by _id.
 */
const { assertPerfTarget, assertConnectedTarget } = require("../lib/guard");
const target = assertPerfTarget();

const fs = require("fs");
const path = require("path");
const { performance } = require("perf_hooks");
const { MongoClient, ObjectId } = require("mongodb");
const { EJSON } = require("bson");
const { summarizeExplain, pct } = require("../lib/measure");

const BACKEND = path.join(__dirname, "..", "..");
const RAW = path.join(BACKEND, "reports", "phase2", "measure", "raw");
const EXP_DIR = path.join(BACKEND, "reports", "phase2", "experiments");
const MAX_TIME_MS = Number(process.env.PERF_MAX_TIME_MS || 60000);
const round = (n) => (n == null ? null : Math.round(n * 100) / 100);
const STRIP = ["lsid", "$clusterTime", "txnNumber", "startTransaction", "autocommit", "$db", "$readPreference", "readConcern", "writeConcern", "maxTimeMS"];

let client, db, timer;
const connect = async () => {
  if (db) return db;
  client = new MongoClient(target.uri, { appName: "velor-perf-exp" });
  await client.connect();
  db = client.db();
  assertConnectedTarget({ db, name: db.databaseName, host: target.hosts[0] });
  const killAfter = Math.ceil(MAX_TIME_MS / 1000) + 15;
  timer = setInterval(async () => {
    try {
      const ops = await client.db("admin").command({ currentOp: 1, active: true, appName: "velor-perf-exp", secs_running: { $gte: killAfter } });
      for (const op of ops.inprog || []) if (String(op.ns || "").startsWith(`${db.databaseName}.`)) await client.db("admin").command({ killOp: 1, op: op.opid });
    } catch {}
  }, 2000);
  timer.unref();
  return db;
};
const close = async () => {
  clearInterval(timer);
  await client?.close();
};

/** First captured command of a scenario at a src origin (exact file:line). */
const captured = (scenarioId, origin, cmdName) => {
  const file = path.join(RAW, `${scenarioId}.commands.ndjson`);
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    if (!line) continue;
    const d = JSON.parse(line);
    if (d.origin === origin && d.body && (!cmdName || d.cmd === cmdName)) {
      const cmd = EJSON.parse(d.body, { relaxed: false });
      for (const k of STRIP) delete cmd[k];
      return cmd;
    }
  }
  throw new Error(`no captured command ${scenarioId} ${origin}`);
};

const drain = async (res, coll) => {
  let n = res.cursor ? res.cursor.firstBatch.length : res.n ?? res.values?.length ?? 0;
  let cid = res.cursor?.id;
  const docs = res.cursor ? [...res.cursor.firstBatch] : [];
  const keep = docs.length < 5000;
  while (cid && !(typeof cid === "object" ? cid.isZero?.() : cid === 0)) {
    const r = await db.command({ getMore: cid, collection: coll });
    n += r.cursor.nextBatch.length;
    if (keep && docs.length < 5000) docs.push(...r.cursor.nextBatch);
    cid = r.cursor.id;
  }
  return { n, docs };
};

const isTimeout = (e) => e.code === 50 || /time limit|MaxTimeMS|interrupted|killed/i.test(e.message || "");

/** Docs examined across the whole explain tree, including $lookup sub-queries. */
const lookupDocs = (ex) => {
  let docs = 0;
  let keys = 0;
  const visit = (node) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach(visit);
    if (node.$lookup && node.totalDocsExamined != null) {
      docs += node.totalDocsExamined;
      keys += node.totalKeysExamined || 0;
    }
    for (const v of Object.values(node)) if (v && typeof v === "object") visit(v);
  };
  visit(ex);
  return { docs, keys };
};

/** explain + timing of one raw command (find / aggregate / count / distinct). */
const measureCmd = async (cmd, { runs: forcedRuns } = {}) => {
  await connect();
  const coll = cmd.find || cmd.aggregate || cmd.count || cmd.distinct;
  const r = {};
  const inner = { ...cmd, maxTimeMS: MAX_TIME_MS };
  if (inner.aggregate && !inner.cursor) inner.cursor = {};
  try {
    const ex = await db.command({ explain: inner, verbosity: "executionStats", maxTimeMS: MAX_TIME_MS });
    const s = summarizeExplain(ex);
    const lk = lookupDocs(ex);
    Object.assign(r, { plan: s.plan, indexUsed: s.indexUsed, keysExamined: s.keysExamined, docsExamined: s.docsExamined, nReturned: s.nReturned, inMemorySort: s.inMemorySort, usedDisk: s.usedDisk, explainMs: s.explainMs, lookupDocsExamined: lk.docs, lookupKeysExamined: lk.keys });
  } catch (e) {
    if (!isTimeout(e)) throw e;
    r.timedOut = true;
    try {
      const qp = await db.command({ explain: inner, verbosity: "queryPlanner", maxTimeMS: MAX_TIME_MS });
      const s = summarizeExplain(qp);
      Object.assign(r, { plan: s.plan, indexUsed: s.indexUsed, inMemorySort: s.inMemorySort, planOnly: true });
    } catch {}
  }
  if (r.timedOut) return { ...r, p50Ms: MAX_TIME_MS, p95Ms: MAX_TIME_MS, runs: 0 };
  const run = async () => drain(await db.command(inner), coll);
  const t0 = performance.now();
  let first;
  try {
    first = await run();
  } catch (e) {
    if (!isTimeout(e)) throw e;
    return { ...r, timedOut: true, p50Ms: MAX_TIME_MS, p95Ms: MAX_TIME_MS, runs: 0 };
  }
  const firstMs = performance.now() - t0;
  let warm = 2;
  let runs = forcedRuns || 20;
  if (firstMs > 10000) [warm, runs] = [0, 1];
  else if (firstMs > 2000) [warm, runs] = [0, 3];
  else if (firstMs > 500) [warm, runs] = [1, 10];
  const s = [];
  for (let i = 0; i < warm + runs; i++) {
    const t = performance.now();
    await run();
    if (i >= warm) s.push(performance.now() - t);
  }
  s.sort((a, b) => a - b);
  return { ...r, rows: first.n, sample: first.docs, p50Ms: round(pct(s, 50)), p95Ms: round(pct(s, 95)), runs: s.length, firstMs: round(firstMs) };
};

/** Several commands issued together (e.g. rows + totals in parallel): wall-clock timing + each explain. */
const measureParallel = async (cmds) => {
  await connect();
  const parts = [];
  for (const c of cmds) parts.push(await measureCmd(c, { runs: 3 }));
  if (parts.some((p) => p.timedOut)) return { parts, timedOut: true, p50Ms: MAX_TIME_MS, p95Ms: MAX_TIME_MS };
  const run = () => Promise.all(cmds.map(async (c) => drain(await db.command({ ...c, maxTimeMS: MAX_TIME_MS, ...(c.aggregate && !c.cursor ? { cursor: {} } : {}) }), c.find || c.aggregate)));
  const t0 = performance.now();
  await run();
  const firstMs = performance.now() - t0;
  let [warm, runs] = firstMs > 2000 ? [0, 3] : firstMs > 500 ? [1, 10] : [2, 20];
  const s = [];
  for (let i = 0; i < warm + runs; i++) {
    const t = performance.now();
    await run();
    if (i >= warm) s.push(performance.now() - t);
  }
  s.sort((a, b) => a - b);
  const sum = (k) => parts.reduce((a, p) => a + (p[k] || 0), 0);
  return { parts, plan: parts.map((p) => p.plan).join(" || "), indexUsed: [...new Set(parts.map((p) => p.indexUsed).filter(Boolean))].join(","), keysExamined: sum("keysExamined"), docsExamined: sum("docsExamined"), lookupDocsExamined: sum("lookupDocsExamined"), nReturned: parts[0].nReturned, inMemorySort: parts.some((p) => p.inMemorySort), usedDisk: parts.some((p) => p.usedDisk), p50Ms: round(pct(s, 50)), p95Ms: round(pct(s, 95)), runs: s.length };
};

// ---------------- indexes ----------------
const idxName = (key) => "perfexp_" + Object.entries(key).map(([k, v]) => `${k}_${v}`).join("_").replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 100);

const indexSizeMB = async (coll, name) => {
  const s = await db.command({ collStats: coll });
  return round(((s.indexSizes || {})[name] || 0) / 1048576);
};

const createIndex = async (coll, key, opts = {}) => {
  await connect();
  const name = opts.name || idxName(key);
  const existing = (await db.collection(coll).indexes()).find((i) => i.name === name);
  const t0 = performance.now();
  if (!existing) await db.collection(coll).createIndex(key, { ...opts, name });
  const buildMs = existing ? null : round(performance.now() - t0);
  return { coll, key, name, buildMs, sizeMB: await indexSizeMB(coll, name), options: Object.keys(opts).length ? opts : undefined };
};

const dropIndex = async (coll, name) => {
  if (!name.startsWith("perfexp_")) throw new Error(`refusing to drop non-experimental index ${name}`);
  await connect();
  await db.collection(coll).dropIndex(name).catch((e) => {
    if (e.codeName !== "IndexNotFound") throw e;
  });
};

const dropAllExperimental = async () => {
  await connect();
  const dropped = [];
  for (const c of await db.listCollections({}, { nameOnly: true }).toArray()) {
    if (c.type === "view") continue;
    for (const i of await db.collection(c.name).indexes()) {
      if (i.name.startsWith("perfexp_")) {
        await db.collection(c.name).dropIndex(i.name);
        dropped.push(`${c.name}.${i.name}`);
      }
    }
  }
  return dropped;
};

const snapshotIndexes = async () => {
  await connect();
  const out = {};
  for (const c of await db.listCollections({}, { nameOnly: true }).toArray()) {
    if (c.type === "view") continue;
    out[c.name] = (await db.collection(c.name).indexes()).map((i) => i.name).sort();
  }
  return out;
};

// ---------------- write cost ----------------
/**
 * Insert N docs one by one (insertOne, as the app does per sale), then update each one by _id
 * ($set of non-indexed money fields + updatedAt, the common sale edit), then delete them (untimed).
 * Unique-indexed fields are made unique per clone. Returns per-op p50/p95 and ops/sec.
 */
const writeCost = async (coll, tenantId, { n = 10000, mutate } = {}) => {
  await connect();
  const c = db.collection(coll);
  const tpl = await c.find({ tenantId: new ObjectId(tenantId) }).sort({ _id: -1 }).limit(1).next();
  if (!tpl) throw new Error(`no template doc in ${coll}`);
  const uniques = (await c.indexes()).filter((i) => i.unique && i.name !== "_id_").flatMap((i) => Object.keys(i.key)).filter((k) => k !== "tenantId");
  const ids = [];
  const lat = [];
  const t0 = performance.now();
  for (let i = 0; i < n; i++) {
    const doc = EJSON.parse(EJSON.stringify(tpl, { relaxed: false }), { relaxed: false });
    doc._id = new ObjectId();
    doc.__perfExp = true;
    for (const u of uniques) {
      const parts = u.split(".");
      let o = doc;
      for (const p of parts.slice(0, -1)) o = o[p] = o[p] || {};
      o[parts.at(-1)] = `PERFEXP-${doc._id}`;
    }
    if (mutate) mutate(doc, i);
    const t = performance.now();
    await c.insertOne(doc);
    lat.push(performance.now() - t);
    ids.push(doc._id);
  }
  const insertTotal = performance.now() - t0;
  const ulat = [];
  const u0 = performance.now();
  for (let i = 0; i < ids.length; i++) {
    const t = performance.now();
    await c.updateOne({ _id: ids[i] }, { $set: { updatedAt: new Date(), presentDue: i % 997, paid: i % 1009 } });
    ulat.push(performance.now() - t);
  }
  const updateTotal = performance.now() - u0;
  for (let i = 0; i < ids.length; i += 1000) await c.deleteMany({ _id: { $in: ids.slice(i, i + 1000) } });
  lat.sort((a, b) => a - b);
  ulat.sort((a, b) => a - b);
  return {
    n,
    insertP50Ms: round(pct(lat, 50)), insertP95Ms: round(pct(lat, 95)), insertOpsPerSec: Math.round(n / (insertTotal / 1000)),
    updateP50Ms: round(pct(ulat, 50)), updateP95Ms: round(pct(ulat, 95)), updateOpsPerSec: Math.round(n / (updateTotal / 1000)),
  };
};

// ---------------- results ----------------
const save = (id, obj) => {
  fs.mkdirSync(path.join(EXP_DIR, "raw"), { recursive: true });
  fs.writeFileSync(path.join(EXP_DIR, "raw", `${id}.json`), JSON.stringify({ id, runAt: new Date().toISOString(), ...obj }, null, 1));
};
const done = (id) => fs.existsSync(path.join(EXP_DIR, "raw", `${id}.json`)) && !process.env.PERF_FORCE;
const strip = (m) => {
  if (!m) return m;
  const { sample, parts, ...rest } = m;
  return parts ? { ...rest, parts: parts.map(({ sample: _s, ...p }) => p) } : rest;
};

module.exports = { connect, close, captured, measureCmd, measureParallel, createIndex, dropIndex, dropAllExperimental, snapshotIndexes, writeCost, save, done, strip, idxName, round, EXP_DIR, RAW, MAX_TIME_MS, get db() { return db; }, ObjectId };
