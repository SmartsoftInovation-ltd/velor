// Phase 2 MODE: measure — orchestrator. Guard runs first, always.
//
//   npm run perf:measure                       # every scenario not yet measured (resumable)
//   PERF_ONLY='^rep-' npm run perf:measure     # regex filter on scenario ids
//   PERF_FORCE=1 ...                           # re-measure even if raw results exist
//   PERF_STEP=build npm run perf:measure       # only rebuild query-audit.json + md from raw/
//   PERF_STEP=replay PERF_FORCE=1 PERF_ONLY=.. # only re-run the replay phase on existing captures
//
// Per scenario: child 1 = endpoint.js (real endpoint in-process, capture + timing + round-trips),
// child 2 = replay.js (explain + timing of every captured command). Children isolate heap OOMs.
const { assertPerfTarget } = require("../lib/guard");
const target = assertPerfTarget();
console.log(`[perf:measure] target ok: db=${target.dbName}`);

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { RAW_DIR, OUT_DIR, scenarios } = require("./scenarios");

const NODE = process.execPath;
const HEAP = process.env.PERF_HEAP_MB || "4096";
const LOG = path.join(__dirname, "..", "..", "reports", "phase2", "logs", "measure.log");
const log = (m) => {
  const line = `${new Date().toISOString()} ${m}`;
  console.log(line);
  fs.appendFileSync(LOG, line + "\n");
};

const runChild = (script, id, timeoutMin) => {
  const t = Date.now();
  const r = spawnSync(NODE, [`--max-old-space-size=${HEAP}`, path.join(__dirname, script), id], {
    cwd: path.join(__dirname, "..", ".."),
    encoding: "utf8",
    timeout: timeoutMin * 60000,
    maxBuffer: 64 * 1024 * 1024,
    env: process.env,
  });
  const out = `${r.stdout || ""}\n${r.stderr || ""}`;
  const keep = out.split("\n").filter((l) => /^\[(endpoint|replay)\]|FATAL|heap|Error|error:/i.test(l) && !/Redis\/|Eviction/.test(l));
  return { status: r.status, signal: r.signal, ms: Date.now() - t, tail: keep.slice(-15).join("\n"), oom: /heap out of memory|Allocation failed/i.test(out) };
};

const synthetic = {
  // Q-864: audit purge — explain only, never executed
  "job-audit-purge": async () => {
    const { EJSON } = require("bson");
    const { AUDIT_RETENTION_DAYS } = { AUDIT_RETENTION_DAYS: 30 };
    const cutoff = new Date(Date.now() - AUDIT_RETENTION_DAYS * 86400000);
    const body = EJSON.stringify({ delete: "auditlogs", deletes: [{ q: { createdAt: { $lt: cutoff } }, limit: 0 }], ordered: true }, { relaxed: false });
    return [{ n: 1, cmd: "delete", coll: "auditlogs", origin: "src/jobs/purgeAuditLogs.job.js:20", via: "native.deleteMany", body }];
  },
};

const main = async () => {
  fs.mkdirSync(RAW_DIR, { recursive: true });
  fs.mkdirSync(path.dirname(LOG), { recursive: true });
  const step = process.env.PERF_STEP || "all";

  if (step !== "build") {
    // Context (ids) is computed once by the first endpoint child; scenarios() needs counts only
    const ctxFile = path.join(RAW_DIR, "context.json");
    const ctx = fs.existsSync(ctxFile) ? JSON.parse(fs.readFileSync(ctxFile, "utf8")) : { counts: {}, lineVariants: [] };
    if (!fs.existsSync(ctxFile)) {
      log("context.json missing: running a bootstrap endpoint child first");
      runChild("endpoint.js", "audit-list", 10);
    }
    const ctx2 = fs.existsSync(ctxFile) ? JSON.parse(fs.readFileSync(ctxFile, "utf8")) : ctx;
    await require("./indexstats").snapshot("before");

    const only = process.env.PERF_ONLY ? new RegExp(process.env.PERF_ONLY) : null;
    const ids = [...scenarios(ctx2).map((s) => s.id), ...Object.keys(synthetic)].filter((id) => !only || only.test(id));
    log(`scenarios: ${ids.length}`);
    for (const id of ids) {
      const qFile = path.join(RAW_DIR, `${id}.queries.json`);
      if (fs.existsSync(qFile) && !process.env.PERF_FORCE) continue;
      if (step === "replay") {
        // replay-only: re-explain/re-time the commands already captured
      } else if (synthetic[id]) {
        const lines = await synthetic[id]();
        fs.writeFileSync(path.join(RAW_DIR, `${id}.commands.ndjson`), lines.map((l) => JSON.stringify(l)).join("\n") + "\n");
      } else {
        const e = runChild("endpoint.js", id, 30);
        log(`endpoint ${id}: exit=${e.status}${e.signal ? " signal=" + e.signal : ""}${e.oom ? " OOM" : ""} ${Math.round(e.ms / 1000)}s\n${e.tail}`);
        if (e.status !== 0) {
          fs.writeFileSync(path.join(RAW_DIR, `${id}.endpoint-error.json`), JSON.stringify({ id, exit: e.status, signal: e.signal, oom: e.oom, ms: e.ms, tail: e.tail, heapMB: Number(HEAP) }, null, 1));
        } else fs.rmSync(path.join(RAW_DIR, `${id}.endpoint-error.json`), { force: true });
      }
      if (fs.existsSync(path.join(RAW_DIR, `${id}.commands.ndjson`))) {
        const r = runChild("replay.js", id, 45);
        log(`replay ${id}: exit=${r.status}${r.signal ? " signal=" + r.signal : ""} ${Math.round(r.ms / 1000)}s\n${r.tail}`);
      }
    }
    await require("./indexstats").snapshot("after");
  }
  await require("./build").build();
  process.exit(0);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
