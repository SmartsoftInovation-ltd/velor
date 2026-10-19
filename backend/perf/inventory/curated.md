## Red flags — reviewed (candidates for MODE: measure)

Hand-checked against the source after the automatic pass. Ordered by suspected impact. "Suspected severity" is the
table in the agent brief applied to the static shape; nothing below is proven until MODE: measure records the explain and
timings. Dataset for every worst case: tenant `megamart` (1.10M sales, 275k products, 496k variants, 330k customers,
220k orders, ~1.54M cash-ledger rows, 110k purchases), widest date range 2024-10-19..2026-10-19.
Query ids are stable for a given `src/` tree (sorted by file:line); re-run `npm run perf:inventory` after code changes.

### RF-01 — `sales` has no index on `date`, `createdAt`, `customerType.customerId`, `salesType`, `paymentStatus`, `salesMen` (suspected Critical)
Indexes on `sales`: `_id`, `tenantId`, `tenantId+invoiceNumber`, `tenantId+createdBy` only. Every date-range read scans
the whole tenant (1.10M docs) through `tenantId_1`:
- Dashboard (createdAt / date ranges): Q-137..Q-141, Q-151, Q-154, Q-165, Q-168..Q-170, Q-174, Q-177, Q-181, Q-192, Q-207, Q-221..Q-223, Q-235.
- Reports (`POST /api/v1/report/*`, `date` range, required but unbounded width): Q-533, Q-538..Q-540, Q-543, Q-550..Q-555, Q-562..Q-567, Q-570..Q-572.
- No date at all (whole tenant): Q-148, Q-213 (`customerType.type`), Q-522 (product ledger, date optional), Q-560/Q-561 (user/salesman sales-product), Q-860/Q-861 (SMS recipients).
- Customer filters on `customerType.customerId` (customer reports, customer ledger, due list) have no index either — see RF-04.
Worst case: 2-year range, no salesType/paymentStatus filter, biggest customer. Candidate fix to test: `{tenantId:1, date:-1}`,
`{tenantId:1, createdAt:-1}`, `{tenantId:1, "customerType.customerId":1, date:-1}` (ESR).

### RF-02 — Profit pipelines do 3 `$lookup`s per sale over the full range (suspected High)
`saleProfitStages()` / `saleLineProfitStages()` (`src/utils/saleProfit.util.js:62-90`) join `variants._id`, `products._id`,
`salesreturns.invoiceNumber` (all indexed) for every matched sale before grouping: Q-165 (dashboard `grossProfit`, createdAt),
Q-170 (sales summary), Q-551 (customer invoice profit), Q-552 (invoice profit), Q-553 (product profit), Q-554 (top sales product),
Q-567 (top customer). 2-year range = 1.10M sales × 3 index lookups each, on top of RF-01's collection scan. Measure with
`explain` on the full pipeline (`$lookup` totalDocsExamined, usedDisk) at 30 days, 1 year, 2 years.

### RF-03 — `GET /api/v1/sales/get-sales` returns the whole tenant when called without `page`/`limit` (suspected Critical)
Q-645 (`src/controller/sales.controller.js:636`): `find(listFilter).sort({createdAt:-1})` with no limit, 5 populates
(customer, product, variant → fires the Variant hook RF-05, salesMen, discountGivenBy), and the result is written to Redis
(`setCache(…, 300)`). The comment says "existing callers expect a flat array". megamart: 1.10M sales, unindexed sort.
The paged branch Q-646/Q-647 (`:681`, `:691`) runs `.sort({createdAt:-1}).skip()` with no createdAt index (blocking SORT over
1.10M docs), an unanchored case-insensitive `$regex` on `invoiceNumber`, and a `countDocuments` on every page.
Worst case: no params; then `?page=<last>&limit=100`; then `?search=1`.

### RF-04 — Customer reports: correlated `$lookup` per customer into unindexed fields (suspected Critical)
- Q-619 `POST /report/customer-due-list` (`report.controller.js:10161`, `:10192`): for each customer, `$lookup` into `sales`
  with `$expr $eq ["$customerType.customerId", "$$cid"]` (no index) and into `customerpaymentreciveds` on `customer` (no index).
  megamart: 330k customers × scan of 1.10M sales.
- Q-614 `POST /report/customer-balance-summary` (`:9587`): same pattern, `let: {cid}` sub-pipeline into `sales` per customer, then `$facet` sort/skip.
- Q-618 `POST /report/customer-ledger` (`:10017`): `$unionWith` sales / payments / advances / sales returns; the sales branch
  filters `customerType.customerId` (unindexed); the sales-return branch `$lookup`s every return's sale and filters the
  customer afterwards (all returns of the tenant).
- Q-534, Q-568 (`distinct customerType.customerId` over all sales) feed the customer pickers.
Worst case: no customer filter (due list / balance summary), and the top customer (21,093 invoices) for the ledger.

### RF-05 — Variant `post('find')` hook: unindexed, unbounded `purchases` query on every Variant read (suspected High)
Q-935 (`src/models/variant.model.js:315`): after any `Variant.find` (and any populate of a Variant path, which runs
`Variant.find`) the hook runs `purchaseModel.find({"allproduct.variant": {$in: ids}})` — no index on `allproduct.variant`,
no projection (full purchase docs with all lines), no limit. It is 1 extra round-trip per query (not N+1) but each one scans the
tenant's purchases (110k for megamart).
Fired by `Variant.find`: Q-098, Q-310, Q-447, Q-449, Q-487, Q-493, Q-502, Q-526, Q-754, Q-842, Q-843.
Fired by populate of a variant path: Q-033, Q-034, Q-044, Q-241, Q-309, Q-311, Q-425, Q-426, Q-432, Q-437, Q-442, Q-443, Q-445,
Q-446, Q-448, Q-461, Q-462, Q-475, Q-494, Q-496, Q-638 (after every sale create), Q-644..Q-646, Q-668, Q-673, Q-674, Q-749,
Q-750, Q-752, Q-753, Q-763, Q-856. Worst case: `GET /api/v1/variant` (Q-842, all 496k variants → `$in` of 496k ids).
Candidate fix: `{tenantId:1, "allproduct.variant":1}` + projection, or drop the hook (product.model already removed its twin, `product.model.js:297`).

### RF-06 — Unbounded list endpoints on large collections (suspected Critical; most are cached in Redis on success)
| Query | Endpoint | Collection (megamart) | Notes |
|---|---|---|---|
| Q-425 | GET /product/getproduct | products 275k | 3 populates incl. `variant` (RF-05), sort createdAt with no `{tenantId,createdAt}` index |
| Q-842 | GET /variant | variants 496k | populate product→category/brand/subcategory/discount + byReturn/salesReturn |
| Q-115 | GET /customer/get-customers | customers 330k | optional unanchored `$regex` `i` on fullName/mobileNumber, sort createdAt unindexed |
| Q-337, Q-342, Q-350, Q-358, Q-359 | GET /order/allorders, filterorderbydate, getallcourierpendingorder, getcourierinfo, couriersendedorders | orders 220k | 3 populates each; orders only has `channel`/`orderFrom` indexes |
| Q-461, Q-475 | GET /purchase/all-allpurchases, search-purchase | purchases 110k | 3 populates incl. variant |
| Q-124 | GET /customer/get-customer-payment-recived | customerpaymentreciveds | whole collection for tenant |
| Q-296 | GET /invoice/getallaccounts | cratetransactions ~1.54M | loads EVERY ledger row with an account to build a ~6-item account dropdown |
| Q-297, Q-298 | GET /invoice/transaction-category, POST /invoice/transaction-report | cratetransactions | same pattern / no limit |
| Q-827, Q-836, Q-007 | GET /auth/getallusers, get-user-added-by-admin, /userpermission/get-all-users | users | Q-827 3 populates |
| Q-732, Q-733, Q-736, Q-858..Q-861 | SMS phone lists / recipient counts / due-SMS-to-all | users, orders, customers, sales | full tenant reads to build phone lists |
| Q-615 | GET /report/customer-balance-summary/filters | customers 330k | all customers sorted by fullName (no index) |
| Q-181, Q-182, Q-188 | GET /dashboard/inflow-, outflow-transaction-summary | sales, payments, purchases | every doc in the date range, populated |
| Q-310, Q-311 | GET /invoice/pushwebsalesvariant, pushwebsalesproduct | variants, products | `totalSales` + createdAt filter, 3 populates |
| Q-446, Q-447, Q-442 | GET /product/discount-products, multiplevarinatproduct | products, variants | `$ne` filters, no limit |
| Q-752, Q-753 | GET /stock/stock-adjust/category/:category, subcategory/:id | products | biggest category = 62,052 products |
| Q-556 | POST /report/push-sales-product | orders | all orders in range |
Worst case: no filters, megamart. Also measure response size and Redis `SET` size (Redis `maxmemory` 512 MB in perf).

### RF-07 — `skip()` / `$facet`+`$skip` pagination everywhere (suspected High at deep pages)
46 paginated reads on ≥10k collections use skip: Q-082, Q-292, Q-302, Q-317, Q-437, Q-440, Q-494, Q-511..Q-517, Q-528, Q-529,
Q-533, Q-538, Q-550..Q-554, Q-557, Q-559, Q-562..Q-567, Q-570, Q-571, Q-573, Q-582, Q-587, Q-604, Q-608, Q-614, Q-618, Q-619,
Q-646, Q-748, Q-750, Q-754, Q-755. The report pattern is `$facet { rows: [$sort,$skip,$limit], total: [$count] }`: the whole
matched set is materialised and sorted on every page, so page 1 costs the same as the last page (deep pages add the skip).
`parsePagination` caps `limit` at 200. Only `GET /api/v1/audit` (Q-015) uses cursor pagination.
Measure page 1, 100, 1000 and last for Q-437, Q-646, Q-533, Q-552, Q-582.

### RF-08 — Unanchored / case-insensitive regex search on large collections (suspected High)
- Q-648 `GET /sales/get-sales-products` (POS product picker, every keystroke): `$or` of `name`/`sku`/`barCode` `RegExp(q,"i")`
  over products 275k, then the same on variants; `_score` sort; limit ≤50. Codes ≥4 chars use exact match (indexed) instead.
- Q-450, Q-451 `GET /product/search-product`; Q-843 `GET /search-variant` (no limit); Q-526, Q-527 `GET /report/ledger-items`;
  Q-440/Q-441 single-variant products (regex + count each page); Q-115 customers; Q-646/Q-647 invoiceNumber; Q-492/Q-493
  purchase-return product search (no limit); Q-516, Q-517, Q-528, Q-529 stock reports (regex after `$lookup`, in memory);
  Q-619 due list; Q-287, Q-358.
Products and variants have text indexes (`name_text_seo…`, `variantName_text_sku_text`) that no query uses (no `$text` found
in `src/`). Worst case: 1–2 character term, e.g. `q=a`.

### RF-09 — Cash ledger (`cratetransactions`, 2.8M; megamart ≈1.54M) filtered on unindexed `date` / `transactionType` / `transactionCategory` (suspected High)
Only `{tenantId, account, createdAt}` and the `*Reference` indexes exist. Reports and dashboard filter on `date`:
Q-152, Q-163, Q-164, Q-171, Q-172, Q-297..Q-302, Q-304, Q-308, Q-582..Q-595. Q-582/Q-587 add 2 populates, skip, a
`countDocuments` (Q-583, Q-589) and a totals aggregate (Q-584, Q-590) per request; Q-588 (`report.controller.js:8514`)
populates inside a `for` loop over fields. Worst case: 2-year range, no account filter.

### RF-10 — Dashboard: ~30 parallel aggregates per cache miss, many full-tenant (suspected High; cached 2 min)
`GET /api/v1/dashboard/overview` (getOverview, 31 ops) runs `Promise.all` of ~30 aggregates, including full-tenant
`$group`s over products/variants (Q-143..Q-146, Q-159, Q-160) and the profit pipeline (Q-165). Other widgets:
Q-205..Q-211, Q-224..Q-231 (inventory/stock-cost/status: full products+variants scans), Q-210 (`$unwind` every purchase line).
Cache: `CACHE_TTL = 120 s`, but every write to sales/purchase/product/variant/stock/customer/… bumps the `dashboard`
namespace (`cache.util.js` `DASHBOARD_SOURCE_NAMESPACES`), so on a store taking sales continuously the hit ratio should
approach 0. Namespace version keys (`<ns>:v`) are written without TTL (`INCR`/`SET` without `EX`).
Measure cold (miss) p95 for range=30d/1y/all, then hit ratio with interleaved sale writes.

### RF-11 — `products` / `variants` lists sorted on `createdAt` with `{}` filter (suspected High)
`{tenantId, isActive, createdAt}` exists but list filters do not include `isActive`, so `sort({createdAt:-1})` cannot use
it: Q-437/Q-438 `GET /product/productperpage` (skip + count every page), Q-440, Q-425, Q-442, Q-446, Q-754/Q-755
(`GET /stock/getallmultiplevariant`, skip), Q-842. Expect blocking SORT over 275k / 496k docs (100 MB limit → disk).

### RF-12 — `orders`: no `createdAt` / `orderStatus` / `courier.*` index (suspected High)
Indexes: `channel`, `orderFrom` only. Q-292 (`POST /invoice/invoicewise-report`, skip), Q-290/Q-291 (same endpoint), Q-293 (`POST /invoice/order-status`, createdAt),
Q-309 (6 populates, unbounded), Q-337, Q-342, Q-350, Q-358, Q-359, and Q-693 (`GET /shop/orders`, storefront "my orders"
by `user` — no `user` index). Worst case: 220k orders, no filter.

### RF-13 — `distinct` over large collections for picker lists (suspected Medium)
Q-531, Q-602 (`purchases.supplierId`), Q-534, Q-568 (`sales.customerType.customerId`, then `customers.find({_id:{$in: up to 330k}})`
Q-535/Q-569), Q-536 (`sales.salesMen`), Q-611/Q-612 (payments.customer). No index on the distinct field → full tenant scan.

### RF-14 — `countDocuments` on every list request (suspected Medium)
Q-083, Q-142, Q-143, Q-147, Q-166, Q-318, Q-438, Q-441, Q-495, Q-583, Q-589, Q-647, Q-751, Q-756, Q-757. Worst on unindexed
filters: Q-647 (sales regex), Q-441 (products regex), Q-583/Q-589 (ledger date).

### RF-15 — N+1 loops on write paths (suspected Medium; round-trips grow with cart / line count)
Per-line `findById`/`findByIdAndUpdate`/`findOneAndUpdate` inside `for` loops:
- Orders: Q-325, Q-326 (+populate per line), Q-328, Q-329, Q-333, Q-334 (`POST /order/createorder`), Q-340/Q-341 (update),
  Q-345/Q-346 (delete); storefront Q-695, Q-696, Q-701..Q-704 (`POST /shop/order`); POS Q-412, Q-413, Q-418 (`POST /order/pos`).
- Purchases: Q-457, Q-458 (create), Q-464, Q-465, Q-467, Q-468 (update), Q-471, Q-472 (delete), Q-455.
- Sales returns: Q-670, Q-671, Q-677, Q-678, Q-684..Q-687. Courier return: Q-095, Q-096 (`.map`).
- Payments: Q-629/Q-630 (per payment line on every sale), Q-632, Q-102, Q-107, Q-479, Q-795.
- Permissions/roles: Q-011, Q-627, Q-1021 (one `findById` per permission id).
Sales create/update/delete already use `bulkWrite` for stock (Q-640, Q-641, Q-650, Q-651, Q-656, Q-657) — the model to copy.
Measure round-trips at 1, 10, 50 lines.

### RF-16 — Report scans of every sale line for one product (suspected High)
`POST /report/product-ledger` (Q-520..Q-525): date filter optional, then `$unwind` all lines and match the product/variant
afterwards — no index on `searchItem.productId` / `allproduct.product`. With no dates: every sale (1.10M) and purchase
(110k) of the tenant is unwound for one product. Same shape: Q-555 (`$nin` on unwound lines), Q-207, Q-222 (dashboard sold items).

### RF-17 — Audit log purge: one unbatched `deleteMany` (suspected Medium, write burst)
Q-864 (`src/jobs/purgeAuditLogs.job.js:20`, cron 03:00 Asia/Dhaka + once at every server start): native
`auditlogs.collection.deleteMany({createdAt: {$lt: now-30d}})` across all tenants, served by the TTL index `createdAt_1`.
The schema TTL is 180 days but the job keeps 30, so the first run after deploy deletes ~83% of the collection
(1.25M of 1.5M docs in perf) in a single operation. Measure its duration and its impact on concurrent reads (Phase 3 for
load); note it runs on every process start.

### RF-18 — Other suspects to measure
- Q-015 `GET /api/v1/audit`: cursor pagination (good) but sorted by `_id` while the compound indexes end in `createdAt:-1`
  → check the plan does not pick `_id_` and filter other tenants' rows.
- Q-016 entity timeline, Q-123/Q-132/Q-136 (`findOne`/`find` on payments by `customer` sorted by createdAt — no `customer` index).
- Q-643, Q-662 (`customeradvancepaymentreciveds.findOne({customer})` on every sale create/delete — no `customer` index).
- Q-444 `GET /product/price-range`: `$lookup` all variants of every product then `$or` match, no limit.
- Q-295 `POST /invoice/overallStock` (stockadjusts, unbounded + 2 `$lookup`s), Q-530 low-stock report and Q-146 dashboard
  low-stock (`buildLowStockStages`: `$lookup` variants per product over all 275k products).
- `settings.service.js` `loadRaw` (Q-1007), `tenantResolver.getTenantById` (Q-1026) and `authGuard` / `resolveTokenSession`
  `users.findById` (Q-865, Q-866) run on most requests — count them in the endpoint round-trip numbers.

### Not flagged / checked OK
- Every `$lookup` with `foreignField` joins an indexed field (`_id`, `variants.product`, `salesreturns.invoiceNumber`,
  `suppliers.supplierId`, `purchases.supplierId`); the only unindexed joins are the two correlated `let` sub-pipelines in RF-04.
- All `setCache` calls pass a TTL (60 s–300 s); only the namespace version keys lack one (RF-10).
- No `$where`, no `$text`, no `estimatedDocumentCount` on tenant collections (the plugin forbids it).
- Native-driver calls bypassing `tenantPlugin`: `audit.worker.js` `insertOne` (stamps tenantId itself) and the purge job (platform scope, intended).
