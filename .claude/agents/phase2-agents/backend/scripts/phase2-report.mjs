#!/usr/bin/env node
// Phase 2 query performance report → reports/phase2/phase2-report.html
// Input: reports/phase2/query-audit.json (schema in phase2-query-engineer.md)
// Optional: BUGS_FOUND.md (Phase 2 block), reports/phase2/AUDIT.md
// No dependencies. Usage (from the backend folder): node scripts/phase2-report.mjs [backendRoot]

import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] || process.cwd());
const p = (...s) => path.join(root, ...s);
const readText = (f) => (fs.existsSync(f) ? fs.readFileSync(f, "utf8") : "");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const auditFile = p("reports", "phase2", "query-audit.json");
if (!fs.existsSync(auditFile)) {
  console.error("reports/phase2/query-audit.json not found. Run the phase2-query-engineer measure step first.");
  process.exit(1);
}
const data = JSON.parse(fs.readFileSync(auditFile, "utf8"));
const meta = data.meta || {};
const queries = data.queries || [];
const endpoints = data.endpoints || [];
const indexes = data.indexes || [];
const cache = data.cache || [];
const experiments = data.experiments || [];

// ---- Phase 2 bugs from BUGS_FOUND.md (only inside the PHASE2 markers) ----
const bugsMd = readText(p("BUGS_FOUND.md"));
const block = bugsMd.match(/<!--\s*PHASE2:START\s*-->([\s\S]*?)<!--\s*PHASE2:END\s*-->/)?.[1] || "";
const bugs = [];
for (const m of block.matchAll(/^##\s+(BUG-P2-\d+)\s*[—–-]\s*(.+)$/gm)) {
  const after = block.slice(m.index, m.index + 800);
  bugs.push({
    id: m[1],
    title: m[2].trim(),
    severity: (after.match(/Severity:\**\s*(critical|high|medium|low)/i)?.[1] || "unknown").toLowerCase(),
    status: after.match(/Status:\**\s*([^\n]+)/i)?.[1]?.trim() || "Open",
  });
}
const auditMd = readText(p("reports", "phase2", "AUDIT.md"));
const auditVerdict = auditMd.match(/\b(PASS WITH GAPS|PASS|FAIL)\b/)?.[1] || null;

// ---- numbers ----
const count = (st) => queries.filter((q) => q.status === st).length;
const sevCount = (s) => (bugs.length ? bugs.filter((b) => b.severity === s && !/fixed/i.test(b.status)).length : queries.filter((q) => q.status !== "PASS" && q.severity === s).length);
const collscans = queries.filter((q) => /COLLSCAN/i.test(q.before?.plan || "")).length;
const memSorts = queries.filter((q) => q.before?.inMemorySort || q.before?.usedDisk).length;
const nPlusOne = endpoints.filter((e) => (e.roundTrips || 0) > 5).length;
const worstQ = [...queries].sort((a, b) => (b.before?.p95Ms || 0) - (a.before?.p95Ms || 0));
const worstE = [...endpoints].sort((a, b) => (b.p95Ms || 0) - (a.p95Ms || 0));
const ratio = (q) => (q.before?.nReturned ? q.before.docsExamined / q.before.nReturned : q.before?.docsExamined || 0);

let verdict = "READY";
if (sevCount("critical") > 0 || auditVerdict === "FAIL") verdict = "NOT READY";
else if (sevCount("high") > 0 || count("FAIL") > 0 || auditVerdict === "PASS WITH GAPS") verdict = "READY WITH GAPS";

// ---- html helpers ----
const fmt = (n) => (n == null ? "—" : Number(n).toLocaleString("en-US", { maximumFractionDigits: 1 }));
const ms = (n) => (n == null ? "—" : `${fmt(n)} ms`);
const statusTag = (s) => `<span class="tag ${s === "PASS" ? "good" : s === "WARN" ? "warn" : s === "FAIL" ? "bad" : ""}">${esc(s || "—")}</span>`;
const sevTag = (s) => `<span class="tag ${s === "critical" || s === "high" ? "bad" : s === "medium" ? "warn" : ""}">${esc(s || "—")}</span>`;
const verdictTag = (v) => `<span class="tag big ${v === "READY" ? "good" : v === "NOT READY" ? "bad" : "warn"}">${esc(v)}</span>`;
const maxP95 = Math.max(1, ...queries.map((q) => q.before?.p95Ms || 0));
// log scale bar so 4ms and 4000ms are both visible
const lbar = (v, cls) => { const w = v > 0 ? Math.max(2, (Math.log10(v + 1) / Math.log10(maxP95 + 1)) * 100) : 0; return `<div class="bar"><span class="${cls}" style="width:${w}%"></span></div>`; };
const tone = (v) => (v > 200 ? "bad" : v > 50 ? "warn" : "good");

const kpi = (label, value, t = "") => `<div class="kpi ${t}"><b>${esc(value)}</b><span>${esc(label)}</span></div>`;
const datasetRows = Object.entries(meta.dataset || {}).sort((a, b) => b[1] - a[1]);

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Phase 2 Query Report</title>
<style>
:root{--bg:#f6f7f9;--card:#fff;--ink:#14171c;--muted:#5d6672;--line:#e3e6ea;--good:#1a7f4b;--warn:#b26a00;--bad:#c62828;--goodbg:#e3f4ea;--warnbg:#fff1d6;--badbg:#fde4e4;--neutral:#eef0f3}
@media (prefers-color-scheme:dark){:root{--bg:#0f1115;--card:#171a20;--ink:#e8eaed;--muted:#9aa3ad;--line:#2a2f37;--good:#4cc38a;--warn:#f0b04a;--bad:#ff6b6b;--goodbg:#143024;--warnbg:#3a2c12;--badbg:#3a1717;--neutral:#242932}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:1150px;margin:0 auto;padding:24px 16px 64px}
h1{font-size:26px;margin:0 0 4px}h2{font-size:18px;margin:32px 0 12px}.sub{color:var(--muted);margin:0 0 20px}
.hero{display:flex;flex-wrap:wrap;gap:16px;align-items:center;justify-content:space-between;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:18px 20px}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-top:16px}
.kpi{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 16px}.kpi b{display:block;font-size:24px;font-variant-numeric:tabular-nums}.kpi span{color:var(--muted);font-size:13px}
.kpi.good b{color:var(--good)}.kpi.bad b{color:var(--bad)}.kpi.warn b{color:var(--warn)}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;overflow-x:auto}
table{width:100%;border-collapse:collapse;font-size:14px}th,td{padding:10px 14px;text-align:left;border-bottom:1px solid var(--line);white-space:nowrap;vertical-align:top}
th{color:var(--muted);font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.03em}tr:last-child td{border-bottom:0}
td.num{font-variant-numeric:tabular-nums;text-align:right}td.wrap{white-space:normal;min-width:240px}
code{font-size:12.5px;background:var(--neutral);padding:1px 6px;border-radius:4px}
.tag{display:inline-block;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:700;background:var(--neutral);color:var(--muted)}
.tag.good{background:var(--goodbg);color:var(--good)}.tag.warn{background:var(--warnbg);color:var(--warn)}.tag.bad{background:var(--badbg);color:var(--bad)}.tag.big{font-size:15px;padding:6px 14px}
.bar{height:8px;background:var(--line);border-radius:4px;min-width:110px;overflow:hidden}.bar span{display:block;height:100%}.bar .good{background:var(--good)}.bar .warn{background:var(--warn)}.bar .bad{background:var(--bad)}
.small{color:var(--muted);font-size:12.5px}.arrow{color:var(--good);font-weight:700}
.empty{color:var(--muted);padding:14px}
</style></head><body><main>
<h1>Phase 2 — Million-Data Query Performance</h1>
<p class="sub">Run ${esc((meta.runAt || "").replace("T", " ").slice(0, 16))} · MongoDB ${esc(meta.mongoVersion || "?")} · WiredTiger cache ${esc(meta.wiredTigerCacheGB ?? "?")} GB · data ${esc(meta.dataSizeGB ?? "?")} GB · indexes ${esc(meta.indexSizeGB ?? "?")} GB</p>

<div class="hero"><div><div class="small">Readiness for Phase 3 (load &amp; scalability)</div><div style="margin-top:6px">${verdictTag(verdict)}</div></div>
<div class="small">Phase 2 bugs: <b style="color:var(--bad)">${sevCount("critical")}</b> critical · <b>${sevCount("high")}</b> high · ${sevCount("medium")} medium · ${sevCount("low")} low${auditVerdict ? ` · audit ${statusTag(auditVerdict === "PASS WITH GAPS" ? "WARN" : auditVerdict)}` : ""}</div></div>

<div class="kpis">
${kpi("Queries measured", queries.length)}
${kpi("Pass", count("PASS"), "good")}
${kpi("Warn", count("WARN"), count("WARN") ? "warn" : "")}
${kpi("Fail", count("FAIL"), count("FAIL") ? "bad" : "good")}
${kpi("COLLSCAN", collscans, collscans ? "bad" : "good")}
${kpi("In-memory sorts", memSorts, memSorts ? "bad" : "good")}
${kpi("N+1 endpoints", nPlusOne, nPlusOne ? "bad" : "good")}
${kpi("Worst query p95", ms(worstQ[0]?.before?.p95Ms), tone(worstQ[0]?.before?.p95Ms || 0))}
</div>

${datasetRows.length ? `<h2>Dataset</h2><div class="kpis">${datasetRows.map(([c, n]) => kpi(c, fmt(n))).join("")}</div>` : ""}

<h2>All queries (slowest first)</h2>
<div class="card"><table><thead><tr><th>ID</th><th>Query</th><th>Plan</th><th class="num">Docs examined / returned</th><th>p95 before</th><th class="num">p95 after</th><th>Status</th></tr></thead><tbody>
${worstQ.map((q) => { const b = q.before || {}; const a = q.after; return `<tr>
<td><b>${esc(q.id)}</b></td>
<td class="wrap"><b>${esc(q.name)}</b><br><span class="small">${esc(q.endpoint || "")} · ${esc(q.collection)} · ${esc(q.scenario || "")}</span><br><span class="small">${esc(q.source || "")}</span></td>
<td><code>${esc(b.plan || "—")}</code>${b.inMemorySort ? ` <span class="tag bad">SORT</span>` : ""}${b.usedDisk ? ` <span class="tag bad">DISK</span>` : ""}<br><span class="small">${esc(b.indexUsed || "no index")}</span></td>
<td class="num">${fmt(b.docsExamined)} / ${fmt(b.nReturned)}<br><span class="small">ratio ${fmt(ratio(q))}</span></td>
<td>${lbar(b.p95Ms || 0, tone(b.p95Ms || 0))}<span class="small">${ms(b.p95Ms)} (p50 ${ms(b.p50Ms)})</span></td>
<td class="num">${a ? `<span class="arrow">${ms(a.p95Ms)}</span><br><span class="small">${esc(a.plan || "")}</span>` : "—"}</td>
<td>${statusTag(q.status)}${q.severity && q.status !== "PASS" ? `<br>${sevTag(q.severity)}` : ""}</td></tr>`; }).join("") || `<tr><td class="empty" colspan="7">No queries in query-audit.json</td></tr>`}
</tbody></table></div>

<h2>Endpoints</h2>
<div class="card"><table><thead><tr><th>Endpoint</th><th>Scenario</th><th class="num">p50</th><th class="num">p95</th><th class="num">DB round-trips</th><th>Status</th></tr></thead><tbody>
${worstE.map((e) => `<tr><td><b>${esc(e.endpoint)}</b></td><td class="wrap">${esc(e.scenario)}</td><td class="num">${ms(e.p50Ms)}</td><td class="num">${ms(e.p95Ms)}</td><td class="num" style="${(e.roundTrips || 0) > 5 ? "color:var(--bad);font-weight:700" : ""}">${fmt(e.roundTrips)}</td><td>${statusTag(e.status)}</td></tr>`).join("") || `<tr><td class="empty" colspan="6">No endpoint measurements</td></tr>`}
</tbody></table></div>

<h2>Index fixes — read gain vs write cost</h2>
<div class="card"><table><thead><tr><th>Finding</th><th>Change</th><th class="num">Read p95</th><th class="num">Write ops/sec</th><th class="num">Index size</th></tr></thead><tbody>
${experiments.map((x) => { const wd = x.writeOpsPerSecBefore ? ((x.writeOpsPerSecAfter - x.writeOpsPerSecBefore) / x.writeOpsPerSecBefore) * 100 : null; return `<tr><td><b>${esc(x.findingId)}</b></td><td class="wrap"><code>${esc(x.change)}</code></td><td class="num">${ms(x.readP95Before)} → <span class="arrow">${ms(x.readP95After)}</span></td><td class="num">${fmt(x.writeOpsPerSecBefore)} → ${fmt(x.writeOpsPerSecAfter)}${wd != null ? `<br><span class="small" style="color:${wd < -15 ? "var(--bad)" : "var(--muted)"}">${wd > 0 ? "+" : ""}${fmt(wd)}%</span>` : ""}</td><td class="num">${fmt(x.indexSizeMB)} MB</td></tr>`; }).join("") || `<tr><td class="empty" colspan="5">No experiments recorded</td></tr>`}
</tbody></table></div>

<h2>Existing indexes</h2>
<div class="card"><table><thead><tr><th>Collection</th><th>Index</th><th class="num">Size</th><th class="num">Ops during test</th><th>Verdict</th></tr></thead><tbody>
${[...indexes].sort((a, b) => (a.verdict === "used") - (b.verdict === "used") || b.sizeMB - a.sizeMB).map((i) => `<tr><td>${esc(i.collection)}</td><td><code>${esc(i.name)}</code></td><td class="num">${fmt(i.sizeMB)} MB</td><td class="num">${fmt(i.ops)}</td><td>${statusTag(i.verdict === "used" ? "PASS" : "WARN").replace(/>[A-Z]+</, `>${esc(i.verdict)}<`)}</td></tr>`).join("") || `<tr><td class="empty" colspan="5">No index stats</td></tr>`}
</tbody></table></div>

${cache.length ? `<h2>Redis cache</h2>
<div class="card"><table><thead><tr><th>Endpoint</th><th class="num">Hit ratio</th><th class="num">Hit p95</th><th class="num">Miss p95</th><th>TTL set</th></tr></thead><tbody>
${cache.map((c) => `<tr><td><b>${esc(c.endpoint)}</b></td><td class="num" style="color:${c.hitRatio < 0.7 ? "var(--warn)" : "var(--good)"}">${fmt(c.hitRatio * 100)}%</td><td class="num">${ms(c.hitP95Ms)}</td><td class="num">${ms(c.missP95Ms)}</td><td>${c.ttl ? statusTag("PASS").replace("PASS", "yes") : statusTag("FAIL").replace("FAIL", "no")}</td></tr>`).join("")}
</tbody></table></div>` : ""}

<h2>Phase 2 bugs (BUGS_FOUND.md)</h2>
<div class="card"><table><thead><tr><th>ID</th><th>Severity</th><th>Problem</th><th>Status</th></tr></thead><tbody>
${bugs.map((b) => `<tr><td><b>${esc(b.id)}</b></td><td>${sevTag(b.severity)}</td><td class="wrap">${esc(b.title)}</td><td>${esc(b.status)}</td></tr>`).join("") || `<tr><td class="empty" colspan="4">No Phase 2 block in BUGS_FOUND.md yet — the auditor writes it in MODE: report.</td></tr>`}
</tbody></table></div>
</main></body></html>`;

fs.mkdirSync(p("reports", "phase2"), { recursive: true });
fs.writeFileSync(p("reports", "phase2", "phase2-report.html"), html);
console.log(`✔ reports/phase2/phase2-report.html — ${verdict} | ${queries.length} queries: ${count("PASS")} pass, ${count("WARN")} warn, ${count("FAIL")} fail | ${collscans} COLLSCAN | ${bugs.length} Phase 2 bugs`);
