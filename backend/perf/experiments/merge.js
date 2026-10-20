/**
 * Folds MODE: experiment results (reports/phase2/experiments/raw/*.json) into the audit object
 * built by perf/measure/build.js: fills queries[].after, experiments[], and per-finding
 * "Fix verified" text used by FINDINGS.md. Pure file processing.
 */
const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "..", "..", "reports", "phase2", "experiments", "raw");
const r2 = (n) => (n == null ? null : Math.round(n * 100) / 100);
const fmt = (ms, timedOut) => (ms == null ? "—" : timedOut ? `>${r2(ms / 1000)} s (timeout)` : ms >= 1000 ? `${r2(ms / 1000)} s` : `${r2(ms)} ms`);
// a measured (finished) result beats a timed-out one; otherwise the lower p95 wins
const better = (m, cur) => !cur || (cur.timedOut && !m.timedOut) || (!!m.timedOut === !!cur.timedOut && (m.p95Ms ?? Infinity) < (cur.p95Ms ?? Infinity));

const load = () => {
  if (!fs.existsSync(DIR)) return [];
  return fs.readdirSync(DIR).filter((f) => /^[EW]\d+.*\.json$/.test(f) && !f.includes(".error")).sort().map((f) => JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8")));
};

const afterShape = (m, change) => ({
  plan: m.plan || null,
  indexUsed: m.indexUsed || null,
  keysExamined: m.keysExamined ?? null,
  docsExamined: m.docsExamined ?? null,
  nReturned: m.nReturned ?? null,
  inMemorySort: !!m.inMemorySort,
  usedDisk: !!m.usedDisk,
  explainMs: m.explainMs ?? null,
  p50Ms: m.p50Ms ?? null,
  p95Ms: m.p95Ms ?? null,
  // extras
  lookupDocsExamined: m.lookupDocsExamined ?? null,
  timedOut: !!m.timedOut,
  change,
});

const apply = (audit) => {
  const exps = load();
  if (!exps.length) return { byFinding: {} };
  const W = exps.find((e) => e.id === "W01-write-cost")?.variants || {};
  const W2 = exps.find((e) => e.id === "W02-write-cost-purchases")?.variants || {};
  const writeFor = (indexes) => {
    if (!indexes?.length) return null;
    const coll = indexes[0].coll;
    const base = W2[`${coll}_baseline`] || W[`${coll}_baseline`];
    if (!base) return null;
    const refs = [...new Set(indexes.map((i) => i.ref))];
    const one = refs.length === 1 ? W[`${coll}_+${refs[0]}`] : null;
    const set = one || W2[`${coll}_+set`] || W[`${coll}_+set`] || (coll === "sales" ? W["sales_+recommended_set"] : null);
    if (!set) return null;
    return { base, set, label: one ? `${coll} +${refs[0]}` : `${coll} + recommended set` };
  };

  const byFinding = {};
  const experiments = [];
  for (const e of exps) {
    if (e.id.startsWith("W")) continue;
    const lines = [];
    for (const [sid, origin, variant] of e.targets || []) {
      const m = e.variants?.[variant];
      if (!m) continue;
      const rows = audit.queries.filter((q) => q.scenarioId === sid && q.source === origin);
      for (const q of rows) if (better(m, q.after)) q.after = afterShape(m, e.change);
      const before = rows[0]?.before;
      lines.push({ sid, origin, variant, qid: rows[0]?.id || null, before, after: m });
    }
    // one headline entry per experiment (largest before p95), plus write cost of its indexes on the main collection
    const head = [...lines].sort((a, b) => (b.before?.p95Ms || 0) - (a.before?.p95Ms || 0))[0];
    const byColl = {};
    for (const i of e.indexes || []) (byColl[i.coll] = byColl[i.coll] || []).push(i);
    const wc = Object.values(byColl).map(writeFor).filter(Boolean);
    const uniqIdx = [];
    for (const i of e.indexes || []) if (!uniqIdx.some((u) => u.coll === i.coll && u.name === i.name)) uniqIdx.push(i);
    experiments.push({
      findingId: e.finding,
      change: e.change,
      readP95Before: head?.before?.p95Ms ?? null,
      readP95After: head?.after?.p95Ms ?? null,
      writeOpsPerSecBefore: wc[0]?.base.insertOpsPerSec ?? null,
      writeOpsPerSecAfter: wc[0]?.set.insertOpsPerSec ?? null,
      indexSizeMB: r2(uniqIdx.reduce((s, i) => s + (i.sizeMB || 0), 0)),
      // extras
      experimentId: e.id,
      headline: head ? `${head.qid} [${head.sid}]` : null,
      indexes: uniqIdx.map((i) => ({ collection: i.coll, key: i.key, options: i.options || null, sizeMB: i.sizeMB, buildMs: i.buildMs })),
      write: wc.map((w) => ({ config: w.label, insertP95MsBefore: w.base.insertP95Ms, insertP95MsAfter: w.set.insertP95Ms, insertOpsPerSecBefore: w.base.insertOpsPerSec, insertOpsPerSecAfter: w.set.insertOpsPerSec, updateP95MsBefore: w.base.updateP95Ms, updateP95MsAfter: w.set.updateP95Ms })),
      targets: lines.map((l) => ({ query: l.qid, scenario: l.sid, source: l.origin, variant: l.variant, p95Before: l.before?.p95Ms ?? null, p95After: l.after.p95Ms, docsBefore: l.before?.docsExamined ?? null, docsAfter: l.after.docsExamined, lookupDocsAfter: l.after.lookupDocsExamined ?? null, planAfter: l.after.plan })),
      equality: e.variants?.equal ?? e.equalityChecked ?? null,
      equalityNote: typeof e.equalityChecked === "string" ? e.equalityChecked : null,
    });
    const txt = [
      `${e.id}: ${e.change}.`,
      ...lines.map((l) => `${l.qid || "?"} [${l.sid}] p95 ${l.before?.timedOut || (l.before?.p95Ms ?? 0) >= 60000 ? ">60 s (timeout)" : fmt(l.before?.p95Ms)} → ${fmt(l.after.p95Ms, l.after.timedOut)}; docs examined ${l.before?.docsExamined?.toLocaleString?.() ?? "—"} → ${l.after.docsExamined?.toLocaleString?.() ?? "—"}${l.after.lookupDocsExamined ? ` (+${l.after.lookupDocsExamined.toLocaleString()} in $lookups)` : ""}; plan \`${l.after.plan || "—"}\``),
      ...(uniqIdx.length ? [`index size: ${uniqIdx.map((i) => `${i.coll} ${JSON.stringify(i.key)}${i.options?.collation ? " (collation en/2)" : ""} ${i.sizeMB} MB`).join(", ")}`] : []),
      ...wc.map((w) => `write cost (${w.label}, 10k single inserts / updates): insert p95 ${w.base.insertP95Ms} → ${w.set.insertP95Ms} ms, ${w.base.insertOpsPerSec} → ${w.set.insertOpsPerSec} ops/s; update p95 ${w.base.updateP95Ms} → ${w.set.updateP95Ms} ms`),
      ...(e.variants?.equal != null ? [`result equality vs original: ${e.variants.equal ? "identical" : "DIFFERENT — see raw"}`] : typeof e.equalityChecked === "object" && e.equalityChecked ? [`result equality vs original: ${JSON.stringify(e.equalityChecked)}`] : typeof e.equalityChecked === "string" ? [`equality: ${e.equalityChecked}`] : []),
    ];
    (byFinding[e.finding] = byFinding[e.finding] || []).push(txt.join("\n  - "));
  }
  // second finding id for shared experiments
  const also = { "E06-sales-list": "F-001", "E11-lists-keyset": "F-001", "E09-customers": "F-019" };
  for (const e of exps) if (also[e.id] && byFinding[e.finding]) (byFinding[also[e.id]] = byFinding[also[e.id]] || []).push(`see ${e.id} under ${e.finding}`);
  audit.experiments = experiments;
  audit.writeCost = { ...W, ...Object.fromEntries(Object.entries(W2).map(([k, v]) => [`W02:${k}`, v])) };
  return { byFinding };
};

module.exports = { apply };
