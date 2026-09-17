# Query Audit & Index Plan — Multi-Tenant Backend

**Date:** 2026-09-17
**Branch:** `developement`
**Scope:** `backend/src` — all models, controllers, services, middleware, jobs, workers, helpers, migrations, seeders
**Status:** Audit complete (Steps 1–3). Nothing applied to any schema or database yet.

---

## Table of contents

1. [Executive summary](#1-executive-summary)
2. [Method](#2-method)
3. [Key finding: tenant scoping is already solved](#3-key-finding-tenant-scoping-is-already-solved)
4. [Current index inventory](#4-current-index-inventory)
5. [Query patterns found](#5-query-patterns-found)
6. [Proposed indexes](#6-proposed-indexes)
7. [Deliberately not adding](#7-deliberately-not-adding)
8. [Patterns no index can serve](#8-patterns-no-index-can-serve)
9. [Non-index issues found](#9-non-index-issues-found)
10. [Apply plan (Step 4)](#10-apply-plan-step-4)
11. [Open questions](#11-open-questions)

---

## 1. Executive summary

The codebase contains roughly **565 Mongoose database calls** across 47 models. Every model except
`permisson.model.js` applies the tenant plugin, so every query is automatically scoped by `tenantId`.

Three findings matter:

**Finding A — the unique-constraint concern in the original brief does not apply.**
`tenantPlugin.scopeIndexes()` already rewrites every schema index to lead with `tenantId`, and already
converts every `unique: true` field into a compound `{ tenantId, field }` unique index with a partial
filter. There is no cross-tenant collision risk to fix. This was verified empirically, not assumed —
see [section 3](#3-key-finding-tenant-scoping-is-already-solved).

**Finding B — the real gap is missing sort and range keys.**
Eight collections have no index at all beyond the bare `{ tenantId: 1 }` the plugin adds. Two of them,
`orders` and `sales`, are the highest-traffic collections in the application. Every list endpoint on
those collections sorts by `createdAt: -1` with no index to serve the sort, which forces an in-memory
sort on the full tenant partition.

**Finding C — seven query patterns cannot be served by any index.**
These are unanchored case-insensitive regex searches and one unbounded `find()`. They need a different
solution (normalized fields, text index, or pagination), not an index. They are listed separately in
[section 8](#8-patterns-no-index-can-serve) rather than being silently skipped.

The proposal is **14 new indexes** across 11 model files. No index drops, no `syncIndexes()`.

---

## 2. Method

The audit was run read-only, in four parallel passes over disjoint parts of the tree, plus one
empirical verification step.

| Pass | Scope | Calls found |
|---|---|---|
| 1 | `src/models/**` — schemas, unique fields, existing indexes | 47 models |
| 2 | `src/controller/**`, `src/service/**` — basenames a–m | 137 |
| 3 | `src/controller/**`, `src/service/**` — basenames n–z | 373 |
| 4 | `src/middleware`, `jobs`, `workers`, `queues`, `helpers`, `utils`, `lib`, `integrations`, `socket`, `migrations`, `scripts`, `seeder` | 55 |

Operations covered: `.find()`, `.findOne()`, `.findById()`, `.aggregate()`, `.countDocuments()`,
`.updateMany()`, `.deleteMany()`, `.findOneAndUpdate()`, `.distinct()`.

**Verification step.** Rather than reading the plugin and reasoning about what it produces, a throwaway
script loaded every model and dumped the effective output of `schema.indexes()` after the plugin ran.
That dump is the ground truth this report rests on. The script was deleted after use; its output is
saved at `/tmp/claude-1000/.../scratchpad/effective_indexes.json` for the duration of the session.

---

## 3. Key finding: tenant scoping is already solved

`backend/src/tenancy/tenantPlugin.js:154-184` defines `scopeIndexes()`, which runs on every schema that
applies the plugin. It does three things:

1. **Field-level indexes** (`index: true`) are removed and re-declared as `{ tenantId: 1, field: 1 }`.
2. **Unique fields** (`unique: true`) become `{ tenantId: 1, field: 1 }` with `unique: true`. Optional
   or sparse fields additionally get a `partialFilterExpression: { field: { $exists: true } }`, so
   documents missing the value do not collide on `null`.
3. **Explicit `schema.index()` calls** are rewritten with `tenantId` prepended, unless they already
   lead with `tenantId`.

Two categories deliberately stay unscoped, and correctly so:

- **TTL indexes** — `expireAfterSeconds` only works on a single-field index. Affects
  `auditlogs.createdAt` (180-day TTL) and `carts.expiresAt`.
- **Text indexes** — MongoDB rejects a text index with a leading non-text key. Affects the full-text
  indexes on `products` and `variants`.

### What this means in practice

There are about 60 `unique: true` declarations across the models. Read naively from the schema files,
every one of them looks like a cross-tenant collision bug — two tenants could not both have a customer
with the same phone number. **They are not bugs.** The plugin has already converted each one. Verified
examples from the effective-index dump:

```
customers     { tenantId: 1, mobileNumber: 1 }  unique
users         { tenantId: 1, email: 1 }         unique
users         { tenantId: 1, phone: 1 }         unique, partial on phone $exists
products      { tenantId: 1, sku: 1 }           unique, partial on sku $exists
purchases     { tenantId: 1, invoiceNumber: 1 } unique
coupons       { tenantId: 1, code: 1 }          unique
```

Collections outside tenancy keep global uniqueness, which is also correct: `tenants.slug`,
`tenants.webhookKey`, `platformusers.email`, `tenantsettings.tenantId`.

**No action is required on unique constraints.** Step 1 of the original brief asked for this to be
fixed; it was already done in a prior migration.

---

## 4. Current index inventory

### Collections with nothing beyond `{ tenantId: 1 }`

| Collection | Traffic | What exists today |
|---|---|---|
| `orders` | **very high** | nothing |
| `sales` | **very high** | unique `invoiceNumber` only |
| `deliveries` | medium | nothing |
| `stockadjusts` | medium | nothing |
| `courierreturns` | low | nothing |
| `wishlists` | low | nothing |
| `userpermissions` | low | nothing |
| `customertypes` | low | nothing |

### Collections that are already well covered

| Collection | Index count | Notes |
|---|---|---|
| `products` | 14 | category, subcategory, brand, isActive, createdAt, totalSales, retailPrice, plus text |
| `sizecharts` | 10 | arguably over-indexed for its size |
| `cratetransactions` | 10 | one per reference type, plus `{ account, createdAt }` |
| `variants` | 8 | product, isActive, slug, sku, barCode, plus text |
| `purchases` | 8 | date, supplierId, paymentStatus, serial, invoiceNumber |
| `users` | 7 | name, roles, isActive+isBlocked, refreshToken, email, phone |
| `auditlogs` | 6 | entity.type, entity.id, user.id, action, all paired with createdAt, plus TTL |
| `coupons` | 6 | expireAt, isActive+expireAt, code, slug, customSerialId |

---

## 5. Query patterns found

### Sort

`createdAt: -1` dominates. It appears on essentially every list endpoint in the application. A handful
of endpoints sort ascending by a display field instead (`supplierName: 1`, `fullName: 1`,
`employeeName: 1`, `permissionName: 1`), and `audit.controller.js` uses `_id: -1` for cursor pagination.

### Pagination

Standard `skip((page - 1) * limit).limit(limit)`. Default page size is 50 in most places, 20 in some,
capped at 100. Migration batching uses 1000.

### Orders — the hottest collection, zero indexes

| Pattern | Location |
|---|---|
| list all, sort `createdAt: -1` | `order.controller.js:477` |
| `createdAt` range filter, sort `createdAt: -1` | `order.controller.js:603` |
| `countDocuments({ createdAt: range })` | `order.controller.js:816` |
| `findOne({ invoiceId })` | `order.controller.js:629` |
| `findOneAndUpdate({ invoiceId })` | `payment.controller.js:20`, `:53`, `:94` |
| `findOne({ invoiceId })` | `service/couriers/SteadFastCourier.js:127`, `:161` |
| `find({ orderStatus: "CourierPending" })` | `order.controller.js:711` |
| `$group` by `orderStatus` | `order.controller.js:745`, `:766` |
| `find({ "courier.trackingId": { $ne: null } })`, sort `createdAt: -1` | `order.controller.js:857` |
| `find({ "courier.name": regex })`, sort `createdAt: -1` | `order.controller.js:835` |
| aggregate on `createdAt` range | `invoice.controller.js:301`, `:328`, `:403` |

The `invoiceId` lookups are the most urgent of these: they sit on the payment webhook and the courier
status callback, so every single payment confirmation currently triggers a collection scan.

### Sales — second hottest

| Pattern | Location |
|---|---|
| paginated list, sort `createdAt: -1` | `sales.controller.js:642`, count at `:651` |
| `{ salesType, invoiceStatus }` filter, sort `createdAt: -1` | `sales.controller.js:516-528`, query at `:597` |
| `date` range in dashboard aggregates | `dashboard.controller.js:847`, `:902`, `:980`, `:1106`, `:1436` |
| `createdAt` range in dashboard aggregates | `dashboard.controller.js:235`, `:1609`, `:1780`, `:1920` |
| `find({ invoiceNumber })` | `sales.controller.js:545` |

Note the split: the dashboard filters `sales` on **two different date fields**. Some aggregates use
`date`, others use `createdAt`. Both need coverage.

### Soft deletes

`{ deletedAt: null }` is a filter on most customer and supplier reads —
`customer.controller.js:421`, `report.controller.js:6144`, `sms.controller.js:143`,
`dashboard.controller.js:450`, `:493`, `:522`, `storeInformation.controller.js:307`.
Neither collection has an index that includes it.

### Hot-path authentication — no gap

All authentication middleware queries hit `_id` or an already-unique field:

```
middleware/authMiddleware.js:35,73        User.findById
middleware/guestOrAuth.js:13              User.findById
middleware/platformGuard.middleware.js:17 PlatformUser.findById
middleware/webhookTenant.middleware.js:9  Tenant.findOne({ webhookKey })
socket/socket.js:22                       User.findById
```

No index work needed on the auth path.

### Cold paths

46 of the 55 calls in pass 4 are migrations, seeders, and backfill scripts. They run once, scan whole
collections by design, and are not worth indexing for.

---

## 6. Proposed indexes

14 indexes across 11 files. Each becomes `{ tenantId, ... }` automatically via the plugin — the
declarations below are what gets written in the schema, not what lands in MongoDB.

### orders — `src/models/order.model.js`

| Index | Serves | Rationale |
|---|---|---|
| `{ createdAt: -1 }` | `order.controller.js:477`, `:603`, `:816`, `:835`, `:857`; `invoice.controller.js:301`, `:328` | Every order list and every date-range filter. Single highest-value index in this plan. |
| `{ orderStatus: 1, createdAt: -1 }` | `order.controller.js:711`, `:745`, `:766` | ESR — equality on status, then sort. Also serves status-only queries via prefix. |
| `{ invoiceId: 1 }` | `order.controller.js:629`; `payment.controller.js:20,53,94`; `SteadFastCourier.js:127,161` | Payment webhook and courier callback hot path. |
| `{ "courier.trackingId": 1, createdAt: -1 }` | `order.controller.js:857` | `$ne: null` is not selective, but the index still supplies the sort and avoids scanning full documents. |

### sales — `src/models/sales.model.js`

| Index | Serves | Rationale |
|---|---|---|
| `{ createdAt: -1 }` | `sales.controller.js:642`, `:651` | Paginated list plus its paired count. |
| `{ salesType: 1, invoiceStatus: 1, createdAt: -1 }` | `sales.controller.js:516-528`, `:597` | ESR. Superset — also serves `salesType`-only through the prefix. |
| `{ date: -1 }` | `dashboard.controller.js:847`, `:902`, `:980`, `:1106`, `:1436` | The dashboard filters on `date`, a distinct field from `createdAt`. Needs its own index. |

### customers — `src/models/customer.model.js`

| Index | Serves | Rationale |
|---|---|---|
| `{ deletedAt: 1, isActive: 1, createdAt: -1 }` | `customer.controller.js:421`; `report.controller.js:6144`; `sms.controller.js:143` | ESR. Soft-delete filter appears on every customer list. |

### suppliers — `src/models/supplier.model.js`

| Index | Serves | Rationale |
|---|---|---|
| `{ deletedAt: 1, isActive: 1 }` | `dashboard.controller.js:450`, `:493`, `:522` | Keep the existing `{ isActive: 1 }` as well — a `{ deletedAt, isActive }` index cannot serve an `isActive`-only query, since `deletedAt` is the prefix. |

### Remaining five

| Collection | File | Index | Serves |
|---|---|---|---|
| `salesreturns` | `salesReturn.model.js` | `{ createdAt: -1 }` | `salesReturn.controller.js:188` — `invoiceNumber` is already indexed; only the sort is missing |
| `stockadjusts` | `stockadjust.model.js` | `{ createdAt: -1 }` | `stockAdjust.controller.js:194`, `:209` |
| `smslogs` | `smsLog.model.js` | `{ createdAt: -1 }` | `sms.controller.js:206`, `:316`, `:344` — the existing index leads with `recipientType` and cannot serve a bare sort |
| `purchases` | `purchase.model.js` | `{ createdAt: -1 }` | `purchase.controller.js:275`, `:639` — existing indexes all key on `date`, but the list sorts by `createdAt` |
| `purchasereturns` | `purchaseReturn.model.js` | `{ createdAt: -1 }` | `purchaseReturn.controller.js:443`, `:451` — existing indexes lead with `supplier` and `returnDate` |

---

## 7. Deliberately not adding

Following the "do not over-index" constraint — every extra index costs write throughput on every
insert and update.

| Collection | Why not |
|---|---|
| `products` | 14 existing indexes cover category, isActive, createdAt, totalSales, retailPrice |
| `variants` | Covered by product, isActive, slug, sku, barCode |
| `auditlogs` | 5 indexes, all correctly paired with `createdAt` |
| `sizecharts` | 10 indexes on a small collection — already past the point of diminishing returns |
| `carts` | `{ user }` and `{ guestId }` already exist |
| `cratetransactions` | `{ account, createdAt: -1 }` already exists |
| `users`, `roles`, `categories`, `coupons` | Small collections, adequately covered |
| All `slug` / `_id` / `findById` lookups | Already unique-indexed by the plugin |
| `orders.shippingInfo.phone` (`helpers/smsRecipients.js:43`) | Cold batch job, not worth the write cost |
| `sales.customerType.type` (`smsRecipients.js:57`, `:75`) | Same |

---

## 8. Patterns no index can serve

Flagged rather than skipped, per the original constraint. Each needs a different solution.

| Pattern | Location | Problem | Suggested direction |
|---|---|---|---|
| `invoiceNumber: { $regex: search, $options: "i" }` | `sales.controller.js:623` | Unanchored and case-insensitive — no B-tree index can serve it | Store a normalized `invoiceNumberUpper`, query with an anchored `^` prefix regex; or Atlas Search |
| `fullName` / `mobileNumber` `$regex` | `customer.controller.js:414-415` | Same | Same approach, or a text index |
| `name` / `sku` / `barCode` `$regex` | `product.controller.js:825-827` | Same. A text index already exists on `products`, but this code path does not use it | Route the search through the existing `$text` index |
| `supplierName: { $regex }` | `supplier.controller.js:169`, `:293` | Same | Anchor the pattern or normalize the field |
| `name` / `slug` `$regex` | `tenant.controller.js:72-73` | Same (input is correctly escaped, but still unanchored) | Low volume — acceptable as-is |
| `courier.name: { $regex: "^pathao$", $options: "i" }` | `order.controller.js:835` | Anchored, but the `i` flag defeats index use | Store the value lowercase and use exact equality |
| `$vectorSearch` on `products` | `utils/retrieve.js:9` | The plugin injects `tenantId` into `$vectorSearch.filter` (`tenantPlugin.js:125-128`). If the Atlas vector index does not declare `tenantId` as a filter field, this query fails or silently degrades | Not fixable from the schema — verify the Atlas index definition separately |

---

## 9. Non-index issues found

Surfaced during the audit, outside the indexing scope. Not fixed, not in the apply plan.

**Unbounded query.** `order.controller.js:477` runs `Order.find()` with three `.populate()` calls and no
`.limit()`. It loads every order for the tenant into memory. This will degrade and eventually exhaust
memory as order volume grows. Indexing the sort helps the sort, but does not bound the result set —
this needs pagination.

**Duplicate index declarations.** Mongoose emits four warnings at model load:

```
Duplicate schema index on {"user":1}
Duplicate schema index on {"guestId":1}
Duplicate schema index on {"invoiceNumber":1}
Duplicate schema index on {"slug":1}
```

Caused by declaring the same index through both `index: true` on the field and an explicit
`schema.index()` call — in `cart.model.js`, `sales.model.js`, and `coupon.model.js`. Cosmetic, no
runtime effect, worth cleaning up separately.

---

## 10. Apply plan (Step 4)

Pending explicit approval. Nothing below has been executed.

1. Add 14 `schema.index(...)` calls across the 11 model files listed in
   [section 6](#6-proposed-indexes). Schemas stay the source of truth, so a later `syncIndexes()` run
   by anyone else will not silently drop them.
2. **No `syncIndexes()`. No drops.** Nothing that removes an existing index will be run. If dropping
   an index ever becomes necessary, every existing index on that collection gets listed and confirmed
   first.
3. Index builds are `background: true` by plugin default. On a large collection this is still
   resource-heavy — run against staging before production.
4. Run `.explain("executionStats")` on the five highest-traffic patterns and report `winningPlan.stage`
   (must be `IXSCAN`, not `COLLSCAN`), `totalDocsExamined` vs `nReturned`, and `executionTimeMillis`:
   - orders by `createdAt` range
   - orders by `orderStatus`
   - order by `invoiceId`
   - sales paginated list
   - customer list with `deletedAt` filter

No query logic, business logic, or API behavior changes. Indexing only.

---

## 11. Open questions

1. **Approval** — apply all 14, or cut specific rows?
2. **Database target** — which environment does `DATABASE_URL` in `backend/.env` point at? A connection
   is needed for the Step 4 explain runs, and the target should be confirmed before connecting.
3. **Atlas vector index** — does the `products` vector index declare `tenantId` as a filter field?
   Cannot be checked from the codebase.
