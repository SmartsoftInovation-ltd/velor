/**
 * Phase 2 MODE: seed. Guard runs first, always (perf/lib/db.js runs it at require time).
 *
 *   npm run perf:seed                     # full dataset (defaults below)
 *   PERF_SCALE=0.01 npm run perf:seed     # 1% smoke run
 *   PERF_SALES=5000000 npm run perf:seed  # override one collection
 *   PERF_SEED_RESET=0                     # keep the existing perf DB (default: drop it)
 *
 * Multi-tenant: 8 stores with a skewed share (one big store owns 55%), all on
 * the shared collections exactly like production. Documents are inserted with
 * the native driver (insertMany, ordered:false, 5k batches, 4 in flight), then
 * every index the app schemas declare is built with Model.createIndexes().
 */
const { assertPerfTarget, assertConnectedTarget } = require("../lib/guard");
assertPerfTarget();
const db = require("../lib/db");

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const L = require("./lib");
const { seedLookups, seedCatalog, seedPeople } = require("./catalog");
const { seedSales, seedPurchases, seedOrders, seedMisc, seedAudit } = require("./transactions");

const REPORT_DIR = path.join(__dirname, "..", "..", "reports", "phase2");
const OWNER_PASSWORD = "PerfOwner#2026"; // perf DB only; every seeded staff user shares it

const SCALE = Number(process.env.PERF_SCALE || 1);
const num = (name, def) => Math.max(1, Math.round(Number(process.env[name] || def) * (process.env[name] ? 1 : SCALE)));
const cfg = {
  sales: num("PERF_SALES", 2_000_000),
  products: num("PERF_PRODUCTS", 500_000),
  multiVariantShare: Number(process.env.PERF_MULTI_VARIANT_SHARE || 0.3),
  customers: num("PERF_CUSTOMERS", 600_000),
  shoppers: num("PERF_USERS", 300_000),
  orders: num("PERF_ORDERS", 400_000),
  purchases: num("PERF_PURCHASES", 200_000),
  auditLogs: num("PERF_AUDIT", 1_500_000),
  auditRetentionDays: 175, // TTL index removes rows older than 180 days
  customerPayments: num("PERF_CUSTOMER_PAYMENTS", 300_000),
  customerAdvances: num("PERF_CUSTOMER_ADVANCES", 30_000),
  supplierPayments: num("PERF_SUPPLIER_PAYMENTS", 60_000),
  manualTxns: num("PERF_MANUAL_TXNS", 100_000),
  stockAdjusts: num("PERF_STOCK_ADJUSTS", 100_000),
  smsLogs: num("PERF_SMS_LOGS", 20_000),
  moneyTransfers: num("PERF_MONEY_TRANSFERS", 20_000),
  purchaseReturns: num("PERF_PURCHASE_RETURNS", 10_000),
  returnRate: 0.03,
  // lookup sizes for the biggest store (scaled by sqrt(share) or share)
  categories: 400,
  brands: 600,
  employees: 250,
  suppliers: 3000,
  staff: 60,
  coupons: 200,
};

const TENANTS = [
  ["Dhaka Mega Mart", "megamart", 0.55, 0],
  ["Chattogram Fashion House", "ctgfashion", 0.17, 5],
  ["Sylhet Style Point", "sylhetstyle", 0.1, 0],
  ["Khulna Bazar", "khulnabazar", 0.07, 0],
  ["Rajshahi Corner Shop", "rajcorner", 0.04, 5],
  ["Barishal Boutique", "barisalbtq", 0.03, 0],
  ["Rangpur Gadget Hub", "rangpurgadget", 0.02, 0],
  ["Cumilla Mini Store", "cumillamini", 0.02, 0],
];

const log = (...a) => console.log(`[seed ${new Date().toISOString().slice(11, 19)}]`, ...a);

async function main() {
  const started = Date.now();
  const conn = await db.connect({ maxPoolSize: 16 });
  assertConnectedTarget(conn);
  const ndb = conn.db;
  const M = db.models;
  const coll = (name) => M[name].collection.collectionName;
  const C = {
    customerTypes: coll("CustomerType"), transitionCategories: coll("TransitionCategory"), deliveries: coll("Delivery"),
    coupons: coll("Coupon"), employees: coll("Employee"), suppliers: coll("Supplier"), users: coll("User"),
    categories: coll("Category"), subcategories: coll("Subcategory"), brands: coll("Brand"), products: coll("Product"),
    variants: coll("Variant"), customers: coll("Customer"), sales: coll("Sales"), salesReturns: coll("SalesReturn"),
    crateTransactions: coll("CrateTransaction"), purchases: coll("Purchase"), orders: coll("Order"),
    customerPayments: coll("CustomerPaymentRecived"), customerAdvances: coll("CustomerAdvancePaymentRecived"),
    supplierPayments: coll("SupplierDuePayment"), stockAdjusts: coll("StockAdjust"), smsLogs: coll("SmsLog"),
    moneyTransfers: coll("MoneyTransfer"), purchaseReturns: coll("PurchaseReturn"), dailyCash: coll("DailyCashSummary"),
    auditLogs: coll("auditlog"), accounts: coll("Account"), counters: coll("Counter"), tenantSettings: coll("TenantSettings"),
  };

  log(`target db=${ndb.databaseName} scale=${SCALE}`, JSON.stringify(cfg));
  if (process.env.PERF_SEED_RESET !== "0") {
    assertConnectedTarget(conn); // re-check right before the only destructive call
    log(`dropping database ${ndb.databaseName}`);
    await ndb.dropDatabase();
  }

  // ── tenants, roles and owners through the app's own models ────────────────
  const { runForTenant } = require("../../src/tenancy/context");
  const { seedTenantRoles } = require("../../src/tenancy/roleTemplate");
  // same rule as invoicePrefixFor() in src/tenancy/provisioning.js (not required: it pulls in the credentials mailer)
  const invoicePrefixFor = (slug) => {
    const prefix = slug.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 6);
    return prefix.length >= 2 ? prefix : "INV";
  };
  const Tenant = M.Tenant;
  const User = M.User;
  for (const name of ["Tenant", "User", "Role", "TenantSettings"]) await M[name].createCollection().catch(() => {});

  const tenants = [];
  for (const [i, [name, slug, share, vat]] of TENANTS.entries()) {
    const opened = L.dateAt(0, L.makeRng(i));
    const tenant = await Tenant.create({
      name, slug, status: "active", statusChangedAt: opened, plan: share > 0.1 ? "pro" : "standard",
      billing: { price: share > 0.1 ? 5000 : 1500, cycle: "monthly", startedAt: opened, renewsAt: new Date(L.NOW + 20 * L.DAY) },
    });
    const roles = await seedTenantRoles(tenant._id);
    const ownerEmail = `owner@${slug}.perf`;
    const owner = await runForTenant(tenant._id, () =>
      User.create({ name: `${name} Owner`, email: ownerEmail, phone: `0170000000${i}`, password: OWNER_PASSWORD, roles: [roles.owner._id], isActive: true }),
    );
    tenant.ownerUserId = owner._id;
    await tenant.save();
    const prefix = invoicePrefixFor(slug);
    await ndb.collection(C.tenantSettings).insertOne({ tenantId: tenant._id, data: { general: { invoicePrefix: prefix } }, version: 1, updatedBy: null, createdAt: opened, updatedAt: opened, __v: 0 });
    const ownerDoc = await ndb.collection(C.users).findOne({ _id: owner._id });
    tenants.push({
      _id: tenant._id, index: i + 1, name, slug, share, vat, prefix, seq: {},
      ownerId: owner._id, ownerName: owner.name, ownerEmail, ownerRoleId: roles.owner._id, passwordHash: ownerDoc.password,
    });
  }
  log(`tenants: ${tenants.map((t) => `${t.slug}(${t.prefix})`).join(", ")}`);

  // ── bulk data ─────────────────────────────────────────────────────────────
  const w = new L.Writer(ndb, { batchSize: Number(process.env.PERF_BATCH || 5000), concurrency: Number(process.env.PERF_CONCURRENCY || 4) });
  const stats = { catalog: {}, worstCase: {} };
  const phases = {};
  const phase = async (name, fn) => {
    const t = Date.now();
    await fn();
    await w.drain();
    phases[name] = Math.round((Date.now() - t) / 100) / 10;
    log(`${name} done in ${phases[name]}s`, JSON.stringify(w.counts));
  };

  const rng = L.makeRng(20261019);
  await phase("lookups", async () => { for (const t of tenants) await seedLookups(w, t, cfg, rng, C); });
  await phase("catalog", async () => { for (const t of tenants) await seedCatalog(w, t, cfg, rng, C, stats); });
  await phase("people", async () => { for (const t of tenants) await seedPeople(w, t, cfg, rng, C); });
  await phase("sales", () => seedSales(w, tenants, cfg, rng, C, stats));
  await phase("purchases", () => seedPurchases(w, tenants, cfg, rng, C, stats));
  await phase("orders", () => seedOrders(w, tenants, cfg, rng, C));
  await phase("misc", () => seedMisc(w, tenants, cfg, rng, C));
  await phase("audit", () => seedAudit(w, tenants, cfg, rng, C));

  await phase("accounts+counters", async () => {
    for (const t of tenants) {
      const at = L.dateAt(0, rng);
      for (const a of t.accounts) {
        await w.add(C.accounts, { _id: a._id, tenantId: t._id, name: a.name, slug: L.slugify(a.name), isActive: true, balance: a.balance, createdAt: at, updatedAt: at, __v: 0 });
      }
      for (const [key, seq] of Object.entries(t.seq)) {
        await w.add(C.counters, { tenantId: t._id, key, seq, createdAt: at, updatedAt: new Date(L.NOW), __v: 0 });
      }
    }
  });
  const insertSeconds = Math.round((Date.now() - started) / 1000);

  // ── indexes exactly as the app schemas declare them ───────────────────────
  const tIdx = Date.now();
  const { conflicts: indexConflicts } = await db.syncAppIndexes({ log: (m) => log(m) });
  const indexSeconds = Math.round((Date.now() - tIdx) / 1000);

  // ── stats ─────────────────────────────────────────────────────────────────
  const build = await ndb.admin().command({ buildInfo: 1 });
  const status = await ndb.admin().command({ serverStatus: 1 });
  const cacheBytes = status.wiredTiger?.cache?.["maximum bytes configured"] || 0;
  const collections = {};
  let dataSize = 0;
  let storageSize = 0;
  let indexSize = 0;
  for (const c of (await ndb.listCollections({}, { nameOnly: true }).toArray()).map((x) => x.name).sort()) {
    const [s] = await ndb.collection(c).aggregate([{ $collStats: { storageStats: {} } }]).toArray();
    const st = s.storageStats;
    collections[c] = {
      count: st.count, avgObjSizeBytes: Math.round(st.avgObjSize || 0), dataSizeMB: mb(st.size),
      storageSizeMB: mb(st.storageSize), indexSizeMB: mb(st.totalIndexSize), nindexes: st.nindexes,
      indexes: Object.fromEntries(Object.entries(st.indexSizes).map(([k, v]) => [k, mb(v)])),
    };
    dataSize += st.size;
    storageSize += st.storageSize;
    indexSize += st.totalIndexSize;
  }

  const perTenant = {};
  for (const t of tenants) {
    const counts = {};
    for (const key of ["sales", "products", "variants", "customers", "orders", "purchases", "crateTransactions", "auditLogs", "salesReturns"]) {
      counts[key] = await ndb.collection(C[key]).countDocuments({ tenantId: t._id });
    }
    perTenant[t.slug] = { tenantId: String(t._id), name: t.name, share: t.share, invoicePrefix: t.prefix, ownerEmail: t.ownerEmail, counts };
  }

  let diskUsed = null;
  try {
    diskUsed = execSync("docker exec velor-mongo-perf du -sh /data/db", { env: { ...process.env, DOCKER_CONTEXT: "default" } }).toString().trim().split(/\s+/)[0];
  } catch (e) {
    diskUsed = `unavailable (${e.message.split("\n")[0]})`;
  }

  const big = tenants[0];
  const out = {
    runAt: new Date().toISOString(),
    database: ndb.databaseName,
    mongoVersion: build.version,
    wiredTigerCacheGB: round(cacheBytes / 1024 ** 3, 2),
    scale: SCALE,
    config: cfg,
    seedSeconds: { insert: insertSeconds, indexBuild: indexSeconds, total: Math.round((Date.now() - started) / 1000), phases },
    totals: {
      dataSizeGB: round(dataSize / 1024 ** 3, 3), storageSizeGB: round(storageSize / 1024 ** 3, 3), indexSizeGB: round(indexSize / 1024 ** 3, 3),
      diskUsedOnVolume: diskUsed,
      datasetToCacheRatio: round((storageSize + indexSize) / cacheBytes, 2),
      datasetToCacheNote: "ratio = (compressed storage + indexes) / WiredTiger cache. Uncompressed dataSize / cache = " + round(dataSize / cacheBytes, 2) + ". >1 means the working set cannot all stay cached.",
    },
    collections,
    indexConflicts,
    tenants: perTenant,
    worstCase: {
      biggestTenant: { slug: big.slug, tenantId: String(big._id), ownerEmail: big.ownerEmail, ownerPassword: OWNER_PASSWORD },
      perTenant: Object.fromEntries(tenants.map((t) => [t.slug, { ...stats.catalog[t.slug], ...stats.worstCase[t.slug] }])),
      widestDateRange: { from: new Date(L.NOW - L.SPAN_DAYS * L.DAY).toISOString(), to: new Date(L.NOW).toISOString() },
      fixedNow: new Date(L.NOW).toISOString(),
    },
    notes: [
      "Indexes are built after the bulk load, so B-trees are more compact than in a production DB that grew by single inserts (slightly optimistic index size / cache fit).",
      "Faker is not installed (devDependency missing); data comes from seeded pools in perf/seed/lib.js, field shapes follow tests/factories and src/models.",
      "auditlogs are kept inside the 180-day TTL window, otherwise the TTL monitor would delete them during measurement.",
      "Product.totalSales/posSold and Product.salesReturn[] arrays are not back-filled from sales (left 0 / empty).",
      "3% of sale lines have no stamped purchasePrice (legacy fallback path), 3% of sales are back-dated (date < createdAt), 3% have a sales return, 1% carry an exchange line.",
    ],
  };
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(path.join(REPORT_DIR, "seed-stats.json"), JSON.stringify(out, null, 2));
  log(`wrote reports/phase2/seed-stats.json — total ${out.seedSeconds.total}s, data ${out.totals.dataSizeGB} GB, storage ${out.totals.storageSizeGB} GB, indexes ${out.totals.indexSizeGB} GB, disk ${diskUsed}`);
  await db.disconnect();
}

const mb = (b) => round((b || 0) / 1024 ** 2, 2);
const round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

main().catch(async (e) => {
  console.error(e);
  await db.disconnect().catch(() => {});
  process.exit(1);
});
