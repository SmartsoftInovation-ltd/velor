/**
 * Measurement helpers (MODE: measure). Every function asserts the perf target.
 */
const { performance } = require("perf_hooks");
const { assertConnectedTarget } = require("./guard");

const pct = (sorted, p) => {
  if (!sorted.length) return 0;
  const i = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, i)];
};
const round = (n) => Math.round(n * 100) / 100;

/** 3 warm-up runs, then N timed runs. fn must perform the full round-trip (toArray etc.). */
const time = async (fn, { warmup = 3, runs = 20 } = {}) => {
  for (let i = 0; i < warmup; i++) await fn();
  const samples = [];
  for (let i = 0; i < runs; i++) {
    const t = performance.now();
    await fn();
    samples.push(performance.now() - t);
  }
  samples.sort((a, b) => a - b);
  return { p50Ms: round(pct(samples, 50)), p95Ms: round(pct(samples, 95)), minMs: round(samples[0]), maxMs: round(samples.at(-1)), runs };
};

const walk = (node, visit) => {
  if (!node || typeof node !== "object") return;
  visit(node);
  for (const k of ["inputStage", "queryPlan", "executionStages"]) if (node[k]) walk(node[k], visit);
  for (const k of ["inputStages", "children"]) if (Array.isArray(node[k])) node[k].forEach((n) => walk(n, visit));
  if (node.thenStage) walk(node.thenStage, visit);
  if (node.elseStage) walk(node.elseStage, visit);
};

/** Normalise a find/aggregate/count explain("executionStats") into the audit "before" shape. */
const summarizeExplain = (ex) => {
  const stages = [];
  const indexes = new Set();
  let inMemorySort = false;
  let usedDisk = false;
  let keys = 0, docs = 0, nReturned = 0, ms = 0;
  const lookups = [];

  const fromQueryPlanner = (qp, es) => {
    const plan = qp?.winningPlan?.queryPlan || qp?.winningPlan;
    walk(plan, (n) => {
      if (n.stage) stages.push(n.stage);
      if (n.indexName) indexes.add(n.indexName);
      if (n.stage === "SORT" || n.stage === "sort") inMemorySort = true;
    });
    if (es) {
      keys += es.totalKeysExamined || 0;
      docs += es.totalDocsExamined || 0;
      nReturned = es.nReturned ?? nReturned;
      ms = Math.max(ms, es.executionTimeMillis || 0);
      walk(es.executionStages, (n) => {
        if (n.usedDisk || n.spills) usedDisk = true;
        if (n.stage === "SORT" || n.stage === "sort") inMemorySort = true;
      });
    }
  };

  if (ex.queryPlanner) fromQueryPlanner(ex.queryPlanner, ex.executionStats);
  if (Array.isArray(ex.stages)) {
    for (const s of ex.stages) {
      const name = Object.keys(s).find((k) => k.startsWith("$"));
      if (name === "$cursor") fromQueryPlanner(s.$cursor.queryPlanner, s.$cursor.executionStats);
      else if (name) stages.push(name);
      if (s.usedDisk) usedDisk = true;
      if (name === "$sort") inMemorySort = true;
      if (name === "$lookup")
        lookups.push({ from: s.$lookup.from, strategy: s.$lookup.strategy || null, indexesUsed: s.indexesUsed || [], docsExamined: s.totalDocsExamined, keysExamined: s.totalKeysExamined });
      if (s.nReturned != null) nReturned = s.nReturned;
      if (s.executionTimeMillisEstimate != null) ms = Math.max(ms, s.executionTimeMillisEstimate);
    }
  }
  if (Array.isArray(ex.shards)) throw new Error("sharded explain not supported");
  // SBE single-node aggregate (no "stages", plan pushed down)
  const planLabel = stages.includes("COLLSCAN")
    ? "COLLSCAN"
    : indexes.size
      ? stages.filter((s) => /IXSCAN|FETCH|SORT|PROJECTION|LIMIT|SKIP|COUNT_SCAN|IDHACK|EXPRESS/.test(s)).join(" > ") || "IXSCAN"
      : stages.join(" > ");
  return {
    plan: planLabel,
    stages,
    indexUsed: indexes.size ? [...indexes].join(",") : null,
    keysExamined: keys,
    docsExamined: docs,
    nReturned,
    inMemorySort,
    usedDisk,
    explainMs: ms,
    lookups,
  };
};

/** explain + timing for a Mongoose/native query factory. `make()` must return a fresh query each call. */
const measureFind = async (conn, make, opts) => {
  assertConnectedTarget(conn);
  const ex = await make().explain("executionStats");
  const sum = summarizeExplain(Array.isArray(ex) ? ex[0] : ex);
  const t = await time(() => make().exec ? make().exec() : make().toArray(), opts);
  return { ...sum, ...t };
};

const measureAggregate = async (conn, collection, pipeline, opts = {}) => {
  assertConnectedTarget(conn);
  const coll = conn.db.collection(collection);
  const ex = await coll.aggregate(pipeline, { allowDiskUse: opts.allowDiskUse ?? true }).explain("executionStats");
  const sum = summarizeExplain(ex);
  const t = await time(() => coll.aggregate(pipeline, { allowDiskUse: opts.allowDiskUse ?? true }).toArray(), opts);
  return { ...sum, ...t };
};

/** Endpoint-level timing with round-trip counting (supertest request factory). */
const measureEndpoint = async (makeRequest, commandCounter, opts = {}) => {
  const trips = [];
  const wrapped = async () => {
    commandCounter.reset();
    const res = await makeRequest();
    trips.push(commandCounter.count);
    if (opts.expectStatus && res.status !== opts.expectStatus) throw new Error(`unexpected status ${res.status}`);
    return res;
  };
  const t = await time(wrapped, opts);
  const measured = trips.slice(-(opts.runs || 20));
  return { ...t, roundTrips: Math.max(...measured), roundTripsMin: Math.min(...measured) };
};

const classify = ({ collCount = 0, before, userFacing = true }) => {
  const r = before;
  const ratio = r.nReturned ? r.docsExamined / r.nReturned : r.docsExamined;
  if (userFacing && r.plan.includes("COLLSCAN") && collCount > 100000) return { status: "FAIL", severity: "critical" };
  if (r.inMemorySort || r.usedDisk) return { status: "FAIL", severity: "high" };
  if (ratio > 100) return { status: "FAIL", severity: "high" };
  if (r.p95Ms > 50) return { status: "WARN", severity: "medium" };
  if (ratio > 10) return { status: "WARN", severity: "medium" };
  return { status: "PASS", severity: null };
};

module.exports = { time, summarizeExplain, measureFind, measureAggregate, measureEndpoint, classify, pct };
