// Renders reports/phase2/QUERY_INVENTORY.md from the inventory object built in index.js.
// The hand-written red-flag review lives in perf/inventory/curated.md and is spliced in.
const fs = require("fs");
const path = require("path");

const esc = (s) => String(s == null ? "" : s).replace(/\|/g, "\\|").replace(/\n/g, " ");
const cut = (s, n) => {
  s = String(s == null ? "" : s);
  return s.length > n ? `${s.slice(0, n)}…` : s;
};
const fmt = (n) => Number(n || 0).toLocaleString("en-US");

module.exports = (inv) => {
  const { ops, counts } = inv;
  const live = ops.filter((o) => !o.offline);
  const offline = ops.filter((o) => o.offline);
  const L = [];
  const p = (s = "") => L.push(s);

  p("# Phase 2 — Query inventory");
  p();
  p(`Generated ${inv.generatedAt} by \`npm run perf:inventory\` (\`perf/inventory/\`). Re-run after any change in \`src/\`.`);
  p();
  p("Method: every `.js` file in `src/` is parsed with `@babel/parser`; each Mongoose / native-driver call on a model");
  p("(find, findOne, findById, aggregate, countDocuments, distinct, exists, update*/delete*/findOneAnd*, bulkWrite,");
  p("create/insertMany, Model.populate) is resolved to its model and collection, its enclosing function, and through a");
  p("cross-file call graph to the route(s) or job that reach it. Query shape (filter keys, sort, projection, limit/skip,");
  p("populate, $lookup) is read from the AST, following local variables (`const filter = {}; filter.x = …`, `pipeline.push`,");
  p("`let q = Model.find(); q.limit()`). Index checks use the LIVE index list of the perf DB (`velor_perf`, built from the app");
  p("schemas by `syncAppIndexes()`), so they match what production would build. Static analysis only — nothing here is measured;");
  p("every flag is a candidate for MODE: measure, not a finding.");
  p();
  p("All tenant models apply `tenantPlugin`: every query/aggregate gets `{ tenantId }` ANDed in (aggregate: a leading");
  p("`$match {tenantId}`), and every schema index becomes `{ tenantId: 1, …}`. So \"index serves the query\" below means a");
  p("`tenantId`-leading index whose next key(s) are filter/sort fields. Text and TTL indexes stay unscoped.");
  p();

  // ---------------- summary
  p("## Summary");
  p();
  p(`- **${ops.length} database operations** in \`src/\`: ${live.length} on runtime paths (HTTP, hooks, workers, cron, socket) + ${offline.length} in offline CLIs (migrations, seeders, scripts).`);
  const byOp = {};
  for (const o of ops) byOp[o.op] = (byOp[o.op] || 0) + 1;
  p(`- By operation: ${Object.entries(byOp).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(", ")}.`);
  const popCount = ops.reduce((s, o) => s + (o.op === "populate" ? 1 : o.populate.length), 0);
  const lookupCount = ops.reduce((s, o) => s + (o.pipeline ? o.pipeline.lookups.length : 0), 0);
  p(`- Plus ${popCount} \`.populate()\` calls chained on those queries (each is ≥1 extra round-trip) and ${lookupCount} \`$lookup\`/\`$unionWith\` stages resolved statically (pipelines assembled by helper functions are listed as \`...helper()\`).`);
  const routed = live.filter((o) => o.routes.length).length;
  p(`- ${routed} runtime operations map to at least one HTTP route; the rest run in middleware, model hooks, workers, cron, socket.io or are unrouted.`);
  p();
  p("### Per collection");
  p();
  p("| Collection | Docs in perf DB | Ops (runtime) | Ops (offline) | read | write | Flagged ops |");
  p("|---|---:|---:|---:|---:|---:|---:|");
  const byColl = {};
  for (const o of ops) {
    const c = o.collection || "(unresolved)";
    const e = (byColl[c] = byColl[c] || { rt: 0, off: 0, r: 0, w: 0, f: 0 });
    if (o.offline) e.off++;
    else e.rt++;
    if (["find", "findOne", "findById", "aggregate", "countDocuments", "distinct", "exists", "populate", "estimatedDocumentCount"].includes(o.op)) e.r++;
    else e.w++;
    if (!o.offline && o.flags.some((f) => !/^(POPULATE×|CACHED|NO-LIMIT)/.test(f))) e.f++;
  }
  const collOrder = Object.keys(byColl).sort((a, b) => (counts[b.split("|")[0]] || 0) - (counts[a.split("|")[0]] || 0) || byColl[b].rt - byColl[a].rt);
  for (const c of collOrder) {
    const e = byColl[c];
    p(`| ${esc(c)} | ${fmt(counts[c.split("|")[0]])} | ${e.rt} | ${e.off} | ${e.r} | ${e.w} | ${e.f} |`);
  }
  p();

  // ---------------- curated
  const curatedFile = path.join(__dirname, "curated.md");
  if (fs.existsSync(curatedFile)) {
    p(fs.readFileSync(curatedFile, "utf8").trim());
    p();
  }

  // ---------------- flag index
  p("## Automatic flag index (runtime paths only)");
  p();
  p("Flags are heuristics from static analysis; the curated list above is the reviewed subset. Legend:");
  p();
  const legend = {
    UNBOUNDED: "`find` with no `.limit()` on a collection ≥100k docs, not keyed by `_id`/unique key (`(medium)`: 10k–100k)",
    "UNBOUNDED(agg)": "aggregate with no `$limit` and no `$group/$count` on a ≥100k collection — returns every matching doc",
    "FULL-TENANT-AGG": "aggregate with no `$match` beyond tenantId on a ≥100k collection (reads the whole tenant)",
    "NO-LIMIT(bounded by …)": "no `.limit()` but keyed by a unique key or a 1:few reference — informational",
    SKIP: "`.skip()` / `$skip` pagination (cost grows with page number)",
    REGEX: "`$regex` / `new RegExp` in the filter; `(unanchored)` = no `^` found in the builder, `+i` = case-insensitive (cannot use an index range)",
    "N+1": "DB call inside a `for` loop or `.map/.forEach` callback — round-trips grow with input size",
    "POPULATE×n": "n `.populate()` calls (each = 1 extra query per populated path)",
    "POPULATE-IN-LOOP": "populate executed per loop iteration",
    "POPULATE-VARIANT": "populates a Variant path → also fires the Variant `post('find')` hook (one extra unindexed `purchases` query)",
    "TRIGGERS-VARIANT-POST-FIND": "`Variant.find` → fires the `post('find')` hook (Q-935)",
    "NO-SELECTIVE-INDEX": "no tenantId-leading index whose 2nd key is any filter field: scans every doc of the tenant",
    "TENANT-SCAN": "filter is only `{tenantId}` (empty user filter) on a ≥10k collection",
    "SORT-UNINDEXED": "no index provides the sort after the equality fields (ESR) → blocking in-memory SORT",
    "COUNT-PER-LIST": "`countDocuments` executed on every paginated list request",
    "$NE / $NIN": "negation predicates on ≥10k collections (not selective)",
    "DISTINCT-LARGE": "`distinct` over a ≥100k collection",
    "LOOKUP-UNINDEXED / LOOKUP-PIPELINE": "`$lookup` whose foreign field has no index / correlated `let`+pipeline lookup into a ≥10k collection",
    "$TEXT": "`$text` uses the unscoped text index (not tenant-prefixed)",
    NATIVE: "native driver call (`Model.collection.*`) — bypasses tenantPlugin scoping and Mongoose hooks",
    "CACHED(redis)": "enclosing handler reads a Redis cache first (DB cost only on miss) — measure hit ratio",
    UNROUTED: "handler not referenced by any route file (dead code or dynamic)",
  };
  p("| Flag | Meaning |");
  p("|---|---|");
  for (const [k, v] of Object.entries(legend)) p(`| ${esc(k)} | ${v} |`);
  p();
  const flagMap = {};
  for (const o of live) for (const f of o.flags) {
    const k = f.replace(/\(.*$/, "").replace(/×\d+$/, "×n");
    (flagMap[k] = flagMap[k] || []).push(o.id);
  }
  p("| Flag | Count | Query ids |");
  p("|---|---:|---|");
  for (const [k, ids] of Object.entries(flagMap).sort((a, b) => b[1].length - a[1].length)) p(`| ${esc(k)} | ${ids.length} | ${ids.join(", ")} |`);
  p();

  // ---------------- per collection tables
  p("## Inventory by collection (runtime paths)");
  p();
  p("Columns: **Trigger** = route(s) / hook / job that reach the call (via call graph). **Filter** = keys of the filter or first `$match`");
  p("(`{$op}` = operators used; `...x` = spread not resolved statically). **Shape** = sort · projection · limit/skip · populate / pipeline stages.");
  p("**User input** = request-derived variables that flow into the filter. **Index** = the tenantId-leading index the planner can use for");
  p("the filter (`—` none) and whether one serves the sort. **Worst case** = parameters MODE: measure must use.");
  p();
  for (const c of collOrder) {
    const rows = live.filter((o) => (o.collection || "(unresolved)") === c);
    if (!rows.length) continue;
    p(`### ${c} — ${fmt(counts[c.split("|")[0]])} docs, ${rows.length} ops`);
    p();
    p("| ID | Source | Trigger | Op | Filter | Shape | User input | Index (filter / sort) | Flags | Worst case |");
    p("|---|---|---|---|---|---|---|---|---|---|");
    for (const o of rows) {
      const shape = [];
      if (o.sort) shape.push(`sort ${o.sort}`);
      if (o.projection) shape.push(`proj ${cut(o.projection, 50)}`);
      if (o.limit) shape.push(`limit ${cut(o.limit, 20)}`);
      if (o.skip) shape.push("skip");
      if (o.lean) shape.push("lean");
      if (o.populate.length) shape.push(`populate ${o.populate.map((x) => cut(x, 50)).join(" + ")}`);
      if (o.pipeline) {
        shape.push(`pipeline ${cut(o.pipeline.stages.join(">"), 160)}`);
        if (o.pipeline.lookups.length) shape.push(`$lookup ${o.pipeline.lookups.map((l) => `${l.from}.${l.foreignField || (l.unionWith ? "(union)" : "(pipeline)")}${l.indexed === false ? " UNINDEXED" : ""}`).join(", ")}`);
      }
      if (o.distinctField) shape.push(`distinct ${o.distinctField}`);
      if (o.native) shape.push("native driver");
      const idx = `${o.index.selective || "—"} / ${o.index.sortOk || "n/a"}`;
      const filt = o.filterKeys.length ? o.filterKeys.join(", ") : o.op === "create" || o.op === "insertMany" || o.op === "insertOne" || o.op === "bulkWrite" ? "(write)" : "";
      const isWrite = ["create", "insertMany", "insertOne"].includes(o.op);
      p(`| ${o.id} | ${esc(`${o.file.replace(/^src\//, "")}:${o.line}`)} (${esc(o.fn || "?")}) | ${esc(cut(o.trigger, 140))} | ${o.op} | ${esc(cut(filt, 120))} | ${esc(shape.join(" · "))} | ${esc([...new Set(o.userInput)].join(", "))} | ${isWrite ? "" : esc(idx)} | ${esc(o.flags.join(" "))} | ${isWrite ? "" : esc(o.worstCase)} |`);
    }
    p();
  }

  // ---------------- offline
  p("## Offline operations (migrations, seeders, scripts — run by hand, not on a request path)");
  p();
  p("Listed for completeness; not measured in Phase 2 except where noted in the curated list.");
  p();
  p("| ID | Source | Collection | Op | Filter | Shape | Flags |");
  p("|---|---|---|---|---|---|---|");
  for (const o of offline) {
    const shape = [o.sort && `sort ${o.sort}`, o.limit && `limit ${o.limit}`, o.populate.length && `populate ×${o.populate.length}`, o.pipeline && cut(o.pipeline.stages.join(">"), 80), o.native && "native"].filter(Boolean).join(" · ");
    p(`| ${o.id} | ${esc(`${o.file.replace(/^src\//, "")}:${o.line}`)} | ${esc(o.collection)} | ${o.op} | ${esc(cut(o.filterKeys.join(", "), 80))} | ${esc(shape)} | ${esc(o.flags.join(" "))} |`);
  }
  p();
  return `${L.join("\n")}\n`;
};
