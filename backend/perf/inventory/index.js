// Phase 2 MODE: inventory — entry point. Guard runs first, always.
//
//   npm run perf:inventory
//
// 1. perf/inventory/extract.js statically extracts every DB operation in src/.
// 2. The live index set + collection counts are read from the PERF DB (read-only).
// 3. Each operation is flagged (unbounded, skip, regex, N+1, populate, sort/filter
//    not served by a tenantId-leading index, $lookup foreign field unindexed, ...).
// 4. Writes reports/phase2/query-inventory.json (machine-readable, used by MODE: measure)
//    and reports/phase2/QUERY_INVENTORY.md (generated tables; the curated red-flag
//    section lives in perf/inventory/curated.md and is spliced in).
const { assertPerfTarget } = require("../lib/guard");
const target = assertPerfTarget();

const fs = require("fs");
const path = require("path");
const { extract } = require("./extract");

const ROOT = path.join(__dirname, "..", "..");
const OUT_DIR = path.join(ROOT, "reports", "phase2");
const LARGE = 100000;
const MEDIUM = 10000;

// ---------------------------------------------------------------- helpers
const parseSort = (s) => {
  if (!s) return null;
  s = s.trim();
  if (/^["'`]/.test(s)) {
    return s
      .replace(/["'`]/g, "")
      .split(/\s+/)
      .filter(Boolean)
      .map((f) => (f.startsWith("-") ? [f.slice(1), -1] : [f, 1]));
  }
  if (s.startsWith("{")) {
    const out = [];
    const body = s.slice(1, -1);
    for (const part of body.split(",")) {
      const m = part.match(/^\s*["']?([\w.$]+)["']?\s*:\s*(-?1|["']?(?:asc|desc)["']?)/);
      if (m) out.push([m[1], /-1|desc/.test(m[2]) ? -1 : 1]);
      else if (part.includes("[")) out.push([`?${part.trim()}`, 1]);
    }
    return out.length ? out : [[`?${s.slice(0, 40)}`, 1]];
  }
  return [[`?${s.slice(0, 40)}`, 1]];
};

const plainField = (k) => {
  // filter key -> {field, kind}
  if (!k || k.startsWith("...") || k.startsWith("<") || k === "{}") return null;
  if (/^\$(or|and|nor)\(/.test(k)) return null;
  if (k.startsWith("$")) return null;
  const m = k.match(/^([^{]+)(\{(.*)\})?$/);
  if (!m) return null;
  const ops = m[3] ? m[3].split(",") : [];
  const eq = !ops.length || ops.every((o) => ["$in", "$eq"].includes(o));
  return { field: m[1].replace(/^\[|\]$/g, ""), eq, ops };
};

const orFields = (k) => {
  const m = k.match(/^\$(or|and|nor)\((.*)\)$/);
  return m ? m[2].split(",").map((x) => plainField(x)).filter(Boolean) : [];
};

const indexKeys = (idx) => Object.entries(idx.key);

/** best index for (equality fields, all fields, sort) on a tenant-scoped collection */
const analyzeIndexes = (indexes, filterKeys, sort, tenantScoped, collection) => {
  const fields = filterKeys.map(plainField).filter(Boolean);
  const eqSet = new Set(fields.filter((f) => f.eq).map((f) => f.field));
  if (tenantScoped) eqSet.add("tenantId");
  const allSet = new Set(fields.map((f) => f.field));
  const ors = filterKeys.flatMap(orFields);
  const res = { selective: null, sortOk: null, note: [] };

  if (allSet.has("_id")) {
    res.selective = "_id_";
  } else {
    let best = null;
    for (const idx of indexes) {
      const keys = indexKeys(idx).map(([k]) => k);
      if (keys.some((k) => k === "_fts")) continue;
      // leading prefix usable: tenantId (if scoped) then filter fields
      let used = 0;
      for (const k of keys) {
        if (allSet.has(k) || (tenantScoped && k === "tenantId")) used++;
        else break;
      }
      const nonTenant = keys.slice(0, used).filter((k) => k !== "tenantId").length;
      if (tenantScoped && keys[0] !== "tenantId") continue; // unscoped prefix can't serve a scoped query well
      if (nonTenant > 0 && (!best || nonTenant > best.n)) best = { name: idx.name, n: nonTenant };
    }
    if (best) res.selective = best.name;
    else if (!tenantScoped && fields.length) {
      // unscoped collection: any index whose first key is a filter field
      const i = indexes.find((idx) => allSet.has(indexKeys(idx)[0][0]));
      if (i) res.selective = i.name;
    }
    if (!res.selective && ors.length) {
      // every $or branch needs its own index
      const branchOk = ors.every((f) => f.field === "_id" || indexes.some((idx) => {
        const ks = indexKeys(idx).map(([k]) => k);
        return tenantScoped ? ks[0] === "tenantId" && ks[1] === f.field : ks[0] === f.field;
      }));
      if (branchOk) res.selective = "$or-branches";
      else res.note.push(`$or branch without index: ${ors.filter((f) => f.field !== "_id" && !indexes.some((idx) => indexKeys(idx).map(([k]) => k)[tenantScoped ? 1 : 0] === f.field)).map((f) => f.field).join(",")}`);
    }
  }

  const sortSpec = parseSort(sort);
  if (sortSpec && sortSpec.length) {
    if (sortSpec.some(([f]) => f.startsWith("?"))) res.sortOk = "dynamic";
    else if (sortSpec.length === 1 && sortSpec[0][0] === "_id" && !tenantScoped) res.sortOk = "_id_";
    else {
      // ESR: an index whose keys = [eq fields in any order..., sort fields in order (all same or all reversed direction)]
      for (const idx of indexes) {
        const keys = indexKeys(idx);
        let i = 0;
        while (i < keys.length && eqSet.has(keys[i][0]) && !sortSpec.some(([f]) => f === keys[i][0])) i++;
        const rest = keys.slice(i, i + sortSpec.length);
        if (rest.length < sortSpec.length) continue;
        const same = sortSpec.every(([f, d], j) => rest[j][0] === f && rest[j][1] === d);
        const rev = sortSpec.every(([f, d], j) => rest[j][0] === f && rest[j][1] === -d);
        if ((same || rev) && (!tenantScoped || keys[0][0] === "tenantId")) {
          res.sortOk = idx.name;
          break;
        }
      }
      if (!res.sortOk) {
        if (sortSpec[0][0] === "_id" && tenantScoped) res.sortOk = "NO (_id sort: only _id_ or tenantId_1 + in-memory sort)";
        else res.sortOk = "NO";
      }
    }
  }
  return res;
};

const WORST = {
  date: "widest UI range 2024-10-19..2026-10-19 (megamart, 1.10M sales)",
  createdAt: "widest range: 2 years (megamart)",
  category: "biggest category (megamart 62,052 products)",
  brand: "biggest brand (megamart 42,731 products)",
  customer: "top customer (21,093 invoices)",
  customerId: "top customer (21,093 invoices)",
  supplier: "top supplier (13,753 purchases)",
  supplierId: "top supplier (13,753 purchases)",
  isActive: "isActive=true (≈90% of docs)",
  salesType: "salesType=retailsale (majority)",
  invoiceStatus: "all statuses",
};

const worstCase = (o) => {
  const w = ["tenant=megamart"];
  const keys = o.filterKeys.join(" ");
  for (const [k, v] of Object.entries(WORST)) if (new RegExp(`\\b${k}\\b`).test(keys)) w.push(v);
  if (o.flags.includes("SKIP")) w.push("deepest reachable page (page=last, limit=max)");
  if (o.flags.some((f) => f.startsWith("REGEX"))) w.push('broad search term ("a" / 1 char)');
  if (o.op === "aggregate" && !o.limit) w.push("full tenant history, no date filter if optional");
  if (o.filterKeys.some((k) => k.includes("$in"))) w.push("largest $in list the caller can send");
  return [...new Set(w)].join("; ");
};

// ---------------------------------------------------------------- triggers
const triggerOf = (o) => {
  if (o.routes.length) return o.routes.length > 4 ? `${o.routes.slice(0, 4).join(", ")} (+${o.routes.length - 4} more)` : o.routes.join(", ");
  const f = o.file;
  if (o.fn && o.fn.startsWith("hook:")) {
    const model = o.hookModel || path.basename(f, ".js");
    return `model hook ${o.fn.slice(5)} on ${model} (every matching op)`;
  }
  if (f.includes("/jobs/purgeAuditLogs")) return "cron 03:00 Asia/Dhaka + once at startup (purgeAuditLogs)";
  if (f.includes("/jobs/")) return "cron job";
  if (f.includes("/workers/")) return `BullMQ worker (${path.basename(f, ".js")})`;
  if (f.includes("/socket/")) return "socket.io event";
  if (f.includes("/migrations/")) return "offline: npm run migrate";
  if (f.includes("/seeder/")) return "offline: seeder CLI";
  if (f.includes("/scripts/")) return "offline: script CLI";
  if (f.includes("/service/couriers")) return "courier service (called from order/courier controllers via instance)";
  if (o.fn && /^hook|pre|post/.test(o.fn)) return `model hook (${o.fn})`;
  return `unrouted (${o.roots.map((r) => r.split("#")[1]).join(",") || o.fn}) — dead code or called dynamically`;
};

const isOffline = (o) => /\/(migrations|seeder|scripts)\//.test(o.file);

// ---------------------------------------------------------------- main
(async () => {
  console.log(`[perf:inventory] target ok: db=${target.dbName}`);
  const { ops } = extract();

  const db = require("../lib/db");
  await db.connect();
  const native = db.mongoose.connection.db;
  const indexes = {};
  const counts = {};
  for (const c of await native.listCollections().toArray()) {
    if (c.type === "view") continue;
    indexes[c.name] = await native.collection(c.name).indexes();
    counts[c.name] = await native.collection(c.name).estimatedDocumentCount();
  }
  await db.disconnect();

  const sizeOf = (coll) => (coll ? Math.max(...coll.split("|").map((c) => counts[c] || 0)) : 0);
  const variantFinds = [];

  // stable ordering: by file, then line
  ops.sort((a, b) => (a.file === b.file ? a.line - b.line : a.file.localeCompare(b.file)));

  // detect "count on every list request": a countDocuments sharing a topFn with a find that pages
  const pagedFns = new Set(ops.filter((o) => (o.op === "find" && (o.skip || o.limit)) || (o.op === "aggregate" && o.skip)).map((o) => `${o.file}#${o.topFn}`));

  let n = 0;
  for (const o of ops) {
    o.id = `Q-${String(++n).padStart(3, "0")}`;
    o.size = sizeOf(o.collection);
    o.offline = isOffline(o);
    const large = o.size >= LARGE;
    const medium = o.size >= MEDIUM;
    const flags = [];
    const isRead = ["find", "findOne", "findById", "aggregate", "countDocuments", "distinct", "exists", "populate"].includes(o.op);
    const isFilterWrite = ["updateOne", "updateMany", "findOneAndUpdate", "findOneAndDelete", "deleteOne", "deleteMany", "replaceOne", "findOneAndReplace"].includes(o.op);

    const scoped = o.tenantScoped !== false;
    const idx = indexes[(o.collection || "").split("|")[0]] || [];
    const keys = o.filterKeys || [];
    const ia = analyzeIndexes(idx, keys, o.sort, scoped && !o.native, o.collection);
    o.index = ia;

    // bounded by key: equality on a unique index, or on a 1:few reference (cratetransactions.saleReference, salesreturns.invoiceNumber, ...)
    const eqFields = keys.map(plainField).filter((f) => f && f.eq).map((f) => f.field);
    const uniqueHit = idx.some((i) => i.unique && Object.keys(i.key).filter((k) => k !== "tenantId").length === 1 && eqFields.includes(Object.keys(i.key).find((k) => k !== "tenantId")));
    const refHit = eqFields.some((f) => /Reference$|^invoiceNumber$|^paymentId$|^order$|^conversation$/.test(f));
    o.boundedBy = uniqueHit ? "unique key" : refHit ? "1:few reference" : null;
    if (o.op === "find" && !o.limit && !keys.some((k) => /^_id/.test(k)) && (large || medium)) {
      if (o.boundedBy) flags.push(`NO-LIMIT(bounded by ${o.boundedBy})`);
      else flags.push(large ? "UNBOUNDED" : "UNBOUNDED(medium)");
    }
    if (o.op === "aggregate" && o.pipeline && !o.limit) {
      const st = o.pipeline.stages.join(" ");
      const reduces = /\$group|\$count|\$bucket|\$sortByCount/.test(st);
      if (!reduces && large) flags.push("UNBOUNDED(agg)");
      if (reduces && large && !keys.length) flags.push("FULL-TENANT-AGG");
    }
    if (o.op === "distinct" && large) flags.push("DISTINCT-LARGE");
    if (o.skip) flags.push("SKIP");
    if (o.hints.includes("$regex") || ((o.op === "find" || o.op === "countDocuments" || o.op === "aggregate") && o.fnHasRegex && keys.some((k) => /\$or|\$regex|search|name/i.test(k)))) {
      flags.push(`REGEX${o.fnHasAnchoredRegex ? "(anchored?)" : "(unanchored)"}${o.fnHasCaseInsensitive || o.hints.includes("regex:i") ? "+i" : ""}`);
    }
    if (o.hints.includes("$where")) flags.push("$WHERE");
    if (o.hints.includes("$nin") && medium) flags.push("$NIN");
    if (o.hints.includes("$ne") && medium && !keys.some((k) => k.startsWith("_id{") && k !== "_id{$ne}")) flags.push("$NE");
    if (o.hints.includes("$text")) flags.push("$TEXT(non-tenant text index)");
    if (o.loop && !o.offline) flags.push(`N+1(${o.loop})`);
    if (o.populate.length) {
      flags.push(`POPULATE×${o.populate.length}`);
      if (o.loop) flags.push("POPULATE-IN-LOOP");
    }
    if ((isRead || isFilterWrite) && (large || medium) && !ia.selective && o.op !== "findById") {
      flags.push(keys.length && !(keys.length === 1 && keys[0] === "{}") ? "NO-SELECTIVE-INDEX" : "TENANT-SCAN");
    }
    if (ia.sortOk && ia.sortOk.startsWith("NO") && (large || medium) && ia.selective !== "_id_" && !o.boundedBy) flags.push("SORT-UNINDEXED");
    if (o.pipeline) {
      for (const l of o.pipeline.lookups) {
        if (!l.from || l.unionWith) continue;
        const fIdx = indexes[l.from] || [];
        const ff = l.foreignField;
        if (ff) {
          const ok = ff === "_id" || fIdx.some((i) => {
            const ks = indexKeys(i).map(([k]) => k);
            return ks[0] === ff || (ks[0] === "tenantId" && ks[1] === ff);
          });
          l.indexed = ok;
          if (!ok && (counts[l.from] || 0) >= MEDIUM) flags.push(`LOOKUP-UNINDEXED(${l.from}.${ff})`);
          else if (!ok) l.note = `small (${counts[l.from] || 0})`;
        } else if (l.let || l.pipeline) {
          l.indexed = "pipeline";
          if ((counts[l.from] || 0) >= MEDIUM) flags.push(`LOOKUP-PIPELINE(${l.from})`);
        }
      }
    }
    if (o.op === "countDocuments" && pagedFns.has(`${o.file}#${o.topFn}`) && (large || medium)) flags.push("COUNT-PER-LIST");
    if (o.native && scoped && o.tenantScoped && !o.fn?.startsWith("purge")) flags.push("NATIVE(bypasses tenantPlugin)");
    if (o.model === "Variant" && (o.op === "find" || o.populate.length)) variantFinds.push(o.id);
    if (o.model === "Variant" && o.op === "find") flags.push("TRIGGERS-VARIANT-POST-FIND");
    if (!o.routes.length && !o.offline && !o.fn?.startsWith("hook") && !/jobs|workers|socket|couriers|models|tenancy|middleware/.test(o.file)) flags.push("UNROUTED");
    if (o.cached && (isRead) && !o.offline && o.routes.length) flags.push("CACHED(redis)");
    o.flags = flags;
    o.trigger = triggerOf(o);
    o.worstCase = worstCase(o);
  }

  // populate of variant paths also fires the hook
  for (const o of ops) {
    if (o.populate.some((p) => /variant/i.test(p)) && o.model !== "Variant") o.flags.push("POPULATE-VARIANT(fires post-find hook)");
  }

  const out = { generatedAt: new Date().toISOString(), counts, indexes: Object.fromEntries(Object.entries(indexes).map(([c, l]) => [c, l.map((i) => ({ name: i.name, key: i.key, unique: !!i.unique, ttl: i.expireAfterSeconds }))])), ops };
  fs.writeFileSync(path.join(OUT_DIR, "query-inventory.json"), JSON.stringify(out, null, 1));

  // ---------------------------------------------------------------- markdown
  const md = require("./render")(out);
  fs.writeFileSync(path.join(OUT_DIR, "QUERY_INVENTORY.md"), md);
  console.log(`[perf:inventory] ${ops.length} operations -> reports/phase2/QUERY_INVENTORY.md, query-inventory.json`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
