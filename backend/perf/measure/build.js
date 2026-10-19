/**
 * Assemble reports/phase2/query-audit.json (schema in the agent brief) and reports/phase2/MEASURE.md
 * from perf/measure raw results. Pure file processing, no DB access.
 *
 * Classification conventions (documented in MEASURE.md):
 * - ratio = docsExamined / nReturned for find/count/distinct; for aggregate, docsExamined / docs that
 *   left the first ($match) stage, i.e. index selectivity, not the $group fan-in.
 * - "TENANT-SCAN": winning index is tenantId_1 only, >100k docs examined, and the filter has fields the
 *   index cannot use (examined > 1.5 x matched). On a shared multi-tenant collection this is the
 *   tenant-wide equivalent of a COLLSCAN and is classified like one.
 * - In-memory sort = a blocking SORT / $sort fed by more than 1,000 documents (tiny lookup lists ignored).
 * - Latency: p95 > 50 ms WARN (query); > 1 s FAIL medium; > 5 s or maxTimeMS hit FAIL high.
 * - Endpoint round-trips: the N+1 rule (> 5) is applied to the handler's own commands (excluding the
 *   auth/tenant middleware and getMore batches); the total is reported too.
 */
const fs = require("fs");
const path = require("path");
const { RAW_DIR, OUT_DIR } = require("./scenarios");

const BACKEND = path.join(__dirname, "..", "..");
const P2 = path.join(BACKEND, "reports", "phase2");
const SEV = { critical: 4, high: 3, medium: 2, low: 1 };
const round = (n, d = 2) => (n == null ? null : Math.round(n * 10 ** d) / 10 ** d);
const INFRA = /^src\/(tenancy|middleware|settings)\//;

const readJson = (f) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : null);

const loadFindingsMap = () => {
  const f = path.join(__dirname, "findings.js");
  return fs.existsSync(f) ? require(f) : { assign: () => null, findings: [] };
};

const mapQid = (inv) => {
  const byFile = new Map();
  for (const o of inv.ops) {
    if (!byFile.has(o.file)) byFile.set(o.file, []);
    byFile.get(o.file).push(o);
  }
  return (origin, coll, internal) => {
    if (!origin) return { id: null, op: null };
    const [file, lineS] = origin.split(":");
    const line = Number(lineS);
    const ops = byFile.get(file) || [];
    let best = null;
    for (const o of ops) {
      const d = line - o.line;
      if (d < -2 || d > 12) continue;
      const score = Math.abs(d) - (!internal && o.collection === coll ? 5 : 0);
      if (!best || score < best.score) best = { o, score };
    }
    return best ? { id: best.o.id, op: best.o } : { id: null, op: null };
  };
};

const classifyQuery = (q, ctxCounts, collSize) => {
  const reasons = [];
  let status = "PASS";
  let sev = null;
  const hit = (st, s, why) => {
    reasons.push(why);
    if (st === "FAIL" || (st === "WARN" && status === "PASS")) status = st;
    if (!sev || SEV[s] > SEV[sev]) sev = s;
  };
  const b = q.before;
  const big = collSize > 100000;
  if (q.kind === "write") {
    if (b.plan && /COLLSCAN/.test(b.plan) && big) hit("FAIL", "high", "write filter does a COLLSCAN on a >100k collection");
    if (q.timedOut) hit("FAIL", "high", "explain exceeded maxTimeMS");
    if (b.docsExamined > 100000) hit("WARN", "medium", `write touches ${b.docsExamined.toLocaleString()} docs in one operation`);
    return { status, severity: status === "PASS" ? null : sev, reasons };
  }
  if (q.timedOut) hit("FAIL", q.userFacing ? "critical" : "high", q.timedOutBy ? `never finished: ${q.timedOutBy}` : `exceeded maxTimeMS ${q.maxTimeMS} ms`);
  if (/COLLSCAN/.test(b.plan || "") && big && q.userFacing) hit("FAIL", "critical", "COLLSCAN on >100k collection, user-facing");
  if (q.tenantScan && q.userFacing) hit("FAIL", "critical", `TENANT-SCAN: only tenantId_1 usable, ${b.docsExamined.toLocaleString()} docs examined`);
  if (q.rows > 10000 && big && q.userFacing) hit("FAIL", "critical", `unbounded result: ${q.rows.toLocaleString()} rows returned`);
  if (b.inMemorySort && Math.max(b.docsExamined || 0, q.matched || 0, q.blocking?.sortInput || 0) > 1000) hit("FAIL", "high", q.blocking?.sortInput ? `blocking sort over ${q.blocking.sortInput.toLocaleString()} docs` : "in-memory SORT stage");
  if (b.usedDisk) hit("FAIL", "high", "spilled to disk");
  if (q.lookupCollScans > 0) hit("FAIL", "high", `$lookup foreign side not indexed (${q.lookupCollScans.toLocaleString()} collection scans)`);
  if (q.regex && big) hit("FAIL", "high", "unanchored / case-insensitive $regex on large collection");
  if (q.ratio > 100) hit("FAIL", "high", `docsExamined/returned = ${Math.round(q.ratio).toLocaleString()}`);
  else if (q.ratio > 10) hit("WARN", "medium", `docsExamined/returned = ${round(q.ratio, 1)}`);
  if (!q.timedOut) {
    if (b.p95Ms > 5000) hit("FAIL", "high", `p95 ${Math.round(b.p95Ms)} ms`);
    else if (b.p95Ms > 1000) hit("FAIL", "medium", `p95 ${Math.round(b.p95Ms)} ms`);
    else if (b.p95Ms > 50) hit("WARN", "medium", `p95 ${round(b.p95Ms, 1)} ms > 50`);
  }
  if (q.isCount && b.p95Ms > 200) hit("WARN", "medium", "countDocuments > 200 ms on a list request");
  return { status, severity: status === "PASS" ? null : sev, reasons };
};

const build = async () => {
  const inv = readJson(path.join(P2, "query-inventory.json"));
  const seed = readJson(path.join(P2, "seed-stats.json"));
  const ctx = readJson(path.join(RAW_DIR, "context.json")) || { counts: {} };
  process.env.ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || "x";
  const { scenarios } = require("./scenarios");
  const scen = new Map(scenarios(ctx).map((s) => [s.id, s]));
  scen.set("job-audit-purge", { id: "job-audit-purge", method: "CRON", url: "purgeAuditLogs (03:00 + every server start)", scenario: "explain only: deleteMany createdAt < now-30d, all tenants", rf: "RF-17", job: true });
  const qid = mapQid(inv);
  const fmap = loadFindingsMap();
  const collSize = (c) => seed.collections[c]?.count ?? 0;

  const files = fs.readdirSync(RAW_DIR);
  const ids = [...new Set(files.filter((f) => /\.(queries|endpoint|endpoint-error)\.json$/.test(f)).map((f) => f.replace(/\.(queries|endpoint|endpoint-error)\.json$/, "")))];

  const queries = [];
  const endpoints = [];
  const infraSeen = new Map();
  for (const id of ids.sort()) {
    const sc = scen.get(id) || { id, method: "?", url: id, scenario: "" };
    const ep = readJson(path.join(RAW_DIR, `${id}.endpoint.json`));
    const epErr = readJson(path.join(RAW_DIR, `${id}.endpoint-error.json`));
    const qs = readJson(path.join(RAW_DIR, `${id}.queries.json`));
    const endpointName = sc.job ? `CRON ${sc.url}` : `${sc.method} /api/v1${sc.url.split("?")[0]}`;

    if (ep || epErr) {
      const IGN = new Set(["create", "createIndexes", "listIndexes", "listCollections"]);
      const events = (ep?.firstEvents || []).filter((e) => !IGN.has(e.cmd));
      const handlerTrips = events.filter((e) => e.cmd !== "getMore" && !(e.origin && INFRA.test(e.origin))).length;
      const authTrips = events.filter((e) => e.origin && INFRA.test(e.origin)).length;
      let status = "PASS";
      const why = [];
      if (epErr) {
        status = "FAIL";
        why.push(epErr.oom ? `process heap OOM at ${epErr.heapMB} MB` : `child exit ${epErr.exit} ${epErr.signal || ""}`);
      }
      if (ep?.timedOut) {
        status = "FAIL";
        why.push(`DB op killed after ${ep.timeoutS}s`);
      }
      if (ep && ep.first.status >= 500) {
        status = "FAIL";
        why.push(`HTTP ${ep.first.status}`);
      }
      if (ep && ep.first.status >= 400 && ep.first.status < 500) why.push(`HTTP ${ep.first.status}: ${ep.first.message || ""}`);
      if (handlerTrips > 5) {
        status = "FAIL";
        why.push(`${handlerTrips} handler round-trips (> 5)`);
      }
      if (ep && ep.p95Ms > 1000) {
        status = "FAIL";
        why.push(`p95 ${Math.round(ep.p95Ms)} ms`);
      } else if (ep && ep.p95Ms > 200 && status === "PASS") {
        status = "WARN";
        why.push(`p95 ${Math.round(ep.p95Ms)} ms > 200`);
      }
      endpoints.push({
        endpoint: endpointName,
        scenario: `${sc.scenario}${ep?.cacheMode === "forced-miss" ? " (cache miss)" : ep?.cacheMode === "normal" ? " (cache as-is)" : ""}`,
        p50Ms: ep ? ep.p50Ms : null,
        p95Ms: ep ? ep.p95Ms : null,
        roundTrips: ep ? events.length : null,
        status,
        // extras (not used by the report script)
        id,
        rf: sc.rf || null,
        handlerRoundTrips: handlerTrips,
        authRoundTrips: authTrips,
        byCommand: ep?.first?.byCommand || null,
        httpStatus: ep?.first?.status ?? null,
        responseBytes: ep?.first?.bytes ?? null,
        runs: ep?.runs ?? 0,
        firstMs: ep ? round(ep.first.ms) : null,
        timedOut: !!ep?.timedOut,
        crashed: !!epErr,
        notes: why,
      });
    }

    for (const r of qs?.queries || []) {
      if (r.kind === "other" || r.kind === "insert") continue;
      if (r.origin && INFRA.test(r.origin)) {
        const k = `${r.origin}|${r.collection}|${r.command}|${r.via}`;
        const prev = infraSeen.get(k);
        if (prev && (prev.before.p95Ms || 0) >= (r.p95Ms || 0)) continue;
        if (prev) queries.splice(queries.indexOf(prev), 1);
      }
      const internal = /internal/.test(r.via || "");
      const m = qid(r.origin, r.collection, internal);
      const isPopulate = internal && m.op && m.op.collection !== r.collection;
      const id0 = m.id ? (isPopulate ? `${m.id}.populate(${r.collection})` : m.id) : `Q-?(${r.origin || "unattributed"})`;
      const cmdText = r.commandText || "";
      const regex = /"\$regex"/.test(cmdText) && (/"\$options":\s*"[^"]*i/.test(cmdText) || !/"\$regex":\s*"\^/.test(cmdText)) || /"\$regularExpression"/.test(cmdText);
      const ratioBase = r.command === "aggregate" ? r.matched : r.nReturned;
      const docs = (r.docsExamined || 0);
      const ratio = r.docsExamined == null ? null : ratioBase ? docs / ratioBase : docs;
      const onlyTenantIdx = /^tenantId_1/.test(r.indexUsed || "") && !/,/.test(r.indexUsed || "");
      const tenantScan = onlyTenantIdx && docs > 100000 && (r.matched == null || docs > 1.5 * (r.matched || 0));
      const isCount = r.via === "countDocuments" || r.command === "count";
      const q = {
        id: id0,
        name: `${r.command} ${r.collection}${isPopulate ? " (populate)" : ""}${r.via && /hook|variant.model/.test(r.origin || "") ? " (Variant post-find hook)" : ""}`,
        endpoint: endpointName,
        source: r.origin,
        collection: r.collection,
        type: r.command === "find" ? "find" : r.command === "aggregate" ? (isCount ? "count" : "aggregate") : r.command === "count" ? "count" : r.command === "distinct" ? "distinct" : r.command === "delete" ? "delete" : "update",
        scenario: `${sc.scenario} [${id}]`,
        before: {
          plan: r.plan || (r.explainError ? (/BSONObjectTooLarge/.test(r.explainError) ? "n/a (explain output > 16 MB: filter echoes a huge $in list)" : `ERROR: ${r.explainError.slice(0, 80)}`) : null),
          indexUsed: r.indexUsed ?? null,
          keysExamined: r.keysExamined ?? null,
          docsExamined: r.docsExamined ?? null,
          nReturned: r.nReturned ?? null,
          inMemorySort: !!r.inMemorySort && (r.command !== "aggregate" || (r.blocking?.sortInput || 0) > 1000 || (r.stages || []).includes("SORT")) && Math.max(r.docsExamined || 0, r.matched || 0, r.blocking?.sortInput || 0, r.planOnly ? 1001 : 0) > 1000,
          usedDisk: !!r.usedDisk,
          explainMs: r.explainMs ?? null,
          p50Ms: r.kind === "write" ? null : r.p50Ms ?? null,
          p95Ms: r.kind === "write" ? null : r.p95Ms ?? null,
        },
        after: null,
        recommendation: "",
        status: "PASS",
        severity: null,
        findingId: null,
        // extras
        scenarioId: id,
        rf: sc.rf || null,
        via: r.via,
        kind: r.kind,
        callsPerRequest: r.callsPerRequest,
        rows: r.rows ?? null,
        matched: r.matched ?? null,
        lookups: r.lookups?.length ? r.lookups : undefined,
        blocking: r.blocking,
        runs: r.runs ?? null,
        timedOut: !!r.timedOut,
        planOnly: !!r.planOnly,
        command: cmdText.slice(0, 1500),
      };
      const c = classifyQuery({ ...q, kind: r.kind, timedOut: !!r.timedOut, timedOutBy: r.timedOutBy, maxTimeMS: qs.maxTimeMS, userFacing: !sc.job, tenantScan, rows: r.rows || 0, ratio, regex, isCount, lookupCollScans: r.lookupCollScans || 0, blocking: r.blocking }, ctx.counts, collSize(r.collection));
      q.status = c.status;
      q.severity = c.severity;
      q.reasons = c.reasons;
      q.ratio = ratio == null ? null : round(ratio, 1);
      q.tenantScan = tenantScan;
      const f = fmap.assign(q);
      if (f) {
        q.findingId = f.id;
        q.recommendation = f.recommendation || "";
      }
      queries.push(q);
      if (r.origin && INFRA.test(r.origin)) infraSeen.set(`${r.origin}|${r.collection}|${r.command}|${r.via}`, q);
    }
  }

  // ---- indexes ----
  const before = readJson(path.join(RAW_DIR, "indexstats-before.json"));
  const after = readJson(path.join(RAW_DIR, "indexstats-after.json"));
  const indexes = [];
  if (before && after) {
    for (const [coll, a] of Object.entries(after.collections)) {
      if ((a.count || 0) < 1000) continue;
      const b = before.collections[coll] || { indexes: [] };
      const keys = a.indexes.map((i) => ({ name: i.name, k: Object.entries(i.key).map(([f, d]) => `${f}:${d}`) }));
      for (const i of a.indexes) {
        if (i.name === "_id_") continue;
        const bi = b.indexes.find((x) => x.name === i.name);
        const ops = i.ops - (bi?.ops || 0);
        const mine = Object.entries(i.key).map(([f, d]) => `${f}:${d}`);
        const special = i.spec?.unique || i.spec?.expireAfterSeconds != null || Object.values(i.key).some((v) => typeof v === "string");
        const coveredBy = special ? null : keys.find((o) => o.name !== i.name && o.k.length > mine.length && mine.every((x, n) => o.k[n] === x));
        indexes.push({ collection: coll, name: i.name, sizeMB: i.sizeMB, ops, verdict: coveredBy ? "redundant" : ops === 0 ? "unused" : "used", prefixOf: coveredBy?.name || null, unique: !!i.spec?.unique, ttl: i.spec?.expireAfterSeconds ?? null });
      }
    }
  }

  // ---- cache ----
  const cacheRes = readJson(path.join(RAW_DIR, "cache.json"));
  const cache = cacheRes?.cache || [];

  const seedTotals = seed.totals;
  const audit = {
    meta: {
      runAt: new Date().toISOString(),
      mongoVersion: seed.mongoVersion,
      wiredTigerCacheGB: seed.wiredTigerCacheGB,
      dataset: Object.fromEntries(Object.entries(seed.collections).filter(([, v]) => v.count >= 10000).map(([k, v]) => [k, v.count])),
      dataSizeGB: seedTotals.dataSizeGB,
      indexSizeGB: seedTotals.indexSizeGB,
      // extras
      worstCaseTenant: { slug: ctx.tenantSlug, counts: ctx.counts },
      datasetToCacheRatio: seedTotals.datasetToCacheRatio,
      protocol: "explain(executionStats) + 3 warm-up/20 timed runs per captured command (fewer when one run > 0.5 s, see runs); endpoints in-process via supertest, concurrency 1, Redis data keys forced to miss; maxTimeMS 60 s per query, endpoint DB ops killed after 90 s",
      conventions: fs.readFileSync(__filename, "utf8").match(/Classification conventions[\s\S]*?\n \*\//)[0].replace(/\n \*\/$/, "").replace(/\n \* ?/g, "\n").trim(),
    },
    queries,
    endpoints,
    indexes,
    cache,
    experiments: readJson(path.join(P2, "query-audit.json"))?.experiments || [],
  };
  const merged = require("../experiments/merge").apply(audit);
  fmap.verified = merged.byFinding;
  fs.writeFileSync(path.join(P2, "query-audit.json"), JSON.stringify(audit, null, 1));
  require("./render").render(audit, fmap);
  console.log(`[build] queries=${queries.length} endpoints=${endpoints.length} indexes=${indexes.length}`);
};

module.exports = { build };
if (require.main === module) build();
