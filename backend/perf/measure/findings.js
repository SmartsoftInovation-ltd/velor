/**
 * Root-cause grouping for MODE: measure. Ordered rules: the first matching finding wins.
 * Only non-PASS queries are assigned. Recommendations are candidates until MODE: experiment
 * verifies them on the perf DB.
 */
const src = (q, re) => re.test(q.source || "");
const qn = (q, ids) => ids.includes(String(q.id).split(".")[0]);
const has = (q, re) => (q.reasons || []).some((r) => re.test(r));

const findings = [
  {
    id: "F-001", tradeoff: "None for correctness; callers relying on the flat array must page.", severity: "critical", rf: "RF-03",
    title: "GET /sales/get-sales without page/limit loads the whole tenant (1.10M sales + 5 populates) and crashes the API process",
    match: (q) => qn(q, ["Q-645"]),
    endpoints: ["sales-list-all"],
    recommendation: "Always paginate (default limit, max 100) and drop the unpaginated branch; never setCache a full-tenant array. Callers that need 'all' must use a filtered, projected, keyset-paginated query.",
  },
  {
    id: "F-002", tradeoff: "Without the hook, screens that show purchased quantity must request it explicitly (one aggregate per page).", severity: "critical", rf: "RF-05",
    title: "Variant post('find') hook fetches every purchase that contains any returned variant (unindexed allproduct.variant, full documents, no limit) on every Variant read/populate",
    match: (q) => src(q, /variant\.model\.js:31\d/),
    recommendation: "Remove the hook (product.model already dropped its twin) or compute purchased quantity on demand with an aggregate {$match:{tenantId, 'allproduct.variant':{$in}}},{$unwind},{$match},{$group} backed by index {tenantId:1,'allproduct.variant':1}; never hydrate whole purchase docs.",
  },
  {
    id: "F-003", tradeoff: "Extra indexes on sales (~10-20 MB each at 2M docs) and a slightly more complex pipeline; a profit snapshot table must be kept in sync on sale edit/return.", severity: "critical", rf: "RF-02",
    title: "Profit pipelines (saleProfitStages / saleLineProfitStages) run 3 $lookups per sale after a tenant-wide scan: 30 days = 60-68 s, 1-2 years never finish",
    match: (q) => qn(q, ["Q-165", "Q-170", "Q-551", "Q-552", "Q-553", "Q-554", "Q-567"]),
    endpoints: ["rep-invoice-profit-30d", "rep-invoice-profit-1y", "rep-invoice-profit-2y", "rep-product-profit-30d", "rep-product-profit-1y", "rep-product-profit-2y", "rep-customer-invoice-profit-2y", "rep-customer-invoice-profit-topcust", "rep-top-sales-product-2y", "rep-top-customer-2y", "rep-invoice-profit-2y-last"],
    recommendation: "Index {tenantId:1,date:-1} (and {tenantId:1,createdAt:-1} for the dashboard) so $match is selective; paginate/sort BEFORE the variant/product $lookups (only the page's rows need them) and compute totals from the stamped searchItem.purchasePrice (lines saved after 008 migration) instead of joining the catalogue; precompute per-day profit for long ranges.",
  },
  {
    id: "F-004", tradeoff: "Each sales index costs write time on every sale insert/edit (measure in experiment) and RAM (~10-25 MB per index at 2M docs).", severity: "critical", rf: "RF-01",
    title: "sales has no index on date / createdAt / customerType.customerId / salesMen: every sales report and dashboard widget scans the whole tenant (1.10M docs)",
    match: (q) => q.collection === "sales" && src(q, /report\.controller|dashboard\.controller|smsRecipients|sms\.controller/) && !qn(q, ["Q-520", "Q-521", "Q-522", "Q-523", "Q-524", "Q-525", "Q-555"]),
    endpoints: ["rep-sales-invoice-30d", "rep-sales-invoice-1y", "rep-sales-invoice-2y", "rep-sales-product-2y", "rep-sales-summary-2y", "rep-sales-summary-30d", "rep-customer-sales-invoice-2y", "rep-salesman-sales-product-2y", "rep-salesman-sales-invoice-2y", "rep-user-sales-product-2y", "rep-customer-sales-product-2y", "rep-customer-sales-summary-2y", "rep-sales-customers", "rep-customer-customers", "dash-overview-today", "dash-overview-30d", "dash-overview-12m", "dash-overview-all", "dash-sales-summary-12m", "dash-sold-items-summary-12m"],
    recommendation: "Create (ESR) {tenantId:1,date:-1}, {tenantId:1,createdAt:-1}, {tenantId:1,'customerType.customerId':1,date:-1}, {tenantId:1,salesMen:1,date:-1}; put salesType/paymentStatus after the equality keys only where reports filter on them. Pickers (distinct customers/salesmen) should read the customers/users collections, not distinct over sales.",
  },
  {
    id: "F-005", tradeoff: "Keyset pagination removes 'jump to page N'; exact totals become approximate or cached.", severity: "high", rf: "RF-03/RF-07/RF-14",
    title: "Paged sales list sorts 1.10M docs in memory on createdAt (no index), skips, and runs a countDocuments + unanchored invoice regex on every page: ~15 s per page",
    match: (q) => qn(q, ["Q-646", "Q-647", "Q-644"]),
    endpoints: ["sales-list-p1", "sales-list-p100", "sales-list-p1000", "sales-list-last", "sales-list-search"],
    recommendation: "Index {tenantId:1,createdAt:-1,_id:-1}; keyset pagination (createdAt,_id < last seen) instead of skip; cache or drop the exact total; invoice search as anchored prefix (^INV-…) on {tenantId:1,invoiceNumber:1}.",
  },
  {
    id: "F-006", tradeoff: "Prefix search does not match substrings in the middle of names; text search needs whole words.", severity: "critical", rf: "RF-08",
    title: "POS product picker (GET /sales/get-sales-products) runs case-insensitive unanchored $regex over 275k products + 496k variants on every keystroke: q=a never returns, q=sh 14 s",
    match: (q) => src(q, /sales\.controller\.js:(7|8)\d\d/) && ["products", "variants"].includes(q.collection),
    endpoints: ["sales-pos-search-a", "sales-pos-search-sh"],
    recommendation: "Anchored, case-normalised prefix search on indexed fields (store nameLower / sku / barCode, index {tenantId:1,nameLower:1}) with limit 20 and a minimum of 2-3 characters, or Atlas Search / the existing text index ($text) for word search.",
  },
  {
    id: "F-007", tradeoff: "Dropdowns depend on accounts/categories collections being complete (they are the source of truth already).", severity: "critical", rf: "RF-09/RF-06",
    title: "Cash-ledger (cratetransactions, 1.54M rows) loaded whole for dropdowns and reports: /invoice/getallaccounts, /transaction-category, /transaction-report (heap OOM) and unindexed date filters",
    match: (q) => q.collection === "cratetransactions",
    endpoints: ["inv-getallaccounts", "inv-transaction-category", "inv-transaction-report-2y", "inv-cash-ledger-2y", "rep-transaction-report-2y", "rep-accounts-ledger-2y", "txn-get-all-last"],
    recommendation: "Dropdowns read the accounts / transitioncategories collections (tiny) instead of distinct-by-loading the ledger; index {tenantId:1,date:-1} and {tenantId:1,account:1,date:-1} for reports; keyset pagination; totals via one $group on the indexed range.",
  },
  {
    id: "F-008", tradeoff: "A denormalised running due must be updated transactionally on sale/payment/return.", severity: "critical", rf: "RF-04",
    title: "Customer reports (due list, balance summary, ledger, payment report) join every customer to unindexed sales/payment fields: due list and balance summary never finish",
    match: (q) => ["customers", "customerpaymentreciveds", "customeradvancepaymentreciveds"].includes(q.collection) && src(q, /report\.controller/),
    endpoints: ["rep-customer-due-list", "rep-customer-balance-summary", "rep-customer-balance-summary-one", "rep-customer-ledger-2y", "rep-customer-payment-2y", "rep-customer-balance-filters"],
    recommendation: "Index sales {tenantId:1,'customerType.customerId':1,date:-1}, customerpaymentreciveds {tenantId:1,customer:1,createdAt:-1}, customeradvancepaymentreciveds {tenantId:1,customer:1}; aggregate dues once per customer with $group on sales (not a correlated $lookup per customer); maintain a running due on the customer document.",
  },
  {
    id: "F-009", tradeoff: "Denormalised stock value / snapshots must be maintained on every stock movement.", severity: "high", rf: "RF-10/RF-18",
    title: "Catalogue-wide aggregates (stock, low-stock, inventory value, push-sales) scan all 275k products / 496k variants with per-product variant $lookups and large blocking sorts",
    match: (q) => ["products", "variants"].includes(q.collection) && src(q, /report\.controller|dashboard\.controller/),
    endpoints: ["rep-stock", "rep-stock-search", "rep-stock-details", "rep-low-stock", "rep-size-color-stock", "dash-inventory-summary-12m", "dash-inventory-value-summary-12m", "dash-stock-cost-summary-12m", "dash-product-status-summary-12m"],
    recommendation: "Paginate before the variants $lookup; keep a denormalised stock/value per product (updated on stock change) and maintain inventory totals incrementally or in a nightly snapshot; low-stock as an indexed flag {tenantId:1,stockAlert:1}.",
  },
  {
    id: "F-010", tradeoff: "Screens that expect the full list need paging UI; exports must stream.", severity: "critical", rf: "RF-06/RF-11/RF-12",
    title: "Unbounded list endpoints return entire collections with populates (products, variants, orders, purchases, customers, users, payments, returns)",
    match: (q) => has(q, /unbounded result/) || src(q, /(product|variant|order|purchase|customer|user|userpermission|salesReturn|stockAdjust|invoice|sms|courier)\.controller/) && has(q, /SORT|TENANT-SCAN/),
    endpoints: ["prod-getproduct", "variant-list", "variant-search-a", "prod-multivariant", "prod-discount-products", "prod-price-range", "order-all", "order-by-date", "order-courier-pending", "order-courier-info", "order-courier-sent", "purchase-all", "cust-list", "cust-list-search", "cust-payments", "users-all", "inv-followup-report", "inv-pushwebsalesvariant", "stock-by-category", "sales-return-all"],
    recommendation: "Mandatory limit (max 100) + keyset pagination on {tenantId:1,createdAt:-1,_id:-1} for each list; projections instead of full documents; populate only the fields the screen shows; search endpoints return at most 20-50 rows.",
  },
  {
    id: "F-011", tradeoff: "Multikey indexes on line arrays are larger (one key per line) and add write cost to sales/purchases.", severity: "high", rf: "RF-16",
    title: "Product ledger unwinds every sale/purchase line of the tenant to find one product (no index on searchItem.productId / variantId / allproduct.product)",
    match: (q) => qn(q, ["Q-518", "Q-519", "Q-520", "Q-521", "Q-522", "Q-523", "Q-524", "Q-525"]),
    endpoints: ["rep-product-ledger-product", "rep-product-ledger-variant"],
    recommendation: "Multikey indexes {tenantId:1,'searchItem.productId':1,date:-1}, {tenantId:1,'searchItem.variantId':1,date:-1}, {tenantId:1,'allproduct.product':1,date:-1}; $match on the line field BEFORE $unwind; require a date range.",
  },
  {
    id: "F-012", severity: "high", rf: "RF-15",
    title: "push-sales-product streams 375k unwound sale lines, 191k orders and 239k products into Node to rank slow sellers (567 getMore batches per request)",
    match: (q) => qn(q, ["Q-555", "Q-556", "Q-557"]),
    endpoints: ["rep-push-sales-product-2y"],
    recommendation: "Do the per-product sold-quantity $group in MongoDB on an indexed date range (F-004) and return only the top N; never pull raw lines/orders/products to the app.",
  },
  {
    id: "F-013", tradeoff: "Two more small indexes on supplierduepayments.", severity: "high", rf: "RF-07",
    title: "Purchase / supplier reports scan the tenant's purchases and supplier payments (no date index on supplierduepayments; $unwind of every purchase line)",
    match: (q) => ["purchases", "supplierduepayments", "purchasereturns", "suppliers"].includes(q.collection) && src(q, /report\.controller|invoice\.controller|dashboard\.controller/),
    endpoints: ["rep-purchase-invoice-2y", "rep-purchase-product-2y", "rep-purchase-summary-2y", "rep-supplier-payment-2y", "rep-supplier-ledger-2y", "rep-supplier-purchase-invoice-2y"],
    recommendation: "Purchases already have {tenantId,date}: $match the range first, then $unwind; add supplierduepayments {tenantId:1,date:-1} / {tenantId:1,supplierId:1,date:-1}.",
  },
  {
    id: "F-014", severity: "high", rf: "RF-18/RF-07",
    title: "Stock-adjust and returns reports sort/scan without supporting indexes (overallStock 41 s blocking sort; sales-return reports 9-14 s)",
    match: (q) => ["stockadjusts", "salesreturns"].includes(q.collection),
    endpoints: ["inv-overall-stock", "rep-stock-adjustment-2y", "rep-product-sales-return-2y", "rep-product-sales-return-summary-2y", "stock-adjust-list-last"],
    recommendation: "stockadjusts {tenantId:1,createdAt:-1}; salesreturns {tenantId:1,createdAt:-1}; paginate overallStock.",
  },
  {
    id: "F-015", tradeoff: "Each orders index adds write cost on order create/update (storefront).", severity: "high", rf: "RF-12",
    title: "orders: no createdAt / orderStatus / courier index — order reports and status counts scan all 220k orders",
    match: (q) => q.collection === "orders",
    endpoints: ["order-count-amount", "order-status-counts", "order-datewise", "inv-order-status", "inv-invoicewise-report"],
    recommendation: "{tenantId:1,createdAt:-1}, {tenantId:1,orderStatus:1,createdAt:-1}, {tenantId:1,'courier.status':1} (per the screens' filters).",
  },
  {
    id: "F-016", tradeoff: "Batching makes the purge take longer overall but keeps each operation short.", severity: "medium", rf: "RF-17",
    title: "Audit purge deletes ~all expired audit rows of every tenant in one unbatched deleteMany at 03:00 and on every server start",
    match: (q) => src(q, /purgeAuditLogs/),
    endpoints: [],
    recommendation: "Rely on the TTL index (align schema TTL with the 30-day policy) or delete in batches of 1-5k by _id with a pause; do not run on every process start.",
  },
  {
    id: "F-019", tradeoff: "Two small indexes on payment collections; per-widget caching adds staleness.", severity: "medium", rf: "RF-10",
    title: "Dashboard customer / payment widgets scan all 330k customers and 165k customer payments (no createdAt / customer index on payment collections)",
    match: (q) => ["customers", "customerpaymentreciveds", "customeradvancepaymentreciveds"].includes(q.collection) && src(q, /dashboard\.controller/),
    endpoints: ["dash-customer-summary-12m", "dash-customer-due-payment-summary-12m", "dash-inflow-transaction-summary-12m", "dash-day-cash-summary-12m"],
    recommendation: "customerpaymentreciveds {tenantId:1,createdAt:-1} and {tenantId:1,customer:1,createdAt:-1}; customers count via a maintained counter or a cached estimate; dues from a maintained running balance (see F-008).",
  },
  {
    id: "F-020", tradeoff: "Exact page totals become approximate or cached.", severity: "medium", rf: "RF-14/RF-08",
    title: "Product / variant list pages run countDocuments (and a case-insensitive regex) on every page request",
    match: (q) => src(q, /product\.controller|stockAdjust\.controller|variant\.controller/) && (q.type === "count" || has(q, /countDocuments|regex/)),
    endpoints: ["prod-perpage-p1", "prod-single-variant", "prod-single-variant-search", "stock-multivariant-p1"],
    recommendation: "Return hasNextPage from limit+1 instead of an exact count (or cache the count per filter), prefix search on an indexed normalised field.",
  },
  {
    id: "F-099", severity: "medium", rf: null,
    title: "Other slow / unselective queries (see query-audit.json reasons)",
    match: () => true,
    recommendation: "",
  },
];

const assign = (q) => {
  if (q.status === "PASS") return null;
  return findings.find((f) => f.match(q)) || null;
};

/** Findings that are not about one query: cache behaviour, index hygiene. */
const extra = (a) => {
  const out = [];
  const c = a.cache || [];
  const ov = a.endpoints.filter((e) => /^dash-overview/.test(e.id));
  if (ov.length) {
    const lines = c.map((r) => `${r.endpoint}: hit ratio ${Math.round(r.hitRatio * 100)}%, hit p95 ${r.hitP95Ms ?? "—"} ms, miss p95 ${r.missP95Ms ?? "—"} ms, ${r.versionKeysWithoutTtl}/${r.versionKeys} version keys without TTL`).join("; ");
    out.push([
      "## F-017 — Dashboard overview: 31 aggregates per request, a miss takes 135 s, so the 2-minute Redis cache never helps (every sale bumps the dashboard namespace)",
      "- Status / suggested severity: FAIL / critical (inventory RF-10)",
      "- Query: Q-137..Q-166 (src/controller/dashboard.controller.js getOverview) · Endpoint: GET /api/v1/dashboard/overview",
      `- Scenario (dataset size, parameters): megamart, range today / 30d / 12m / all; cache forced to miss, then cache as-is`,
      `- Evidence: ${ov.map((e) => `${e.id}: ${e.timedOut ? "killed at 60 s" : `p95 ${e.p95Ms} ms`}, ${e.roundTrips} round-trips (${e.handlerRoundTrips} handler)`).join("; ")}; uncapped single run range=30d = 135,354 ms (status 200). The cache-hit scenario could not hit: the first miss never completed inside 60 s, so nothing was cached.${lines ? " Cache mix: " + lines : ""}`,
      "- Expected: endpoint p95 ≤ 200 ms; ≤ 5 round-trips; cache hit ratio ≥ 70%",
      "- Recommended fix: split the overview into widgets loaded independently; serve totals from pre-aggregated daily summaries (updated on write or every few minutes) instead of scanning sales/products/variants; stop bumping the dashboard namespace on every write (TTL-based staleness is acceptable per the code comment) and give namespace version keys a TTL.",
      "- Fix verified on perf DB: pending (MODE: experiment)",
      "- Tradeoff: dashboard figures can lag by the refresh interval.",
    ].join("\n"));
  }
  if (c.length) {
    out.push([
      "## F-021 — Redis cache is invalidated by every sale: hit ratio collapses under normal POS traffic; namespace version keys have no TTL",
      "- Status / suggested severity: WARN / medium (inventory RF-10)",
      "- Query: — (cache.util.js bumpNsVersion / buildCacheKey) · Endpoint: " + [...new Set(c.map((r) => r.endpoint.split(" (")[0]))].join(", "),
      "- Scenario (dataset size, parameters): megamart; 50 requests (10 for the report, each miss is minutes) with a realistic parameter mix, once without writes and once with a real POST /sales/create-sales after every 2nd read",
      `- Evidence: ${c.map((r) => `${r.endpoint}: hit ratio ${Math.round(r.hitRatio * 100)}% (${r.hits}/${r.requests}), hit p95 ${r.hitP95Ms ?? "—"} ms, miss p95 ${r.missP95Ms ?? "—"} ms`).join("; ")}; ${c[0].versionKeysWithoutTtl} of ${c[0].versionKeys} namespace version keys (t:<tenant>:<ns>:v) have no TTL (data keys do).`,
      "- Expected: hit ratio ≥ 70% on cached endpoints; every key with a TTL",
      "- Recommended fix: fix the underlying queries first (a miss must be cheap, F-003/F-004/F-005); scope invalidation (a sale should not invalidate product lists or 2-year reports whose range excludes today), or rely on short TTLs for reports; set EX on version keys.",
      "- Fix verified on perf DB: pending (MODE: experiment)",
      "- Tradeoff: less aggressive invalidation means cached figures can be up to TTL old.",
    ].join("\n"));
  }
  const bad = (a.indexes || []).filter((i) => i.verdict !== "used");
  if (bad.length) {
    const red = bad.filter((i) => i.verdict === "redundant");
    const un = bad.filter((i) => i.verdict === "unused");
    const mb = (arr) => Math.round(arr.reduce((s, i) => s + i.sizeMB, 0));
    out.push([
      "## F-018 — Redundant and unused indexes (write + RAM cost)",
      "- Status / suggested severity: WARN / low",
      "- Query: index audit ($indexStats delta over the whole measurement run) · Endpoint: —",
      `- Scenario (dataset size, parameters): all collections ≥ 1,000 docs`,
      `- Evidence: ${red.length} redundant (${mb(red)} MB), e.g. ${red.slice(0, 6).map((i) => `${i.collection}.${i.name} ⊂ ${i.prefixOf}`).join(", ")}; ${un.length} unused during the run (${mb(un)} MB), largest: ${[...un].sort((x, y) => y.sizeMB - x.sizeMB).slice(0, 6).map((i) => `${i.collection}.${i.name} ${i.sizeMB} MB`).join(", ")}. Text indexes exist but no query uses $text.`,
      "- Expected: every index serves a query",
      "- Recommended fix: drop single-field {tenantId:1} where a compound starting with tenantId exists (keep the tenant plugin from re-declaring it), drop the unused text indexes or start using them for search (F-006); review unused unique indexes before dropping (they enforce constraints). Unused = not used by the measured scenarios; confirm against production $indexStats.",
      "- Fix verified on perf DB: pending (MODE: experiment)",
      "- Tradeoff: dropping an index that a rare path needs turns it into a scan — check production $indexStats first.",
    ].join("\n"));
  }
  return out;
};

module.exports = { findings, assign, extra };
