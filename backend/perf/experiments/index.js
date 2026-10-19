// Phase 2 MODE: experiment — entry point. Guard runs first (lib.js), always.
//
//   npm run perf:experiment                    # all experiments not yet done (resumable)
//   PERF_ONLY='^E0[12]' npm run perf:experiment
//   PERF_FORCE=1 ...                            # redo
//   PERF_KEEP_INDEXES=1 ...                     # do not drop perfexp_* indexes at the end
//
// Rules: perf DB only; src/ untouched — code-shape fixes are standalone rewrites of the CAPTURED
// production commands (reports/phase2/measure/raw); every experimental index is "perfexp_*" and is
// dropped after its experiment (and again at the end), app indexes are compared to the start snapshot.
const L = require("./lib");
const { EJSON } = require("bson");
const fs = require("fs");
const path = require("path");

const ctx = JSON.parse(fs.readFileSync(path.join(L.RAW, "context.json"), "utf8"));
const TID = new L.ObjectId(ctx.tenantId);
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const clone = (x) => EJSON.parse(EJSON.stringify(x, { relaxed: false }), { relaxed: false });
const D = (s) => new Date(s);
const R = {
  "30d": [D("2026-09-20T00:00:00Z"), D("2026-10-19T23:59:59.999Z")],
  "1y": [D("2025-10-20T00:00:00Z"), D("2026-10-19T23:59:59.999Z")],
  "2y": [D("2024-10-19T00:00:00Z"), D("2026-10-19T23:59:59.999Z")],
};

/** Replace every {date|createdAt: {$gte, $lte|$lt}} range in a command. */
const setRange = (cmd, [a, b], fields = ["date", "createdAt"]) => {
  const c = clone(cmd);
  const walk = (o) => {
    if (!o || typeof o !== "object") return;
    for (const [k, v] of Object.entries(o)) {
      if (fields.includes(k) && v && typeof v === "object" && v.$gte instanceof Date) {
        v.$gte = a;
        if (v.$lte) v.$lte = b;
        if (v.$lt) v.$lt = b;
      } else walk(v);
    }
  };
  walk(c);
  return c;
};
const agg = (coll, pipeline, extra = {}) => ({ aggregate: coll, pipeline, cursor: {}, allowDiskUse: true, ...extra });
const stageName = (s) => Object.keys(s)[0];

/** Sales profit pipelines: $lookup the catalogue only for lines with no stamped purchasePrice, and salesreturns only for sales with a "return" line. */
const onDemandProfitLookups = (pipeline) => {
  const p = clone(pipeline);
  const out = [];
  let injected = false;
  const arr = (field) => ({ $let: { vars: { a: { $ifNull: ["$searchItem", []] } }, in: { $cond: [{ $isArray: "$$a" }, { $map: { input: { $filter: { input: "$$a", as: "l", cond: { $eq: [{ $ifNull: ["$$l.purchasePrice", null] }, null] } } }, as: "l", in: `$$l.${field}` } }, { $cond: [{ $eq: [{ $ifNull: ["$$a.purchasePrice", null] }, null] }, [`$$a.${field}`], []] }] } } });
  const hasReturn = { $let: { vars: { a: { $ifNull: ["$searchItem", []] } }, in: { $cond: [{ $isArray: "$$a" }, { $in: ["return", { $map: { input: "$$a", as: "l", in: "$$l.salesStatus" } }] }, { $eq: ["$$a.salesStatus", "return"] }] } } };
  for (const s of p) {
    if (s.$lookup && ["variants", "products", "salesreturns"].includes(s.$lookup.from) && /searchItem\.(variantId|productId)$|^_id$/.test(s.$lookup.localField || "")) {
      if (!injected) {
        out.push({ $addFields: { __uv: arr("variantId"), __up: arr("productId"), __rk: { $cond: [hasReturn, ["$_id"], []] } } });
        injected = true;
      }
      const lf = s.$lookup.localField;
      s.$lookup.localField = s.$lookup.from === "salesreturns" ? "__rk" : /variantId$/.test(lf) ? "__uv" : "__up";
    }
    out.push(s);
  }
  if (injected) {
    // drop helper fields right after the cost computation (before any $facet / $group output)
    const i = out.findIndex((s) => s.$facet || s.$group);
    out.splice(i < 0 ? out.length : i, 0, { $unset: ["__uv", "__up", "__rk"] });
  }
  return out;
};

/** Move the given stage indexes (enrichment-only) into $facet.rows after its $limit. */
const moveIntoRows = (pipeline, idxs) => {
  const p = clone(pipeline);
  const moved = idxs.map((i) => p[i]);
  const rest = p.filter((_, i) => !idxs.includes(i));
  const f = rest.find((s) => s.$facet);
  const rows = f.$facet.rows;
  const li = rows.findIndex((s) => s.$limit);
  rows.splice(li + 1, 0, ...moved);
  return rest;
};

/** Split a $facet pipeline into one aggregate per facet (run in parallel); rows get the index-backed sort first. */
const splitFacet = (coll, pipeline, { rowsPrefix = [], rowsBeforeEnrich = true } = {}) => {
  const p = clone(pipeline);
  const fi = p.findIndex((s) => s.$facet);
  const head = p.slice(0, fi);
  const matches = head.filter((s) => s.$match && !JSON.stringify(s).includes("$expr"));
  const enrich = head.filter((s) => !matches.includes(s));
  const facets = p[fi].$facet;
  const cmds = {};
  for (const [name, stages] of Object.entries(facets)) {
    if (name === "rows" && rowsBeforeEnrich) {
      const sort = stages.find((s) => s.$sort);
      const skip = stages.find((s) => s.$skip);
      const limit = stages.find((s) => s.$limit);
      const tail = stages.filter((s) => s !== sort && s !== skip && s !== limit);
      cmds[name] = agg(coll, [...matches, ...rowsPrefix, sort, skip, limit, ...enrich, ...tail].filter(Boolean));
    } else cmds[name] = agg(coll, [...matches, ...enrich, ...stages]);
  }
  return cmds;
};

/** Facet totals / rows comparison for equality checks. */
const firstDoc = async (cmd) => {
  const r = await L.db.command({ ...clone(cmd), maxTimeMS: L.MAX_TIME_MS * 3 });
  return r.cursor.firstBatch;
};
const approxEq = (a, b) => {
  const ka = JSON.stringify(a, (k, v) => (typeof v === "number" ? Math.round(v * 100) / 100 : v));
  const kb = JSON.stringify(b, (k, v) => (typeof v === "number" ? Math.round(v * 100) / 100 : v));
  return ka === kb;
};

// ----------------------------------------------------------------------------------------------
const EXPS = [];
const exp = (id, finding, fn) => EXPS.push({ id, finding, fn });

const idx = {
  salesDate: ["sales", { tenantId: 1, date: -1, _id: -1 }],
  salesCreated: ["sales", { tenantId: 1, createdAt: -1, _id: -1 }],
  salesCustomer: ["sales", { tenantId: 1, "customerType.customerId": 1, date: -1 }],
  salesSalesmen: ["sales", { tenantId: 1, salesMen: 1, date: -1 }],
  salesLineVariant: ["sales", { tenantId: 1, "searchItem.variantId": 1, date: -1 }],
  salesLineProduct: ["sales", { tenantId: 1, "searchItem.productId": 1, date: -1 }],
  purchLineVariant: ["purchases", { tenantId: 1, "allproduct.variant": 1 }],
  ledgerDate: ["cratetransactions", { tenantId: 1, date: -1 }],
  ledgerAccountDate: ["cratetransactions", { tenantId: 1, account: 1, date: 1, createdAt: 1 }],
  payCustomer: ["customerpaymentreciveds", { tenantId: 1, customer: 1, date: -1 }],
  payCreated: ["customerpaymentreciveds", { tenantId: 1, createdAt: -1 }],
  payDate: ["customerpaymentreciveds", { tenantId: 1, date: -1 }],
  ordersCreated: ["orders", { tenantId: 1, createdAt: -1, _id: -1 }],
  ordersStatus: ["orders", { tenantId: 1, orderStatus: 1, createdAt: -1 }],
  productsCreated: ["products", { tenantId: 1, createdAt: -1, _id: -1 }],
  variantsCreated: ["variants", { tenantId: 1, createdAt: -1, _id: -1 }],
  purchasesCreated: ["purchases", { tenantId: 1, createdAt: -1, _id: -1 }],
  customersCreated: ["customers", { tenantId: 1, createdAt: -1, _id: -1 }],
  supPayDate: ["supplierduepayments", { tenantId: 1, date: -1 }],
  stockAdjCreated: ["stockadjusts", { tenantId: 1, createdAt: -1 }],
  returnsDate: ["salesreturns", { tenantId: 1, date: -1 }],
  prodNameCI: ["products", { tenantId: 1, name: 1 }, { collation: { locale: "en", strength: 2 } }],
  prodSkuCI: ["products", { tenantId: 1, sku: 1 }, { collation: { locale: "en", strength: 2 } }],
  varNameCI: ["variants", { tenantId: 1, variantName: 1 }, { collation: { locale: "en", strength: 2 } }],
  varSkuCI: ["variants", { tenantId: 1, sku: 1 }, { collation: { locale: "en", strength: 2 } }],
};
const withIdx = async (keys, fn) => {
  const made = [];
  for (const k of keys) {
    const [coll, key, opts] = idx[k];
    const n = opts?.collation ? L.idxName(key) + "_ci" : L.idxName(key);
    made.push({ ref: k, ...(await L.createIndex(coll, key, { ...(opts || {}), name: n })) });
    log("   index", coll, JSON.stringify(key), made.at(-1).buildMs, "ms", made.at(-1).sizeMB, "MB");
  }
  try {
    return { result: await fn(), indexes: made };
  } finally {
    if (!process.env.PERF_KEEP_INDEXES) for (const m of made) await L.dropIndex(m.coll, m.name);
  }
};
const M = async (label, cmd) => {
  const r = await L.measureCmd(cmd);
  log(`   ${label}: plan=${r.plan} docs=${r.docsExamined}${r.lookupDocsExamined ? `+lk${r.lookupDocsExamined}` : ""} ret=${r.nReturned} p95=${r.p95Ms}${r.timedOut ? " TIMEOUT" : ""}`);
  return L.strip(r);
};
const MP = async (label, cmds) => {
  const r = await L.measureParallel(Object.values(cmds));
  log(`   ${label}: ${r.plan} docs=${r.docsExamined}+lk${r.lookupDocsExamined} p95=${r.p95Ms}${r.timedOut ? " TIMEOUT" : ""}`);
  return L.strip(r);
};

// ---------- F-004 / F-003: sales-invoice report (Q-533) ----------
exp("E01-sales-invoice", "F-004", async () => {
  const O = "src/controller/report.controller.js:2867";
  const base = L.captured("rep-sales-invoice-30d", O);
  const reorder = (c) => ({ ...c, pipeline: moveIntoRows(c.pipeline, [2, 3]) });
  const v = {};
  const c30 = setRange(base, R["30d"]);
  const c2y = setRange(base, R["2y"]);
  v.before_30d = await M("before 30d", c30);
  v.reorder_30d_noindex = await M("reorder 30d no index", reorder(c30));
  const eqRef = await firstDoc(c30);
  const { result, indexes } = await withIdx(["salesDate"], async () => {
    const a = {};
    a.original_30d_index = await M("original+idx 30d", c30);
    a.reorder_30d = await M("reorder+idx 30d", reorder(c30));
    a.split_30d = await MP("split+idx 30d", splitFacet("sales", reorder(c30).pipeline));
    a.reorder_1y = await M("reorder+idx 1y", reorder(setRange(base, R["1y"])));
    a.reorder_2y = await M("reorder+idx 2y", reorder(c2y));
    a.split_2y = await MP("split+idx 2y", splitFacet("sales", reorder(c2y).pipeline));
    const got = await firstDoc(reorder(c30));
    a.equal = approxEq(eqRef[0].totals, got[0].totals) && approxEq(eqRef[0].accountSummary, got[0].accountSummary) && approxEq(eqRef[0].rows.map((r) => r.date), got[0].rows.map((r) => r.date));
    return a;
  });
  const pick = (x, y) => (result[y] && !result[y].timedOut && result[y].p95Ms < (result[x]?.p95Ms ?? Infinity) ? y : x);
  const b2y = pick("reorder_2y", "split_2y");
  return { variants: { ...v, ...result }, indexes, targets: [["rep-sales-invoice-30d", O, pick("reorder_30d", "split_30d")], ["rep-sales-invoice-1y", O, "reorder_1y"], ["rep-sales-invoice-2y", O, b2y], ["rep-sales-invoice-2y-p100", O, b2y], ["rep-sales-invoice-2y-p1000", O, b2y], ["rep-sales-invoice-2y-last", O, b2y]], change: "createIndex sales {tenantId:1,date:-1,_id:-1} + move the customers $lookup/$unwind into $facet.rows after $limit (and optionally rows/totals/accountSummary as parallel aggregates)", equalityChecked: "totals, accountSummary and row dates identical to the original on 30d" };
});

// ---------- F-003: invoice-profit (Q-552) ----------
exp("E02-invoice-profit", "F-003", async () => {
  const O = "src/controller/report.controller.js:4476";
  const base = L.captured("rep-invoice-profit-30d", O);
  // customers lookup + resolved names (stages 2,3,4) only feed the rows
  const shape = (c) => ({ ...c, pipeline: onDemandProfitLookups(moveIntoRows(c.pipeline, [2, 3, 4])) });
  const v = {};
  const c30 = setRange(base, R["30d"]);
  v.before_30d = await M("before 30d", c30);
  v.ondemand_30d_noindex = await M("on-demand lookups 30d no index", shape(c30));
  const ref = await firstDoc(c30);
  const { result, indexes } = await withIdx(["salesDate"], async () => {
    const a = {};
    a.original_30d_index = await M("original+idx 30d", c30);
    a.ondemand_30d = await M("on-demand+idx 30d", shape(c30));
    const s30 = shape(c30);
    a.split_30d = await MP("split+idx 30d", splitFacet("sales", s30.pipeline));
    a.ondemand_1y = await M("on-demand+idx 1y", shape(setRange(base, R["1y"])));
    a.split_1y = await MP("split+idx 1y", splitFacet("sales", shape(setRange(base, R["1y"])).pipeline));
    a.ondemand_2y = await M("on-demand+idx 2y", shape(setRange(base, R["2y"])));
    a.split_2y = await MP("split+idx 2y", splitFacet("sales", shape(setRange(base, R["2y"])).pipeline));
    const got = await firstDoc(shape(c30));
    a.equal = approxEq(ref[0].totals, got[0].totals) && approxEq(ref[0].rows.map((r) => [String(r._id), r.profit, r.customerName]), got[0].rows.map((r) => [String(r._id), r.profit, r.customerName]));
    a.refTotals = ref[0].totals;
    a.gotTotals = got[0].totals;
    return a;
  });
  return { variants: { ...v, ...result }, indexes, targets: [["rep-invoice-profit-30d", O, "split_30d"], ["rep-invoice-profit-1y", O, "split_1y"], ["rep-invoice-profit-2y", O, "split_2y"], ["rep-invoice-profit-2y-last", O, "split_2y"]], change: "createIndex sales {tenantId:1,date:-1,_id:-1}; catalogue $lookups only for lines without a stamped purchasePrice, salesreturns $lookup only for sales with a 'return' line, customers $lookup after paging; rows and totals as two parallel aggregates (rows use the index sort)", equalityChecked: "totals and the 50 rows (id, profit, customer) identical to the original on 30d" };
});

// ---------- F-003: invoice-profit, lookups without sub-pipelines (SBE join pushdown) ----------
const plainLookups = (pipeline) =>
  clone(pipeline).map((s) => {
    if (s.$lookup && ["variants", "products", "salesreturns"].includes(s.$lookup.from) && s.$lookup.pipeline) {
      const { pipeline: _p, ...rest } = s.$lookup;
      return { $lookup: rest };
    }
    return s;
  });
exp("E02b-invoice-profit-plain-lookups", "F-003", async () => {
  const O = "src/controller/report.controller.js:4476";
  const base = L.captured("rep-invoice-profit-30d", O);
  const shape = (c) => ({ ...c, pipeline: plainLookups(onDemandProfitLookups(moveIntoRows(c.pipeline, [2, 3, 4]))) });
  const c30 = setRange(base, R["30d"]);
  const { result, indexes } = await withIdx(["salesDate"], async () => {
    const a = {};
    a.plain_30d = await M("on-demand + plain lookups +idx 30d", shape(c30));
    a.plain_split_30d = await MP("on-demand + plain lookups, split +idx 30d", splitFacet("sales", shape(c30).pipeline));
    a.plain_split_1y = await MP("same 1y", splitFacet("sales", shape(setRange(base, R["1y"])).pipeline));
    a.plain_split_2y = await MP("same 2y", splitFacet("sales", shape(setRange(base, R["2y"])).pipeline));
    const ref = await firstDoc(c30);
    const got = await firstDoc(shape(c30));
    a.equal = approxEq(ref[0].totals, got[0].totals) && approxEq(ref[0].rows.map((r) => [String(r._id), r.profit, r.customerName]), got[0].rows.map((r) => [String(r._id), r.profit, r.customerName]));
    return a;
  });
  const best = (x, y) => (result[y] && !result[y].timedOut && (result[x]?.timedOut || result[y].p95Ms < result[x].p95Ms) ? y : x);
  return { variants: result, indexes, targets: [["rep-invoice-profit-30d", O, best("plain_30d", "plain_split_30d")], ["rep-invoice-profit-1y", O, "plain_split_1y"], ["rep-invoice-profit-2y", O, "plain_split_2y"], ["rep-invoice-profit-2y-last", O, "plain_split_2y"]], change: "E02 + $lookup into variants/products/salesreturns by localField/foreignField only (no sub-pipeline: _id / invoiceNumber values come from the same tenant's sale, so the tenantId re-check is redundant) — lets MongoDB 7.0 run the joins in SBE", equalityChecked: "totals and rows identical to the original on 30d" };
});

// ---------- F-003: other profit pipelines (product profit, top product, top customer, customer profit, dashboard) ----------
exp("E03-profit-others", "F-003", async () => {
  const T = [
    ["rep-product-profit-30d", "src/controller/report.controller.js:4681", "salesDate", ["30d", "2y"], { "rep-product-profit-30d": "30d", "rep-product-profit-1y": "2y", "rep-product-profit-2y": "2y" }],
    ["rep-top-customer-2y", "src/controller/report.controller.js:6874", "salesDate", ["30d", "2y"], { "rep-top-customer-2y": "2y" }],
    ["rep-top-sales-product-2y", "src/controller/report.controller.js:4843", "salesDate", ["30d", "2y"], { "rep-top-sales-product-2y": "2y" }],
    ["rep-customer-invoice-profit-topcust", "src/controller/report.controller.js:4281", "salesCustomer", ["2y"], { "rep-customer-invoice-profit-topcust": "2y" }],
    ["dash-overview-30d", "src/controller/dashboard.controller.js:473", "salesCreated", ["30d", "1y"], { "dash-overview-30d": "30d", "dash-overview-today": "30d", "dash-overview-12m": "1y", "dash-overview-30d-hit": "30d" }],
  ];
  const variants = {};
  const indexes = [];
  const targets = [];
  const equal = {};
  for (const [sid, O, ix, ranges, tmap] of T) {
    const base = L.captured(sid, O);
    const key = sid.replace(/^rep-|^dash-/, "");
    const r = await withIdx([ix], async () => {
      const a = {};
      for (const rg of ranges) {
        const c = setRange(base, R[rg]);
        a[`${key}_original_${rg}`] = await M(`${key} original+idx ${rg}`, c);
        a[`${key}_ondemand_${rg}`] = await M(`${key} on-demand+idx ${rg}`, { ...c, pipeline: onDemandProfitLookups(c.pipeline) });
      }
      const c = setRange(base, R[ranges[0]]);
      if (!a[`${key}_original_${ranges[0]}`].timedOut) {
        const x = await firstDoc(c);
        const y = await firstDoc({ ...c, pipeline: onDemandProfitLookups(c.pipeline) });
        equal[key] = approxEq(x, y);
      }
      return a;
    });
    Object.assign(variants, r.result);
    indexes.push(...r.indexes);
    for (const [s2, rg] of Object.entries(tmap)) targets.push([s2, O, `${key}_ondemand_${rg}`]);
  }
  return { variants, indexes, targets, equalityChecked: equal, change: "on-demand catalogue/returns $lookups (same as E02) + the date index of the screen (date, createdAt or customer+date)" };
});

// ---------- F-004: dashboard createdAt aggregates ----------
exp("E04-dashboard-createdAt", "F-004", async () => {
  const origins = [138, 167, 183, 196, 212, 301, 318, 372].map((l) => `src/controller/dashboard.controller.js:${l}`);
  const variants = {};
  variants.before_138 = await M("before :138 30d", L.captured("dash-overview-30d", origins[0]));
  const { result, indexes } = await withIdx(["salesCreated"], async () => {
    const a = {};
    for (const o of origins) {
      const c = L.captured("dash-overview-30d", o);
      a[`after_${o.split(":")[1]}`] = await M(`after ${o} 30d`, c);
      if (JSON.stringify(c).includes("createdAt")) a[`after_${o.split(":")[1]}_12m`] = await M(`after ${o} 12m`, setRange(c, [D("2025-11-01T00:00:00Z"), D("2026-10-19T23:59:59Z")]));
    }
    return a;
  });
  const targets = [];
  for (const o of origins) {
    const l = o.split(":")[1];
    targets.push(["dash-overview-30d", o, `after_${l}`], ["dash-overview-today", o, `after_${l}`]);
    if (result[`after_${l}_12m`]) targets.push(["dash-overview-12m", o, `after_${l}_12m`]);
  }
  return { variants: { ...variants, ...result }, indexes, targets, change: "createIndex sales {tenantId:1,createdAt:-1,_id:-1}" };
});

// ---------- F-004: customer / salesman filtered reports + pickers ----------
exp("E05-sales-customer-salesman", "F-004", async () => {
  const C = [
    ["rep-customer-sales-invoice-2y", "src/controller/report.controller.js:4111", "salesCustomer"],
    ["rep-customer-sales-product-2y", "src/controller/report.controller.js:7271", "salesCustomer"],
    ["rep-customer-sales-summary-2y", "src/controller/report.controller.js:7659", "salesCustomer"],
    ["rep-sales-customers", "src/controller/report.controller.js:2935", "salesCustomer"],
    ["rep-salesman-sales-invoice-2y", "src/controller/report.controller.js:5986", "salesSalesmen"],
    ["rep-salesman-sales-product-2y", "src/controller/report.controller.js:5837", "salesSalesmen"],
    ["rep-sales-salesmen", "src/controller/report.controller.js:2967", "salesSalesmen"],
  ];
  const variants = {};
  const targets = [];
  const indexes = [];
  for (const ix of ["salesCustomer", "salesSalesmen"]) {
    const r = await withIdx([ix], async () => {
      const a = {};
      for (const [sid, O, i] of C) if (i === ix) a[sid] = await M(`${sid} +${ix}`, L.captured(sid, O));
      return a;
    });
    Object.assign(variants, r.result);
    indexes.push(...r.indexes);
  }
  for (const [sid, O] of C) targets.push([sid, O, sid]);
  return { variants, indexes, targets, change: "createIndex sales {tenantId:1,'customerType.customerId':1,date:-1} and {tenantId:1,salesMen:1,date:-1}" };
});

// ---------- F-005 / F-001: sales list ----------
exp("E06-sales-list", "F-005", async () => {
  const O = "src/controller/sales.controller.js:682";
  const p1 = L.captured("sales-list-p1", O);
  const p1000 = L.captured("sales-list-p1000", O);
  const last = L.captured("sales-list-last", O);
  const search = L.captured("sales-list-search", O);
  const variants = {};
  variants.before_p1 = await M("before p1", p1);
  const { result, indexes } = await withIdx(["salesCreated"], async () => {
    const a = {};
    const withSortId = (c) => ({ ...c, sort: { createdAt: -1, _id: -1 } });
    a.index_p1 = await M("idx p1", withSortId(p1));
    a.index_p1000 = await M("idx skip p1000", withSortId(p1000));
    a.index_last = await M("idx skip last", withSortId(last));
    // keyset: boundary of the deep page, fetched once (not timed), then one bounded range query
    for (const [name, c] of [["p1000", p1000], ["last", last]]) {
      const b = await L.db.collection("sales").find({ tenantId: TID }).sort({ createdAt: -1, _id: -1 }).skip(Math.max(0, c.skip - 1)).limit(1).project({ createdAt: 1 }).next();
      a[`keyset_${name}`] = await M(`keyset ${name}`, { find: "sales", filter: { tenantId: TID, $or: [{ createdAt: { $lt: b.createdAt } }, { createdAt: b.createdAt, _id: { $lt: b._id } }] }, sort: { createdAt: -1, _id: -1 }, limit: c.limit });
    }
    a.keyset_p1_limit100 = await M("keyset first page limit 100 (replaces unbounded list)", { find: "sales", filter: { tenantId: TID }, sort: { createdAt: -1, _id: -1 }, limit: 100 });
    a.search_prefix = await M("invoice prefix search (anchored, case-sensitive)", { find: "sales", filter: { tenantId: TID, invoiceNumber: { $regex: "^INV-MEGAMA-1099" } }, sort: { invoiceNumber: -1 }, limit: 50 });
    a.search_regex_index = await M("original regex search +idx", withSortId(search));
    return a;
  });
  return {
    variants: { ...variants, ...result }, indexes,
    targets: [["sales-list-p1", O, "index_p1"], ["sales-list-p100", O, "index_p1"], ["sales-list-p1000", O, "keyset_p1000"], ["sales-list-last", O, "keyset_last"], ["sales-list-search", O, "search_prefix"], ["sales-list-all", "src/controller/sales.controller.js:637", "keyset_p1_limit100"]],
    change: "createIndex sales {tenantId:1,createdAt:-1,_id:-1}; keyset pagination (createdAt,_id) instead of skip; hasNextPage from limit+1 instead of countDocuments; anchored invoice prefix search",
  };
});

// ---------- F-002: Variant post-find hook ----------
exp("E07-variant-hook", "F-002", async () => {
  const O = "src/models/variant.model.js:315";
  const variants = {};
  const targets = [];
  let equal = true;
  const sets = [["sales-list-p1", "page of 50 sales (61 variants)"], ["stock-multivariant-p1", "variant stock page"], ["prod-getproduct-slug", "single product"]].filter(([sid]) => {
    try {
      L.captured(sid, O);
      return true;
    } catch {
      return false;
    }
  });
  const shapes = {};
  for (const [sid] of sets) {
    const c = L.captured(sid, O);
    const ids = c.filter["allproduct.variant"].$in;
    shapes[sid] = {
      original: c,
      projection: { ...c, projection: { "allproduct.variant": 1, "allproduct.quantity": 1, _id: 0 } },
      aggregate: agg("purchases", [{ $match: { tenantId: TID, "allproduct.variant": { $in: ids } } }, { $project: { allproduct: { variant: 1, quantity: 1 } } }, { $unwind: "$allproduct" }, { $match: { "allproduct.variant": { $in: ids } } }, { $group: { _id: "$allproduct.variant", qty: { $sum: { $ifNull: ["$allproduct.quantity", 0] } } } }]),
    };
    variants[`${sid}_before`] = await M(`${sid} before`, c);
    variants[`${sid}_projection_noindex`] = await M(`${sid} projection only`, shapes[sid].projection);
  }
  const { result, indexes } = await withIdx(["purchLineVariant"], async () => {
    const a = {};
    for (const [sid] of sets) {
      a[`${sid}_original_index`] = await M(`${sid} original+idx`, shapes[sid].original);
      a[`${sid}_aggregate_index`] = await M(`${sid} aggregate+idx`, shapes[sid].aggregate);
      // equality: per-variant quantity
      const full = await L.db.collection("purchases").find(shapes[sid].original.filter).project({ allproduct: 1 }).toArray();
      const ids = new Set(shapes[sid].original.filter["allproduct.variant"].$in.map(String));
      const m = {};
      for (const p of full) for (const it of p.allproduct || []) if (it.variant && ids.has(String(it.variant))) m[String(it.variant)] = (m[String(it.variant)] || 0) + (it.quantity || 0);
      const g = await firstDoc(shapes[sid].aggregate);
      for (const r of g) if (m[String(r._id)] !== r.qty) equal = false;
      if (g.length !== Object.keys(m).length) equal = false;
    }
    return a;
  });
  for (const [sid] of sets) targets.push([sid, O, `${sid}_aggregate_index`]);
  for (const sid of ["sales-list-p100", "sales-list-p1000", "sales-list-last", "sales-list-search"]) targets.push([sid, O, "sales-list-p1_aggregate_index"]);
  return { variants: { ...variants, ...result }, indexes, targets, equalityChecked: equal, change: "createIndex purchases {tenantId:1,'allproduct.variant':1}; replace find(full purchase docs) with $match/$project/$unwind/$match/$group returning one {variant, qty} row per variant (or remove the hook)" };
});

// ---------- F-007: cash ledger ----------
exp("E08-ledger", "F-007", async () => {
  const v = {};
  const tgt = [];
  // dropdowns: read the small source collections / DISTINCT_SCAN on the existing account index
  v.getallaccounts_before = await M("getallaccounts before", L.captured("inv-getallaccounts", "src/controller/invoice.controller.js:623"));
  v.getallaccounts_distinct = await M("distinct account (existing {tenantId,account,createdAt})", { distinct: "cratetransactions", key: "account", query: { tenantId: TID } });
  v.getallaccounts_accounts = await M("accounts.find", { find: "accounts", filter: { tenantId: TID }, projection: { name: 1 } });
  v.category_before = await M("transaction-category before", L.captured("inv-transaction-category", "src/controller/invoice.controller.js:659"));
  v.category_source = await M("transitioncategories.find", { find: "transitioncategories", filter: { tenantId: TID }, projection: { name: 1 } });
  tgt.push(["inv-getallaccounts", "src/controller/invoice.controller.js:623", "getallaccounts_distinct"], ["inv-transaction-category", "src/controller/invoice.controller.js:659", "category_source"]);
  const Q = [
    ["rep-transaction-report-2y", "src/controller/report.controller.js:8279"],
    ["rep-transaction-report-2y", "src/controller/report.controller.js:8280"],
    ["rep-transaction-summary-2y", "src/controller/report.controller.js:8329"],
    ["inv-cash-ledger-2y", "src/controller/invoice.controller.js:887"],
    ["inv-transaction-report-2y", "src/controller/invoice.controller.js:700"],
  ];
  for (const [sid, O] of Q) v[`${sid}:${O.split(":")[1]}_before_30d`] = await M(`${sid} ${O} before 30d`, setRange(L.captured(sid, O), R["30d"]));
  const r1 = await withIdx(["ledgerDate"], async () => {
    const a = {};
    for (const [sid, O] of Q) {
      const c = L.captured(sid, O);
      const k = `${sid}:${O.split(":")[1]}`;
      a[`${k}_index_30d`] = await M(`${k} +idx 30d`, setRange(c, R["30d"]));
      if (c.find && !c.limit) a[`${k}_index_2y_page`] = await M(`${k} +idx 2y limit 50`, { ...c, limit: 50 });
      else a[`${k}_index_2y`] = await M(`${k} +idx 2y`, c);
      tgt.push([sid, O, a[`${k}_index_2y_page`] ? `${k}_index_2y_page` : `${k}_index_2y`]);
    }
    return a;
  });
  const AO = "src/controller/report.controller.js:8506";
  const ac = L.captured("rep-accounts-ledger-2y", AO);
  v.accounts_ledger_before_30d = await M("accounts-ledger before 30d", setRange(ac, R["30d"]));
  const r2 = await withIdx(["ledgerAccountDate"], async () => ({
    accounts_ledger_index_30d: await M("accounts-ledger +idx 30d", setRange(ac, R["30d"])),
    accounts_ledger_index_2y: await M("accounts-ledger +idx 2y", ac),
  }));
  tgt.push(["rep-accounts-ledger-2y", AO, "accounts_ledger_index_2y"]);
  return { variants: { ...v, ...r1.result, ...r2.result }, indexes: [...r1.indexes, ...r2.indexes], targets: tgt, change: "dropdowns from accounts / transitioncategories (or DISTINCT_SCAN); createIndex cratetransactions {tenantId:1,date:-1} and {tenantId:1,account:1,date:1,createdAt:1}; page unbounded transaction lists" };
});

// ---------- F-008: customer due list / balance / ledger / payment report ----------
exp("E09-customers", "F-008", async () => {
  const v = {};
  const tgt = [];
  const DO = "src/controller/report.controller.js:10259";
  const due = L.captured("rep-customer-due-list", DO);
  // rows: customers only are sorted (totalDues = openingDues), so page customers first and join 50 of them
  const p = due.pipeline;
  const lookups = [4, 5, 6, 7]; // sales + payments correlated lookups and their unwinds
  const rows = clone(p.slice(0, 2)).concat([{ $addFields: { creditLimit: { $ifNull: ["$dueLimit", 0] }, totalDues: { $ifNull: ["$openingDues", 0] } } }, { $sort: { totalDues: -1, fullName: 1, _id: 1 } }, { $skip: 0 }, { $limit: 50 }, ...clone([p[2], p[3], ...lookups.map((i) => p[i])]), { $addFields: { dueInvoices: { $ifNull: ["$salesAgg.dueInvoices", 0] }, lastSalesDate: "$salesAgg.lastSalesDate", lastPayDate: "$payAgg.lastPayDate" } }, clone(p[9].$facet.rows.at(-1))]);
  const totals = clone(p.slice(0, 2)).concat([{ $group: { _id: null, count: { $sum: 1 }, totalCreditLimit: { $sum: { $ifNull: ["$dueLimit", 0] } }, totalDues: { $sum: { $ifNull: ["$openingDues", 0] } } } }]);
  const dueInv = agg("sales", [{ $match: { tenantId: TID, invoiceStatus: "complete", paymentStatus: "due", "customerType.customerId": { $ne: null } } }, { $count: "n" }]);
  const r = await withIdx(["salesCustomer", "payCustomer"], async () => {
    const a = {};
    a.duelist_original_index = await M("due list original + indexes", due);
    a.duelist_rewrite = await MP("due list: page customers, then join 50 (+indexes)", { rows: agg("customers", rows), totals: agg("customers", totals), dueInv });
    const BO = "src/controller/report.controller.js:9666";
    a.balance_original_index = await M("balance summary original + indexes", L.captured("rep-customer-balance-summary", BO));
    a.balance_one_index = await M("balance summary one customer + indexes", L.captured("rep-customer-balance-summary-one", BO));
    a.ledger_index = await M("customer ledger top customer + indexes", L.captured("rep-customer-ledger-2y", "src/controller/report.controller.js:10017"));
    return a;
  });
  tgt.push(["rep-customer-due-list", DO, "duelist_rewrite"], ["rep-customer-balance-summary", "src/controller/report.controller.js:9666", "balance_original_index"], ["rep-customer-balance-summary-one", "src/controller/report.controller.js:9666", "balance_one_index"], ["rep-customer-ledger-2y", "src/controller/report.controller.js:10017", "ledger_index"]);
  const PO = ["src/controller/report.controller.js:9386", "src/controller/report.controller.js:9387", "src/controller/report.controller.js:9388"];
  v.payment_before_30d = await M("customer-payment before 30d", setRange(L.captured("rep-customer-payment-2y", PO[0]), R["30d"]));
  const r2 = await withIdx(["payDate"], async () => {
    const a = {};
    for (const o of PO) {
      a[`payment_${o.split(":")[1]}_30d`] = await M(`customer-payment ${o} +idx 30d`, setRange(L.captured("rep-customer-payment-2y", o), R["30d"]));
      a[`payment_${o.split(":")[1]}_2y`] = await M(`customer-payment ${o} +idx 2y`, L.captured("rep-customer-payment-2y", o));
      tgt.push(["rep-customer-payment-2y", o, `payment_${o.split(":")[1]}_2y`]);
    }
    return a;
  });
  return { variants: { ...v, ...r.result, ...r2.result }, indexes: [...r.indexes, ...r2.indexes], targets: tgt, change: "createIndex sales {tenantId:1,'customerType.customerId':1,date:-1}, customerpaymentreciveds {tenantId:1,customer:1,date:-1} and {tenantId:1,date:-1}; due list pages customers BEFORE the correlated joins (the sort uses customer fields only)", equalityChecked: "due list rows: same sort keys; totals.dueInvoices counted on sales directly (includes invoices of inactive customers — semantic difference to confirm)" };
});

// ---------- F-006: POS search ----------
exp("E10-pos-search", "F-006", async () => {
  const v = {};
  const PO = "src/controller/sales.controller.js:803";
  const sh = L.captured("sales-pos-search-sh", PO);
  v.before_sh = await M("POS q=sh before (products branch)", sh);
  const next = (q) => q.slice(0, -1) + String.fromCharCode(q.charCodeAt(q.length - 1) + 1);
  const coll = { collation: { locale: "en", strength: 2 } };
  const find = (c, field, q, extra = {}) => ({ find: c, filter: { tenantId: TID, [field]: { $gte: q, $lt: next(q) } }, limit: 20, ...coll, ...extra });
  const r = await withIdx(["prodNameCI", "prodSkuCI", "varNameCI", "varSkuCI"], async () => {
    const a = {};
    for (const q of ["a", "sh", "sha"]) {
      a[`prefix_${q}`] = await MP(`prefix search q=${q} (4 collation-index queries, limit 20 each)`, {
        pn: find("products", "name", q), ps: find("products", "sku", q), vn: find("variants", "variantName", q), vs: find("variants", "sku", q),
      });
    }
    a.original_sh_index = await M("original regex q=sh with collation indexes present", sh);
    return a;
  });
  return { variants: { ...v, ...r.result }, indexes: r.indexes, targets: [["sales-pos-search-sh", PO, "prefix_sh"], ["sales-pos-search-a", PO, "prefix_a"]], change: "case-insensitive PREFIX search: collation {locale:'en',strength:2} indexes {tenantId:1,name:1}, {tenantId:1,sku:1} on products and {tenantId:1,variantName:1}, {tenantId:1,sku:1} on variants; range [q, next(q)) with the same collation, limit 20", equalityChecked: "semantic change: prefix match instead of substring match" };
});

// ---------- F-010 / F-001: unbounded lists -> keyset pages ----------
exp("E11-lists-keyset", "F-010", async () => {
  const L1 = [
    ["prod-getproduct", "src/controller/product.controller.js:300", "products", "productsCreated"],
    ["variant-list", "src/controller/variant.controller.js:215", "variants", "variantsCreated"],
    ["order-all", "src/controller/order.controller.js:480", "orders", "ordersCreated"],
    ["purchase-all", "src/controller/purchase.controller.js:264", "purchases", "purchasesCreated"],
    ["cust-list", "src/controller/customer.controller.js:390", "customers", "customersCreated"],
  ];
  const v = {};
  const indexes = [];
  const tgt = [];
  for (const [sid, O, coll, ix] of L1) {
    const c = L.captured(sid, O);
    v[`${coll}_before`] = await M(`${coll} unbounded before`, c);
    const r = await withIdx([ix], async () => {
      const a = {};
      const filter = { ...c.filter, tenantId: TID };
      a[`${coll}_page1`] = await M(`${coll} keyset page 1 limit 50`, { find: coll, filter, sort: { createdAt: -1, _id: -1 }, limit: 50, ...(c.projection ? { projection: c.projection } : {}) });
      const b = await L.db.collection(coll).find(filter).sort({ createdAt: -1, _id: -1 }).skip(Math.floor(ctx.counts[coll] * 0.9)).limit(1).project({ createdAt: 1 }).next();
      if (b) a[`${coll}_deep`] = await M(`${coll} keyset at 90% depth`, { find: coll, filter: { ...filter, $or: [{ createdAt: { $lt: b.createdAt } }, { createdAt: b.createdAt, _id: { $lt: b._id } }] }, sort: { createdAt: -1, _id: -1 }, limit: 50 });
      return a;
    });
    Object.assign(v, r.result);
    indexes.push(...r.indexes);
    tgt.push([sid, O, `${coll}_page1`]);
  }
  return { variants: v, indexes, targets: tgt, change: "mandatory limit + keyset pagination on {tenantId:1,createdAt:-1,_id:-1} per list collection" };
});

// ---------- F-011: product ledger ----------
exp("E12-product-ledger", "F-011", async () => {
  const v = {};
  const SO = "src/controller/report.controller.js:1861";
  const PO = "src/controller/report.controller.js:1827";
  const sv = L.captured("rep-product-ledger-variant", SO);
  const pv = L.captured("rep-product-ledger-variant", PO);
  const pre = (c, field) => {
    const p = clone(c.pipeline);
    const m = p.find((s, i) => i > 0 && s.$match && Object.keys(s.$match).some((k) => k.startsWith(field.split(".")[0])));
    const cond = Object.fromEntries(Object.entries(m.$match).filter(([k]) => k.startsWith(field.split(".")[0])));
    p.splice(1, 0, { $match: cond });
    return { ...c, pipeline: p };
  };
  v.sales_before = await M("ledger sales branch before", sv);
  v.purch_before = await M("ledger purchases branch before", pv);
  const r = await withIdx(["salesLineVariant", "purchLineVariant"], async () => ({
    sales_after: await M("ledger sales: $match line before $unwind + multikey idx", pre(sv, "searchItem.variantId")),
    purch_after: await M("ledger purchases: $match line before $unwind + idx", pre(pv, "allproduct.variant")),
    equal: approxEq(await firstDoc(sv), await firstDoc(pre(sv, "searchItem.variantId"))),
  }));
  return { variants: { ...v, ...r.result }, indexes: r.indexes, targets: [["rep-product-ledger-variant", SO, "sales_after"], ["rep-product-ledger-variant", PO, "purch_after"]], change: "multikey createIndex sales {tenantId:1,'searchItem.variantId':1,date:-1} (+ productId twin) and purchases {tenantId:1,'allproduct.variant':1}; $match on the line field BEFORE $unwind", equalityChecked: "sales branch rows identical" };
});

// ---------- F-012: push-sales-product ----------
exp("E13-push-sales", "F-012", async () => {
  const O = "src/controller/report.controller.js:4887";
  const c = L.captured("rep-push-sales-product-2y", O);
  const v = {};
  v.before_2y = await M("push-sales before 2y (all groups to the app)", c);
  const r = await withIdx(["salesDate"], async () => ({
    after_30d: await M("push-sales +idx 30d, $sort/$limit 50 in DB", { ...setRange(c, R["30d"]), pipeline: [...setRange(c, R["30d"]).pipeline, { $sort: { qty: 1 } }, { $limit: 50 }] }),
    after_2y: await M("push-sales +idx 2y, $sort/$limit 50 in DB", { ...c, pipeline: [...c.pipeline, { $sort: { qty: 1 } }, { $limit: 50 }] }),
  }));
  return { variants: { ...v, ...r.result }, indexes: r.indexes, targets: [["rep-push-sales-product-2y", O, "after_2y"]], change: "rank in MongoDB ($sort/$limit after $group) instead of streaming every group, + sales date index" };
});

// ---------- F-013 / F-014 / F-015 / F-019: single-index fixes ----------
exp("E14-single-indexes", "F-013", async () => {
  const S = [
    ["F-013", "supPayDate", "rep-supplier-payment-2y", "src/controller/report.controller.js:9030"],
    ["F-013", "supPayDate", "rep-supplier-payment-2y", "src/controller/report.controller.js:9031"],
    ["F-014", "stockAdjCreated", "inv-overall-stock", "src/controller/invoice.controller.js:548"],
    ["F-014", "returnsDate", "rep-product-sales-return-2y", "src/controller/report.controller.js:5338"],
    ["F-014", "returnsDate", "rep-product-sales-return-summary-2y", "src/controller/report.controller.js:5507"],
    ["F-015", "ordersCreated", "order-by-date", "src/controller/order.controller.js:606"],
    ["F-015", "ordersStatus", "order-status-counts", "src/controller/order.controller.js:748"],
    ["F-015", "ordersCreated", "order-count-amount", "src/controller/order.controller.js:769"],
    ["F-019", "payCreated", "dash-overview-30d", "src/controller/dashboard.controller.js:444"],
    ["F-019", "payCreated", "dash-inflow-transaction-summary-12m", "src/controller/dashboard.controller.js:1007"],
  ];
  const v = {};
  const indexes = [];
  const tgt = [];
  for (const [f, ix, sid, O] of S) {
    let c;
    try {
      c = L.captured(sid, O);
    } catch (e) {
      log("   skip", sid, O, e.message);
      continue;
    }
    const k = `${f}:${sid}:${O.split(":")[1]}`;
    const c30 = JSON.stringify(c).includes("$gte") ? setRange(c, R["30d"]) : c;
    v[`${k}_before_30d`] = await M(`${k} before 30d`, c30);
    const r = await withIdx([ix], async () => {
      const a = { [`${k}_after_30d`]: await M(`${k} +${ix} 30d`, c30), [`${k}_after_full`]: await M(`${k} +${ix} full range`, c) };
      if (c.aggregate && ix === "stockAdjCreated") a[`${k}_after_page50`] = await M(`${k} +idx, $limit 50 after $sort`, { ...c, pipeline: (() => { const p = clone(c.pipeline); const i = p.findIndex((s) => s.$sort); p.splice(i + 1, 0, { $limit: 50 }); return p; })() });
      if (c.find && !c.limit) a[`${k}_after_page50`] = await M(`${k} +idx limit 50`, { ...c, limit: 50 });
      return a;
    });
    Object.assign(v, r.result);
    indexes.push(...r.indexes);
    tgt.push([sid, O, r.result[`${k}_after_page50`] ? `${k}_after_page50` : `${k}_after_full`]);
  }
  return { variants: v, indexes, targets: tgt, change: "supplierduepayments {tenantId:1,date:-1}; stockadjusts {tenantId:1,createdAt:-1} + page overallStock; salesreturns {tenantId:1,date:-1}; orders {tenantId:1,createdAt:-1,_id:-1} and {tenantId:1,orderStatus:1,createdAt:-1}; customerpaymentreciveds {tenantId:1,createdAt:-1}" };
});

// ---------- F-016: audit purge in batches (read side only; nothing is deleted) ----------
exp("E15-audit-purge", "F-016", async () => {
  const cutoff = new Date(Date.now() - 30 * 86400000);
  const v = {};
  v.batch_select = await M("select one batch of 5,000 _ids older than cutoff (createdAt_1)", { find: "auditlogs", filter: { createdAt: { $lt: cutoff } }, sort: { createdAt: 1 }, projection: { _id: 1 }, limit: 5000 });
  const ex = await L.db.command({ explain: { delete: "auditlogs", deletes: [{ q: { _id: { $in: [] } }, limit: 0 }] }, verbosity: "queryPlanner" });
  v.batch_delete_plan = { plan: ex.queryPlanner?.winningPlan?.stage || null, note: "delete by _id $in (IDHACK/IXSCAN _id) per batch" };
  const total = await L.db.collection("auditlogs").countDocuments({ createdAt: { $lt: cutoff } });
  v.batches_needed = { docs: total, batchSize: 5000, batches: Math.ceil(total / 5000) };
  return { variants: v, indexes: [], targets: [["job-audit-purge", "src/jobs/purgeAuditLogs.job.js:20", "batch_select"]], change: "delete in batches of 5,000 by _id (select batch via createdAt_1, then deleteMany {_id:{$in}}) with a pause between batches; or align the TTL index (180 d) with the 30-day policy and drop the job" };
});

// ---------- F-017: dashboard from a daily summary ----------
exp("E16-daily-summary", "F-017", async () => {
  const v = {};
  const t0 = Date.now();
  await L.db.collection("sales").aggregate([
    { $match: { tenantId: TID } },
    { $group: { _id: { tenantId: "$tenantId", day: { $dateTrunc: { date: "$createdAt", unit: "day", timezone: "Asia/Dhaka" } } }, revenue: { $sum: "$payable" }, collected: { $sum: { $ifNull: ["$netPaid", { $max: [0, { $subtract: [{ $ifNull: ["$paid", 0] }, { $ifNull: ["$changes", 0] }] }] }] } }, dues: { $sum: "$presentDue" }, orders: { $sum: 1 }, itemsSold: { $sum: { $sum: "$searchItem.quantity" } } } },
    { $project: { _id: 0, tenantId: "$_id.tenantId", day: "$_id.day", revenue: 1, collected: 1, dues: 1, orders: 1, itemsSold: 1 } },
    { $merge: { into: "perfexp_daily_sales", whenMatched: "replace" } },
  ], { allowDiskUse: true, maxTimeMS: 600000 }).toArray();
  v.build_full_history_ms = Date.now() - t0;
  await L.db.collection("perfexp_daily_sales").createIndex({ tenantId: 1, day: -1 }, { name: "perfexp_tenantId_day" });
  const sum = (from) => agg("perfexp_daily_sales", [{ $match: { tenantId: TID, ...(from ? { day: { $gte: from } } : {}) } }, { $group: { _id: null, revenue: { $sum: "$revenue" }, collected: { $sum: "$collected" }, dues: { $sum: "$dues" }, orders: { $sum: "$orders" }, itemsSold: { $sum: "$itemsSold" } } }]);
  v.summary_30d = await M("overview totals from daily summary 30d", sum(D("2026-09-20T00:00:00+06:00")));
  v.summary_12m = await M("overview totals from daily summary 12m", sum(D("2025-11-01T00:00:00+06:00")));
  v.summary_all = await M("overview totals from daily summary all", sum(null));
  // refresh cost: today's rows only (what a write hook / 1-minute job would do)
  const r0 = Date.now();
  await L.db.collection("sales").aggregate([
    { $match: { tenantId: TID, createdAt: { $gte: D("2026-10-18T18:00:00Z") } } },
    { $group: { _id: { tenantId: "$tenantId", day: { $dateTrunc: { date: "$createdAt", unit: "day", timezone: "Asia/Dhaka" } } }, revenue: { $sum: "$payable" }, orders: { $sum: 1 } } },
    { $project: { _id: 0, tenantId: "$_id.tenantId", day: "$_id.day", revenue: 1, orders: 1 } },
  ], { maxTimeMS: 600000 }).toArray();
  v.refresh_today_noindex_ms = Date.now() - r0;
  // equality vs the live dashboard aggregate (Q-137, all time)
  const live = await firstDoc(agg("sales", [{ $match: { tenantId: TID } }, { $group: { _id: null, revenue: { $sum: "$payable" }, orders: { $sum: 1 } } }]));
  const sm = await firstDoc(sum(null));
  v.equal_all_time = Math.round(live[0].revenue) === Math.round(sm[0].revenue) && live[0].orders === sm[0].orders;
  await L.db.collection("perfexp_daily_sales").drop();
  return { variants: v, indexes: [], targets: [["dash-overview-30d", "src/controller/dashboard.controller.js:138", "summary_30d"], ["dash-overview-12m", "src/controller/dashboard.controller.js:138", "summary_12m"], ["dash-overview-all", "src/controller/dashboard.controller.js:138", "summary_all"]], change: "pre-aggregated daily sales summary (tenantId, day) refreshed for 'today' on write or every minute; overview reads ~30-730 summary rows instead of scanning sales", note: "collection perfexp_daily_sales dropped after the test" };
});

// ---------- F-020: per-page counts ----------
exp("E17-counts", "F-020", async () => {
  const v = {};
  const O = "src/controller/product.controller.js:721";
  v.count_before = await M("productperpage countDocuments", L.captured("prod-perpage-p1", O));
  v.limit_plus_one = await M("page query limit 51 (hasNextPage) instead of a count", { find: "products", filter: { tenantId: TID }, sort: { _id: -1 }, limit: 51, projection: { _id: 1 } });
  return { variants: v, indexes: [], targets: [["prod-perpage-p1", O, "limit_plus_one"]], change: "drop the exact count: fetch limit+1 rows for hasNextPage, or cache the total per filter" };
});

// ---------- write cost ----------
exp("W01-write-cost", "write", async () => {
  const N = Number(process.env.PERF_WRITE_N || 10000);
  const out = {};
  const run = async (label, coll, keys) => {
    const made = [];
    for (const k of keys) {
      const [c, key, opts] = idx[k];
      made.push(await L.createIndex(c, key, { ...(opts || {}), name: opts?.collation ? L.idxName(key) + "_ci" : L.idxName(key) }));
    }
    const w = await L.writeCost(coll, ctx.tenantId, { n: N });
    for (const m of made) await L.dropIndex(m.coll, m.name);
    out[label] = { coll, indexes: keys.map((k) => idx[k][1]), sizeMB: made.reduce((s, m) => s + (m.sizeMB || 0), 0), ...w };
    log(`   ${label}: insert p50/p95 ${w.insertP50Ms}/${w.insertP95Ms} ms ${w.insertOpsPerSec}/s, update p95 ${w.updateP95Ms} ${w.updateOpsPerSec}/s`);
  };
  await run("sales_baseline", "sales", []);
  for (const k of ["salesDate", "salesCreated", "salesCustomer", "salesSalesmen", "salesLineVariant", "salesLineProduct"]) await run(`sales_+${k}`, "sales", [k]);
  await run("sales_+recommended_set", "sales", ["salesDate", "salesCreated", "salesCustomer", "salesSalesmen", "salesLineVariant"]);
  await run("sales_baseline_again", "sales", []);
  await run("cratetransactions_baseline", "cratetransactions", []);
  await run("cratetransactions_+set", "cratetransactions", ["ledgerDate", "ledgerAccountDate"]);
  await run("purchases_baseline", "purchases", []);
  await run("purchases_+set", "purchases", ["purchLineVariant", "purchasesCreated"]);
  await run("orders_baseline", "orders", []);
  await run("orders_+set", "orders", ["ordersCreated", "ordersStatus"]);
  await run("products_baseline", "products", []);
  await run("products_+set", "products", ["productsCreated", "prodNameCI", "prodSkuCI"]);
  await run("customerpaymentreciveds_baseline", "customerpaymentreciveds", []);
  await run("customerpaymentreciveds_+set", "customerpaymentreciveds", ["payCustomer", "payDate", "payCreated"]);
  return { variants: out, indexes: [], targets: [] };
});

// ----------------------------------------------------------------------------------------------
const main = async () => {
  await L.connect();
  const snapBefore = await L.snapshotIndexes();
  const only = process.env.PERF_ONLY ? new RegExp(process.env.PERF_ONLY) : null;
  for (const e of EXPS) {
    if (only && !only.test(e.id)) continue;
    if (L.done(e.id)) continue;
    log(`== ${e.id} (${e.finding})`);
    const t = Date.now();
    try {
      const r = await e.fn();
      L.save(e.id, { finding: e.finding, seconds: Math.round((Date.now() - t) / 1000), ...r });
    } catch (err) {
      log(`   FAILED ${err.message}`);
      L.save(`${e.id}.error`, { finding: e.finding, error: err.stack });
    }
  }
  const dropped = process.env.PERF_KEEP_INDEXES ? [] : await L.dropAllExperimental();
  const snapAfter = await L.snapshotIndexes();
  const diff = Object.keys({ ...snapBefore, ...snapAfter }).filter((c) => !c.startsWith("perfexp_") && JSON.stringify((snapBefore[c] || []).filter((n) => !n.startsWith("perfexp_"))) !== JSON.stringify((snapAfter[c] || []).filter((n) => !n.startsWith("perfexp_"))));
  log("restore: dropped", dropped.length, "leftover perfexp indexes; app index sets changed:", diff.length ? diff : "none");
  fs.writeFileSync(path.join(L.EXP_DIR, "raw", "_restore.json"), JSON.stringify({ at: new Date().toISOString(), dropped, appIndexSetChanged: diff }, null, 1));
  await L.close();
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
