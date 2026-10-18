# Testing the backend

Phase 1 suite: functional, integration, worker and contract tests. Jest, real
MongoDB (in-memory replica set) and real Redis (a private `redis-server`). No
Docker needed, no mocks of Mongoose or Redis, no network.

## Running

```bash
npm test                    # everything (~3 min, 4 workers)
npm run test:unit           # tests/unit + tests/middleware
npm run test:integration    # tests/integration (HTTP through the real app)
npm run test:worker         # tests/worker (BullMQ processors on real Redis)
npm run test:contract       # route matrix, envelope consistency, OpenAPI sync
npm run test:coverage       # with coverage gates (jest.config.js)
npm run test:watch
npm run test:mutation       # Stryker on the high-risk shared modules
npm run test:bugs           # every known-bug test run as a normal test (see below)
npm run test:inventory      # regenerate tests/TEST_INVENTORY.md and docs/openapi.yaml
```

Requirements: Node 22, and either a `redis-server` binary on the PATH
(`apt install redis-server` / `brew install redis`) or `REDIS_TEST_URL`
pointing at a disposable Redis (CI uses a service container). The
MongoDB binary is downloaded once by mongodb-memory-server.

### What runs where

- `tests/globalSetup.js` starts a single-node Mongo replica set (transactions
  work) and a private `redis-server` on a free port (`tests/setup/redisServer.js`),
  unless `REDIS_TEST_URL` is set. It never touches a Redis on 6379.
- `tests/setupEnv.js` loads dummy values from `tests/setup/test.env` (no real
  secret anywhere; `dotenv` is mapped to a no-op so `backend/.env` is never
  read) and gives each Jest worker its own Redis database index
  (`REDIS_URL=<test redis>/<JEST_WORKER_ID>`), so `FLUSHDB` is safe in parallel.
- Each test file gets its own Mongo database (`tests/helpers/db.js`).
- Every external HTTP call is mocked with **nock** (SMS gateway, Cloudinary,
  SSLCommerz, Pathao, Steadfast); files that call out set
  `nock.disableNetConnect()` so an unmocked call fails the test. SMTP is not
  HTTP: the nodemailer transport is replaced with a capturing stub.

## Writing a test

### Integration test against the real app

```js
const { useIntegrationApp } = require("../setup/integration");
const { api } = require("../helpers/api");
const { createUserIn, tokenFor } = require("../helpers/auth");
const { tenantFactory, forTenant } = require("../factories");
const { runForTenant } = require("../../src/tenancy/context");

describe("my module", () => {
  const ctx = useIntegrationApp();            // app + clean DB/Redis per test, strict tenancy
  let tenant, owner;
  beforeEach(async () => {
    tenant = await tenantFactory.create({ slug: "myshop" });
    owner = await createUserIn(tenant, { owner: true });
  });

  it("does the thing", async () => {
    const product = await forTenant(tenant).product.create({ stock: 5 });
    const res = await api(ctx.server, { token: tokenFor(owner), tenant: "myshop" })
      .get("/product/getproduct").expect(200);
    // assert the database too, never only the response
    const stored = await runForTenant(tenant._id, () => Product.findById(product._id).lean());
  });
});
```

`useIntegrationApp({ strict, quiet, clearAfterEach })` — strict tenancy by
default (what production runs), console noise silenced, every collection
emptied after each test (pass `clearAfterEach: false` for read-only
matrices seeded in `beforeAll`). The server listens once up front so
parallel requests (concurrency tests) are safe.

### Helpers

| Helper | Use |
|---|---|
| `tests/helpers/api.js` | `api(server, { token, tenant, headers })` → supertest client prefixed with `/api/v1`; `expectSuccessEnvelope`, `expectErrorEnvelope` |
| `tests/helpers/auth.js` | `createUserIn(tenant, { owner, shopper, grants: { "retail-sales": ["add"] }, raw })`, `sessionFor`, `tokenFor(user)`, `expiredTokenFor`, `wrongSignatureTokenFor`, `refreshSecretTokenFor`, `unsignedTokenFor` (alg none), `MALFORMED_TOKENS` |
| `tests/helpers/redis.js` | `testRedis()` client on this worker's database, `flushRedis`, `tenantKeys`, `closeAppRedis` |
| `tests/helpers/wait.js` | `waitForJob(queue, jobId)` (resolves on completed/failed), `eventually(fn)` polling — never `sleep` |
| `tests/helpers/uploads.js` | `PNG` buffer, `enableCloudinary(tenant)`, `tempUploadTracker()` (removes only the files a test uploaded) |
| `tests/helpers/workerEnv.js` | `useWorkerEnv()` for BullMQ processor tests; `env.track(worker)` closes it after the test |
| `tests/helpers/routeInventory.js` | the route list parsed from `src/routes` (drives the matrix, the inventory and the OpenAPI file) |

### Factories (`tests/factories/index.js`, fishery + faker, seeded)

`tenantFactory`, and per tenant (`forTenant(tenant).<name>.create(params)`):
`category`, `brand`, `product`, `variant`, `account`, `employee`, `customer`,
`supplier`, `coupon`, `discount`. Traits: `tenantFactory.suspended()`,
`productFactory.outOfStock()`, `.costing(price)`,
`couponFactory.expired()`, `.notStarted()`, `.fixed(amount)`,
`.limited(usageLimit, usedCount)` — reach traits through
`forTenant(t).coupon.factory.limited(1).create(...)`. Documents go through
Mongoose, so validation, hooks and the tenant plugin all run.

### Worker tests

```js
const env = useWorkerEnv();
env.track(startSmsWorker());                       // real Worker on the test Redis
const job = await runForTenant(tenantId, () => smsQueue.add("x", data));
const { state, job: done } = await waitForJob(smsQueue, job.id);
```

Processors are also exported for direct calls (`processSmsJob(job)`), used
for idempotency checks.

### Known bugs: `test.failing`

A test that reproduces a confirmed bug stays in the suite as
`test.failing("… [BUG-0xx]")` and is documented in `BUGS_FOUND.md`. It passes
while the bug exists; when the bug is fixed Jest reports it, and the marker
must be removed. Matrix cases are listed in `tests/contract/knownFailures.js`.
`npm run test:bugs` (`BUG_AUDIT=1`) runs them as normal tests so each failure
reason can be checked — every one was audited to fail on the assertion that
describes its bug, not on setup.

## Suite layout

| Path | Contents |
|---|---|
| `tests/contract/routeMatrix.test.js` | every one of the 487 routes: 12 invalid-session cases → 401 (staff), shopper/platform session separation, 403 without the permission, the named permission opens it, malformed/unknown ids and empty bodies never 500, strict tenancy (no store → clean 4xx, unknown store → 404) |
| `tests/contract/envelope.test.js` | every route's answer matches the success or error envelope |
| `tests/contract/openapi.test.js` | `docs/openapi.yaml` documents exactly the routes in the code |
| `tests/integration/*.routes.test.js` | per route group: happy path with DB state, validation, mass assignment, IDOR/tenant isolation, not found, lists/pagination/search, cache and queue side effects, concurrency, state transitions, leakage |
| `tests/integration/profitRules.test.js` | the profit formula against an independent oracle over random invoices |
| `tests/integration/reports.smoke.test.js` | all 104 report/dashboard/invoice routes × 4 body shapes on seeded data, with a second store's data never appearing |
| `tests/worker/*.worker.test.js` | the four BullMQ processors: success, invalid payload, upstream failure + retries, idempotency, two workers, delayed jobs, graceful close |
| `tests/middleware/*.test.js` | error handler mapping, permissions, validate, tenant resolution, guest/auth, rate limiters |
| `tests/unit/*.test.js` | utils: form parsing, public projection, refund maths, cache, cost stamping |
| (existing) | the 65 files that existed before Phase 1 are unchanged except as listed below |

## Testability changes (application code)

Only these changes were made to `src/`; no business logic changed.

1. `src/workers/{audit,email,image,sms}.worker.js` — the bootstrap
   (`dbConnect()` → start worker → `onShutdown`) now runs only
   `if (require.main === module)`, i.e. when the file is started as a process
   (`npm run worker:*`), exactly as before. The job processor is a named
   function (`processAuditJob`, `processEmailJob`, `processImageJob`,
   `processSmsJob`), `start*Worker(options)` accepts optional Worker options
   (e.g. concurrency) merged over the defaults, and both are exported.

Test-side changes outside `tests/` new files:

- `jest.config.js`: `setupFilesAfterEnv` (bug-audit switch), coverage
  collection and thresholds.
- `tests/globalSetup.js` / `globalTeardown.js` / `setupEnv.js`: private Redis,
  test env file, per-worker Redis database. Existing tests previously used
  whatever Redis ran on `localhost:6379` (a developer's own instance).
- `tests/integration/{publicCatalog,posOrder,publicCheckout}.test.js`:
  `cache.flushall()` → `cache.flushdb()`. `FLUSHALL` wiped every Redis
  database — with per-worker databases it erased other files' state mid-test
  (and before Phase 1 it wiped the developer's local Redis).
- `tests/integration/chatIsolation.test.js`: socket event wait 700 ms → 2 s;
  it failed at random under coverage with 4 workers (a delivered message
  arrived after the window). The "must not arrive" checks wait longer, so
  they are stricter, not weaker.
- `package.json`: dev dependencies `@faker-js/faker`, `fishery`, `nock`,
  `@stryker-mutator/core`, `@stryker-mutator/jest-runner`, `@babel/parser`,
  `js-yaml`; scripts above. `.gitignore`: coverage/report folders.
- New: `stryker.config.js`, `stryker.jest.config.js`,
  `.github/workflows/test.yml`, `docs/openapi.yaml`.

`.env.test`: the root `.gitignore` ignores `.env*`, so the dummy test
environment lives in `tests/setup/test.env` instead (committable, no real
values).

## Coverage

See the final section of `tests/TEST_PROGRESS.md` for the per-module table.
Global gates in `jest.config.js`: lines/statements/functions 80 %, branches
62 %; 90–100 % on the high-risk shared modules (profit, cost stamping, cache,
permissions, auth, tenancy, error handler, sales/user/purchase controllers).
The brief's 75 % branch target is not met: the remaining branches sit mostly
in `report.controller.js` (10 000 lines of optional filters), low-risk content
CRUD (banners, site/store/outlet information, size charts, wishlist,
"by-return" sales) and courier integrations.

## Mutation testing

`npm run test:mutation` mutates `saleProfit.util.js`, `saleCost.util.js`,
`cache.util.js`, `checkPermission.middleware.js`, `parseFormData.util.js` and
`publicProduct.js`, running only the test files that exercise them
(`stryker.jest.config.js`). Break threshold 60 %. Report:
`reports/mutation/mutation.html`; summary in `tests/TEST_PROGRESS.md`.

## CI

`.github/workflows/test.yml`: Node 22, Redis service container
(`REDIS_TEST_URL`), checks `docs/openapi.yaml` is regenerated, runs the suite
with coverage gates; Stryker on pull requests.
