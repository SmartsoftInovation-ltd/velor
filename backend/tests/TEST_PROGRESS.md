# Phase 1 test progress

Resume point for a later session. Update after every module.

Stack decision: existing Jest suite extended (no Vitest); Mongo = mongodb-memory-server
replica set; Redis = private `redis-server` started by `tests/globalSetup.js` (no Docker).

## Status

| # | Module | Risk | Test files | Tests | Bugs | Status |
|---|---|---|---|---|---|---|
| 0 | Infrastructure (helpers, factories, private Redis) | — | `tests/integration/testInfra.test.js` | 5 | — | done |
| 1 | Cross-cutting route matrix (all 487 routes: C, D, B/G, tenancy) | High | `tests/contract/routeMatrix.test.js` | 1780 | 001-003 | done |
| 2 | Auth / users (`/auth`) | High | `tests/integration/auth.routes.test.js` | 50 | 006-012 | done |
| 3 | Sales (`/sales`) | High | `tests/integration/sales.routes.test.js` | 64 | 013-017 | done |
| 4 | Sales returns | High | `tests/integration/salesReturn.routes.test.js` | 29 | 018-025 | done |
| 5 | Purchases / purchase returns | High | `tests/integration/purchase.routes.test.js` | 32 | 025-030 | done |
| 6 | Stock adjust | High | `tests/integration/stockAdjust.routes.test.js` | 17 | 031-033 | done |
| 7 | Product / variant | High | `tests/integration/product.routes.test.js` | 35 | 034-039 | done |
| 8 | Coupon / cart / order / shop / payment | High | `tests/integration/commerce.routes.test.js` | 46 | 040-049 | done |
| 9 | Reports + profit | High | `tests/integration/profitRules.test.js`, `tests/integration/reports.smoke.test.js` | 7 + 418 | 050 | done |
| 10 | Customers / dues / advance | High | `tests/integration/customer.routes.test.js` | 23 | 051-055 | done |
| 11 | Accounts, transactions, money transfer, fund handover | Medium | `tests/integration/finance.routes.test.js` | 17 | 056-059 | done |
| 12 | Workers (image, sms, email, audit) | Medium | `tests/worker/*.worker.test.js` | 28 | 060-062 | done |
| 13 | Middleware + error handler unit tests | Medium | `tests/middleware/*.test.js` | 44 | 005, 063, 064 | done |
| 14 | Utils / validators unit tests | Medium | `tests/unit/utils.test.js`, `tests/unit/cacheAndCost.test.js` | 26 | 065, 066 | done |
| 15 | Catalogue + review findings (sale integrity, audience, supplier payments) | Low/High | `tests/integration/catalogue.routes.test.js`, `tests/integration/salesIntegrity.test.js` | 13 + 10 | 014, 037, 067-072 | done |
| 16 | Contract: openapi.yaml + envelope consistency; courier, misc, suppliers/orders | — | `tests/contract/envelope.test.js`, `tests/contract/openapi.test.js`, `tests/integration/courier.test.js`, `misc.routes.test.js`, `supplierAndOrders.routes.test.js` | 431 + 3 + 5 + 8 + 10 | 004, 073-075 | done |
| 17 | Quality gates: coverage thresholds, Stryker, CI | — | `jest.config.js`, `stryker.config.js`, `.github/workflows/test.yml` | — | — | done |

## Next bug id

BUG-005, BUG-015 and BUG-076 onward are free (005 and 015 were investigated
and not confirmed: `validate()`'s double `next()` does not re-run the
controller; parallel first sales do not collide on the counter upsert).

## Verifying known-bug tests

`BUG_AUDIT=1 npx jest -t "BUG-"` runs every `test.failing` as a normal test so
each failure reason can be read; it must be the assertion that describes the
bug (last audited after module 8: all match).

## Final state (end of Phase 1)

- Suite: **94 files, 3697 tests, all passing** — 3 consecutive full runs with
  `npm run test:coverage` (coverage gates on), 4 parallel workers. Before
  Phase 1: 65 files, 583 tests. Added: 29 files, 3114 tests (1780 of them the
  generated route matrix, 418 the report smoke matrix, 431 the envelope check).
- Known-bug tests (`test.failing`, audited with `BUG_AUDIT=1`): every one fails
  on the assertion describing its bug. 74 bugs in `BUGS_FOUND.md`.

### Coverage (lines / branches)

| Module | Lines | Branches |
|---|---|---|
| auth/users | 94.4 % | 80.5 % |
| sales | 91.6 % | 76.8 % |
| sales returns | 88.9 % | 60.7 % |
| purchases | 86.3 % | 67.7 % |
| stock adjust | 87.5 % | 65.6 % |
| product/variant | 79.0 % | 62.0 % |
| coupon/cart/orders/shop/payment | 79.5 % | 62.4 % |
| reports/dashboard/invoice | 85.4 % | 72.3 % |
| profit/cost utils | 100.0 % | 90.5 % |
| customers | 77.5 % | 55.2 % |
| suppliers | 88.5 % | 62.3 % |
| accounts/transactions | 93.5 % | 87.7 % |
| workers | 81.9 % | 76.5 % |
| middleware | 95.8 % | 77.4 % |
| tenancy | 98.4 % | 84.1 % |
| settings | 95.5 % | 80.1 % |
| catalogue CRUD | 84.7 % | 64.0 % |
| **all of src** | **82.8 %** | **64.6 %** (statements 81.5 %, functions 83.2 %) |

Not reached: the brief's 75 % global branch target and 90 % on every
high-risk module (customers, product/variant, orders, sales returns are
below). Least covered (lines): wishList 30 %, byReturnSale 31 %,
outletinformation 34 %, PathaoCourier 38 %, sizeChart 49 %,
siteinformation 49 %, employee 51 %, banner/discountBanner 55 %.

### Mutation testing (Stryker, Jest runner)

`saleProfit.util.js` 95.7 %, `cache.util.js` 91.5 %, `saleCost.util.js`
85.4 %, `publicProduct.js` 83.3 %, `checkPermission.middleware.js` 82.5 %,
`parseFormData.util.js` 70.5 % — **overall 90.2 %** (612 mutants: 462 killed,
90 timed out, 53 survived, 7 no coverage). Accepted survivors: in
`saleProfit.util.js` the `$project` stages inside the `$lookup`s (removing them
only fetches more fields), in `cache.util.js` log/message string literals,
in `checkPermission` optional-chaining variants that are equivalent for the
populated user documents the middleware receives; `parseFormData.util.js`
survivors are regex/edge variants of the very code BUG-065 says must be
rewritten.

### Not tested, and why

- Real third-party services (SMS gateway, SMTP, Cloudinary, SSLCommerz,
  Pathao, Steadfast): mocked with nock / a nodemailer stub by design.
- Socket.IO beyond the existing `chatIsolation`/`tenantSocket` tests.
- Seeders, `src/scripts/createTenant.js`, the migration CLI (`migrations.test.js` covers the runner).
- Load/performance/security scanning: out of Phase 1 scope.
- Testcontainers: Docker is not available; Mongo uses mongodb-memory-server,
  Redis a real `redis-server` binary (CI: Redis service container).
