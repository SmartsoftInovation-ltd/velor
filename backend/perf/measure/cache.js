/**
 * Redis cache effectiveness for cached endpoints (child process, app in-process).
 * Each endpoint: 50 requests with a realistic parameter mix, once with no writes and once with a real
 * POST /sales/create-sales (1 line) after every WRITE_EVERY requests (a store taking sales while
 * staff watch the dashboard). Records hit ratio, hit p95, miss p95 and whether keys carry a TTL.
 *
 *   node perf/measure/cache.js
 */
const { assertPerfTarget, assertConnectedTarget } = require("../lib/guard");
const target = assertPerfTarget();
process.env.ACCESS_TOKEN_SECRET = "perf-access-secret-perf-access-secret-000001";
process.env.REFRESH_TOKEN_SCCERET = "perf-refresh-secret-perf-refresh-secret-0001";
process.env.RATE_LIMIT_MAX = "1000000";
require("module-alias/register");

const fs = require("fs");
const path = require("path");
const { performance } = require("perf_hooks");
const mongoose = require("mongoose");
const capture = require("./capture");
const { pct } = require("../lib/measure");
const { RAW_DIR, buildContext, RANGES } = require("./scenarios");

const N = Number(process.env.PERF_CACHE_N || 50);
const WRITE_EVERY = Number(process.env.PERF_CACHE_WRITE_EVERY || 2);
const round = (n) => Math.round(n * 100) / 100;

// Deterministic mix
let seed = 42;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = (weighted) => {
  const r = rnd();
  let acc = 0;
  for (const [v, w] of weighted) if ((acc += w) >= r) return v;
  return weighted.at(-1)[0];
};

const main = async () => {
  await mongoose.connect(target.uri, { autoIndex: false, monitorCommands: true, appName: "velor-perf-app" });
  assertConnectedTarget(mongoose.connection);
  const { cache } = require("../../src/config/redis.config");
  const stats = capture.instrumentCache(cache);
  const { server } = require("../../src/app");
  const request = require("supertest");
  const ctx = await buildContext(mongoose);
  const call = (method, url, body) => {
    let r = request(server)[method](`/api/v1${url}`).set("Authorization", `Bearer ${ctx.token}`).set("x-tenant", ctx.tenantSlug).timeout({ response: 180000 });
    return body ? r.send(body) : r;
  };
  let wn = 0;
  const writeSale = () => {
    const v = ctx.lineVariants[(50 + wn++) % ctx.lineVariants.length];
    return call("post", "/sales/create-sales", {
      customerType: { type: "walking", walking: { customerName: "Walk-in", mobileNumber: "01700000000" } },
      salesMen: ctx.ownerId,
      searchItem: [{ productId: null, variantId: v.id, quantity: 1, salesRate: v.price, salesStatus: "sale" }],
      payable: v.price,
      paid: v.price,
      paymentMethod: { singlePayment: { amount: v.price, paymentTo: ctx.account } },
      salesType: "retailsale",
      invoiceStatus: "complete",
    });
  };

  const targets = [
    {
      endpoint: "GET /api/v1/dashboard/overview",
      mix: () => `/dashboard/overview?range=${pick([["today", 0.35], ["7d", 0.15], ["30d", 0.35], ["12m", 0.1], ["all", 0.05]])}`,
    },
    {
      endpoint: "GET /api/v1/dashboard/sales-summary",
      mix: () => `/dashboard/sales-summary?range=${pick([["today", 0.4], ["7d", 0.2], ["30d", 0.4]])}`,
    },
    {
      endpoint: "GET /api/v1/product/productperpage",
      mix: () => `/product/productperpage?page=${pick([[1, 0.6], [2, 0.2], [3, 0.1], [4, 0.05], [5, 0.05]])}&limit=50`,
    },
    {
      endpoint: "POST /api/v1/report/sales-invoice",
      method: "post",
      mix: () => {
        const r = pick([["30d", 0.7], ["1y", 0.2], ["2y", 0.1]]);
        return { url: `/report/sales-invoice?page=${pick([[1, 0.8], [2, 0.2]])}&limit=50`, body: RANGES[r] };
      },
      n: Number(process.env.PERF_CACHE_REPORT_N || 30),
    },
  ];
  const only = process.env.PERF_ONLY ? new RegExp(process.env.PERF_ONLY) : null;
  const out = { runAt: new Date().toISOString(), n: N, writeEvery: WRITE_EVERY, cache: [], detail: [] };
  for (const t of targets) {
    if (only && !only.test(t.endpoint)) continue;
    for (const mode of ["no-writes", "with-writes"]) {
      seed = 42;
      // start cold: drop this tenant's versioned data keys
      const keys = await cache.keys(`t:${ctx.tenantId}:*:v*:*`);
      if (keys.length) await cache.del(...keys);
      const hitMs = [];
      const missMs = [];
      let writes = 0;
      let writeMs = 0;
      const n = t.n || N;
      for (let i = 0; i < n; i++) {
        const m = t.mix();
        const { url, body } = typeof m === "string" ? { url: m } : m;
        stats.reset();
        const t0 = performance.now();
        const res = await call(t.method || "get", url, body);
        const ms = performance.now() - t0;
        if (res.status >= 400) console.log(`[cache] ${t.endpoint} ${url} -> ${res.status} ${res.body?.message}`);
        (stats.hits > 0 && stats.misses === 0 ? hitMs : missMs).push(ms);
        if (mode === "with-writes" && (i + 1) % WRITE_EVERY === 0) {
          const w0 = performance.now();
          const wr = await writeSale();
          writeMs += performance.now() - w0;
          if (wr.status >= 400) console.log(`[cache] write failed ${wr.status} ${wr.body?.message}`);
          writes++;
        }
      }
      hitMs.sort((a, b) => a - b);
      missMs.sort((a, b) => a - b);
      // TTL check on this endpoint's keys and on the namespace version keys
      const dataKeys = await cache.keys(`t:${ctx.tenantId}:*:v*:*`);
      const ttls = await Promise.all(dataKeys.slice(0, 200).map((k) => cache.ttl(k)));
      const verKeys = await cache.keys(`t:${ctx.tenantId}:*:v`);
      const verTtls = await Promise.all(verKeys.map((k) => cache.ttl(k)));
      const row = {
        endpoint: `${t.endpoint} (${mode}${mode === "with-writes" ? `, 1 sale per ${WRITE_EVERY} reads` : ""})`,
        hitRatio: round(hitMs.length / n),
        hitP95Ms: hitMs.length ? round(pct(hitMs, 95)) : null,
        missP95Ms: missMs.length ? round(pct(missMs, 95)) : null,
        ttl: ttls.every((x) => x > 0) && verTtls.every((x) => x > 0),
        // extras
        requests: n,
        hits: hitMs.length,
        misses: missMs.length,
        hitP50Ms: hitMs.length ? round(pct(hitMs, 50)) : null,
        missP50Ms: missMs.length ? round(pct(missMs, 50)) : null,
        writes,
        writeAvgMs: writes ? round(writeMs / writes) : null,
        dataKeysWithoutTtl: ttls.filter((x) => x < 0).length,
        versionKeys: verKeys.length,
        versionKeysWithoutTtl: verTtls.filter((x) => x < 0).length,
      };
      out.cache.push(row);
      console.log(`[cache] ${row.endpoint} hit=${row.hitRatio} hitP95=${row.hitP95Ms} missP95=${row.missP95Ms} ttl=${row.ttl} verNoTtl=${row.versionKeysWithoutTtl}`);
    }
  }
  const file = path.join(RAW_DIR, "cache.json");
  const prev = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : { cache: [] };
  const merged = [...prev.cache.filter((r) => !out.cache.some((x) => x.endpoint === r.endpoint)), ...out.cache];
  fs.writeFileSync(file, JSON.stringify({ ...out, cache: merged }, null, 1));
  process.exit(0);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
