/** Renders reports/phase2/MEASURE.md from the assembled audit object. */
const fs = require("fs");
const path = require("path");

const P2 = path.join(__dirname, "..", "..", "reports", "phase2");
const n = (v, d = 0) => (v == null ? "—" : Number(v).toLocaleString("en-US", { maximumFractionDigits: d }));
const ms = (v) => (v == null ? "—" : v >= 1000 ? `${n(v / 1000, 2)} s` : `${n(v, 1)} ms`);
const esc = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
const SEV = { critical: 4, high: 3, medium: 2, low: 1 };

const render = (a, fmap = { findings: [] }) => {
  const Q = a.queries;
  const E = a.endpoints;
  const L = [];
  const p = (s = "") => L.push(s);
  p("# Phase 2 — MODE: measure results");
  p();
  p(`Run ${a.meta.runAt.slice(0, 16).replace("T", " ")} UTC · MongoDB ${a.meta.mongoVersion} · WiredTiger cache ${a.meta.wiredTigerCacheGB} GB · data ${a.meta.dataSizeGB} GB (uncompressed) · indexes ${a.meta.indexSizeGB} GB · (storage+indexes)/cache = ${a.meta.datasetToCacheRatio}x (not cache-resident).`);
  p(`Worst-case tenant **${a.meta.worstCaseTenant.slug}**: ${Object.entries(a.meta.worstCaseTenant.counts || {}).map(([k, v]) => `${k} ${n(v)}`).join(", ")}.`);
  p();
  p(`Protocol: ${a.meta.protocol}. Machine-readable results: \`reports/phase2/query-audit.json\`; raw explains/commands per scenario: \`reports/phase2/measure/raw/\`. Re-run: \`npm run perf:measure\` (resumable; \`PERF_ONLY=<regex>\`, \`PERF_FORCE=1\`, \`PERF_STEP=build\`).`);
  p();
  p("<details><summary>Classification conventions</summary>");
  p();
  p(a.meta.conventions.replace(/^Classification conventions[^\n]*\n?/, ""));
  p();
  p("</details>");
  p();

  // ---- totals ----
  const cnt = (arr, st) => arr.filter((x) => x.status === st).length;
  p("## Totals");
  p();
  p(`| | measured | PASS | WARN | FAIL |`);
  p(`|---|---:|---:|---:|---:|`);
  p(`| Queries (captured commands, per scenario) | ${Q.length} | ${cnt(Q, "PASS")} | ${cnt(Q, "WARN")} | ${cnt(Q, "FAIL")} |`);
  p(`| Endpoint scenarios | ${E.length} | ${cnt(E, "PASS")} | ${cnt(E, "WARN")} | ${cnt(E, "FAIL")} |`);
  const uniq = new Map();
  for (const q of Q) {
    const k = q.id;
    const prev = uniq.get(k);
    const rank = (x) => (x.status === "FAIL" ? 3 : x.status === "WARN" ? 2 : 1);
    if (!prev || rank(q) > rank(prev) || (rank(q) === rank(prev) && (q.before.p95Ms || 0) > (prev.before.p95Ms || 0))) uniq.set(k, q);
  }
  const U = [...uniq.values()];
  p(`| Distinct query ids (worst scenario each) | ${U.length} | ${cnt(U, "PASS")} | ${cnt(U, "WARN")} | ${cnt(U, "FAIL")} |`);
  p();

  // ---- per collection ----
  p("## Per collection (largest first)");
  p();
  p("| Collection | docs (all tenants) | queries | PASS | WARN | FAIL | worst p95 | worst query |");
  p("|---|---:|---:|---:|---:|---:|---:|---|");
  const colls = [...new Set(Q.map((q) => q.collection))].sort((x, y) => (a.meta.dataset[y] || 0) - (a.meta.dataset[x] || 0));
  for (const c of colls) {
    const qs = Q.filter((q) => q.collection === c);
    const worst = qs.reduce((w, q) => ((q.before.p95Ms || 0) > (w?.before.p95Ms || -1) ? q : w), null);
    p(`| ${c} | ${n(a.meta.dataset[c])} | ${qs.length} | ${cnt(qs, "PASS")} | ${cnt(qs, "WARN")} | ${cnt(qs, "FAIL")} | ${worst?.timedOut ? "**timeout**" : ms(worst?.before.p95Ms)} | ${worst ? `${worst.id} ${esc(worst.endpoint)} [${worst.scenarioId}]` : ""} |`);
  }
  p();

  // ---- top 15 ----
  const worstQ = [...Q].filter((q) => q.kind !== "write").sort((x, y) => (y.timedOut - x.timedOut) || (y.before.p95Ms || 0) - (x.before.p95Ms || 0));
  p("## Top 25 slowest queries");
  p();
  p("| # | Query | Source | Endpoint [scenario] | Plan / index | keys / docs examined / returned | p50 | p95 | Status | Why |");
  p("|---:|---|---|---|---|---|---:|---:|---|---|");
  worstQ.slice(0, 25).forEach((q, i) => {
    const b = q.before;
    p(`| ${i + 1} | ${q.id} ${esc(q.name)} | ${q.source} | ${esc(q.endpoint)} [${q.scenarioId}] | \`${esc(b.plan)}\` ${esc(b.indexUsed || "no index")} | ${n(b.keysExamined)} / ${n(b.docsExamined)} / ${n(b.nReturned)} | ${q.timedOut ? "—" : ms(b.p50Ms)} | ${q.timedOut ? `**>${ms(b.p95Ms)} (maxTimeMS)**` : ms(b.p95Ms)} | ${q.status} ${q.severity || ""} | ${esc((q.reasons || []).join("; "))} |`);
  });
  p();

  // ---- endpoints ----
  p("## Endpoints (slowest first)");
  p();
  p("Round-trips = every driver command in one request (incl. auth/tenant middleware and getMore batches); handler = the controller's own commands without getMore.");
  p();
  p("| Endpoint | Scenario [id] | HTTP | p50 | p95 | runs | round-trips (handler / auth) | response | Status | Notes |");
  p("|---|---|---:|---:|---:|---:|---|---:|---|---|");
  for (const e of [...E].sort((x, y) => (y.crashed - x.crashed) || (y.timedOut - x.timedOut) || (y.p95Ms || 0) - (x.p95Ms || 0))) {
    p(`| ${esc(e.endpoint)} | ${esc(e.scenario)} [${e.id}] | ${e.httpStatus ?? "—"} | ${ms(e.p50Ms)} | ${ms(e.p95Ms)} | ${e.runs + (e.firstMs != null ? 1 : 0)} | ${n(e.roundTrips)} (${n(e.handlerRoundTrips)} / ${n(e.authRoundTrips)}) | ${e.responseBytes != null ? `${n(e.responseBytes / 1024, 0)} KB` : "—"} | ${e.status} | ${esc(e.notes.join("; "))} |`);
  }
  p();

  // ---- pagination ----
  const pag = E.filter((e) => /-(p1|p100|p1000|last)$|-2y-(p100|p1000|last)$/.test(e.id));
  if (pag.length) {
    p("## Pagination depth");
    p();
    p("| Endpoint | page [id] | p50 | p95 | handler round-trips | Status |");
    p("|---|---|---:|---:|---:|---|");
    for (const e of pag.sort((x, y) => x.endpoint.localeCompare(y.endpoint) || x.id.localeCompare(y.id))) p(`| ${esc(e.endpoint)} | ${esc(e.scenario)} [${e.id}] | ${ms(e.p50Ms)} | ${ms(e.p95Ms)} | ${n(e.handlerRoundTrips)} | ${e.status} |`);
    p();
  }

  // ---- red flags ----
  p("## Inventory red flags — measured verdict");
  p();
  p("| RF | scenarios | endpoint FAIL / WARN / PASS | worst endpoint p95 | worst query |");
  p("|---|---:|---|---:|---|");
  const rfs = [...new Set(E.map((e) => e.rf).filter(Boolean))].sort((x, y) => Number(x.slice(3)) - Number(y.slice(3)));
  for (const rf of rfs) {
    const es = E.filter((e) => e.rf === rf);
    const qs = Q.filter((q) => q.rf === rf && q.kind !== "write").sort((x, y) => (y.before.p95Ms || 0) - (x.before.p95Ms || 0));
    const we = es.reduce((w, e) => ((e.p95Ms || 0) > (w?.p95Ms || -1) ? e : w), null);
    p(`| ${rf} | ${es.length} | ${cnt(es, "FAIL")} / ${cnt(es, "WARN")} / ${cnt(es, "PASS")} | ${ms(we?.p95Ms)} (${we?.id}) | ${qs[0] ? `${qs[0].id} ${qs[0].collection} ${ms(qs[0].before.p95Ms)} [${qs[0].scenarioId}]` : "—"} |`);
  }
  p();

  // ---- findings ----
  if (fmap.findings?.length) {
    p("## Candidate findings (grouped by root cause)");
    p();
    p("| Finding | Severity | Title | queries | worst p95 |");
    p("|---|---|---|---:|---:|");
    for (const f of fmap.findings) {
      const qs = Q.filter((q) => q.findingId === f.id);
      const es = E.filter((e) => (f.endpoints || []).includes(e.id));
      const worst = Math.max(0, ...qs.map((q) => q.before.p95Ms || 0), ...es.map((e) => e.p95Ms || 0));
      p(`| ${f.id} | ${f.severity} | ${esc(f.title)} | ${qs.length} | ${ms(worst)} |`);
    }
    p();
  }

  // ---- indexes ----
  if (a.indexes.length) {
    p("## Index usage during the measurement run");
    p();
    p("Ops = `$indexStats.accesses.ops` delta over this run (reads issued by the scenarios above; writes do not count). \"unused\" means no scenario used it — a scenario gap is possible, so treat as a candidate. \"redundant\" = its key is a strict prefix of another non-special index on the same collection.");
    p();
    p("| Collection | Index | Size MB | Ops | Verdict | Prefix of |");
    p("|---|---|---:|---:|---|---|");
    for (const i of [...a.indexes].filter((i) => i.verdict !== "used").sort((x, y) => y.sizeMB - x.sizeMB)) p(`| ${i.collection} | \`${i.name}\` | ${n(i.sizeMB, 2)} | ${n(i.ops)} | ${i.verdict} | ${i.prefixOf ? `\`${i.prefixOf}\`` : ""} |`);
    const used = a.indexes.filter((i) => i.verdict === "used");
    p();
    p(`Used (${used.length}): ${used.sort((x, y) => y.ops - x.ops).map((i) => `${i.collection}.${i.name} (${n(i.ops)})`).join(", ")}.`);
    p();
  }

  // ---- cache ----
  if (a.cache.length) {
    p("## Redis cache");
    p();
    p("| Endpoint (mix) | requests | hit ratio | hit p50 / p95 | miss p50 / p95 | TTL on all keys | version keys without TTL | sale writes (avg ms) |");
    p("|---|---:|---:|---|---|---|---:|---|");
    for (const c of a.cache) p(`| ${esc(c.endpoint)} | ${c.requests} | ${n(c.hitRatio * 100, 0)}% | ${ms(c.hitP50Ms)} / ${ms(c.hitP95Ms)} | ${ms(c.missP50Ms)} / ${ms(c.missP95Ms)} | ${c.ttl ? "yes" : "no"} | ${c.versionKeysWithoutTtl} of ${c.versionKeys} | ${c.writes} (${ms(c.writeAvgMs)}) |`);
    p();
  }

  // ---- all FAIL queries ----
  p("## Every FAIL / WARN query (distinct id, worst scenario)");
  p();
  p("| Query | Collection | Endpoint [scenario] | Plan | docs examined / returned | p95 | Status | Why |");
  p("|---|---|---|---|---|---:|---|---|");
  for (const q of U.filter((q) => q.status !== "PASS").sort((x, y) => (y.status === "FAIL") - (x.status === "FAIL") || (SEV[y.severity] || 0) - (SEV[x.severity] || 0) || (y.before.p95Ms || 0) - (x.before.p95Ms || 0))) {
    p(`| ${q.id} \`${q.source}\` | ${q.collection} | ${esc(q.endpoint)} [${q.scenarioId}] | \`${esc(q.before.plan)}\` | ${n(q.before.docsExamined)} / ${n(q.before.nReturned)} | ${q.timedOut ? "timeout" : ms(q.before.p95Ms)} | ${q.status} ${q.severity || ""} | ${esc((q.reasons || []).join("; "))} |`);
  }
  p();
  fs.writeFileSync(path.join(P2, "MEASURE.md"), L.join("\n"));
  writeFindings(a, fmap);
};

const writeFindings = (a, fmap) => {
  const L = [];
  const p = (s = "") => L.push(s);
  p("# Phase 2 — candidate findings (MODE: measure)");
  p();
  p("Generated by `perf/measure/build.js` from `query-audit.json` (grouping rules in `perf/measure/findings.js`). Candidates for the auditor; \"Fix verified\" is filled by MODE: experiment. Dataset: tenant megamart (1.10M sales, 275k products, 496k variants, 330k customers, 220k orders, 1.54M ledger rows), MongoDB 7.0, 1.5 GB WiredTiger cache, data not cache-resident.");
  p();
  for (const f of fmap.findings || []) {
    const qs = a.queries.filter((q) => q.findingId === f.id);
    const es = a.endpoints.filter((e) => (f.endpoints || []).includes(e.id));
    if (!qs.length && !es.length) continue;
    const wq = [...qs].sort((x, y) => (y.timedOut - x.timedOut) || (y.before.p95Ms || 0) - (x.before.p95Ms || 0))[0];
    const exQ = [...qs].filter((q) => q.before.docsExamined != null).sort((x, y) => (y.before.docsExamined || 0) - (x.before.docsExamined || 0))[0];
    const we = [...es].sort((x, y) => (y.crashed - x.crashed) || (y.p95Ms || 0) - (x.p95Ms || 0))[0];
    const ids = [...new Set(qs.map((q) => q.id.split(".")[0]))].sort();
    const status = qs.some((q) => q.status === "FAIL") || es.some((e) => e.status === "FAIL") ? "FAIL" : "WARN";
    p(`## ${f.id} — ${f.title}`);
    p(`- Status / suggested severity: ${status} / ${f.severity}${f.rf ? ` (inventory ${f.rf})` : ""}`);
    p(`- Query: ${ids.slice(0, 25).join(", ")}${ids.length > 25 ? ` … (+${ids.length - 25})` : ""}${wq ? ` — worst \`${wq.source}\`` : ""} · Endpoint: ${[...new Set([...es.map((e) => e.endpoint), ...qs.map((q) => q.endpoint)])].slice(0, 8).join(", ")}`);
    if (wq) p(`- Scenario (dataset size, parameters): ${wq.collection} (${n(a.meta.dataset[wq.collection])} docs all tenants), ${wq.scenario}`);
    const ev = [];
    if (wq) ev.push(`worst query ${wq.id}: plan \`${wq.before.plan}\` index ${wq.before.indexUsed || "none"}, keys ${n(wq.before.keysExamined)}, docs ${n(wq.before.docsExamined)}, returned ${n(wq.before.nReturned)}${wq.rows != null ? `, rows to client ${n(wq.rows)}` : ""}, ${wq.kind === "write" ? `explain executionTimeMillis ${n(wq.before.explainMs)} ms (write: explained, not executed)` : `p50 ${wq.timedOut ? "—" : ms(wq.before.p50Ms)} / p95 ${wq.timedOut ? `>${ms(wq.before.p95Ms)} (killed)` : ms(wq.before.p95Ms)}`}${wq.before.inMemorySort ? ", in-memory SORT" : ""}${wq.before.usedDisk ? ", usedDisk" : ""}`);
    if (exQ && exQ !== wq) ev.push(`largest scan ${exQ.id} [${exQ.scenarioId}]: docs ${n(exQ.before.docsExamined)} for ${n(exQ.matched ?? exQ.before.nReturned)} matched, p95 ${ms(exQ.before.p95Ms)}`);
    if (we) ev.push(`endpoint ${we.endpoint} [${we.id}]: ${we.crashed ? "process crashed (heap OOM)" : `p50 ${ms(we.p50Ms)} / p95 ${ms(we.p95Ms)}${we.timedOut ? " (DB op killed at limit)" : ""}`}, round-trips ${n(we.roundTrips)} (handler ${n(we.handlerRoundTrips)}), response ${we.responseBytes != null ? `${n(we.responseBytes / 1024)} KB` : "—"}`);
    ev.push(`${qs.filter((q) => q.status === "FAIL").length} FAIL / ${qs.filter((q) => q.status === "WARN").length} WARN query measurements, ${es.filter((e) => e.status === "FAIL").length}/${es.length} endpoint scenarios FAIL`);
    if (wq?.reasons?.length) ev.push(`breaks: ${wq.reasons.join("; ")}`);
    p(`- Evidence: ${ev.join("; ")}`);
    p("- Expected: no COLLSCAN / tenant-wide scan on a >100k collection, docsExamined/returned ≤ 10, no blocking sort over >1k docs, bounded result sets, query p95 ≤ 50 ms, endpoint p95 ≤ 200 ms, ≤ 5 handler round-trips");
    p(`- Recommended fix: ${f.recommendation || "see per-query reasons in query-audit.json"}`);
    const ver = fmap.verified?.[f.id];
    p(`- Fix verified on perf DB: ${ver ? "\n  - " + ver.join("\n  - ") : "not testable as an index/query-shape change on the perf DB (code-level change only) — see recommendation"}`);
    p(`- Tradeoff: ${f.tradeoff || "new indexes add write cost and RAM; measure in MODE: experiment"}`);
    p();
  }
  for (const extra of fmap.extra ? fmap.extra(a) : []) {
    const id = (extra.match(/^## (F-\d+)/) || [])[1];
    const ver = fmap.verified?.[id];
    L.push(ver ? extra.replace("- Fix verified on perf DB: pending (MODE: experiment)", "- Fix verified on perf DB: \n  - " + ver.join("\n  - ")) : extra.replace("pending (MODE: experiment)", "not testable on the perf DB without a code change (see recommendation)"), "");
  }
  fs.writeFileSync(path.join(P2, "FINDINGS.md"), L.join("\n"));
};

module.exports = { render };
