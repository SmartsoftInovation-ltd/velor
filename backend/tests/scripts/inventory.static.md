## Middleware

| Middleware | File | What it does |
|---|---|---|
| `helmet`, `cors`, `cookie-parser`, `morgan` | `src/app.js` | security headers, CORS from `cors.config.js`, cookies, request log |
| global `rateLimit` | `src/app.js` | `RATE_LIMIT_MAX` (default 1000) per IP per 15 min; `/healthz` sits before it |
| `resolveRequestTenant` | `middleware/requestTenant.middleware.js` | opens the tenant context from `x-tenant-host` (only with `TRUST_TENANT_HOST_HEADER=true`, active domains only) or `x-tenant` slug; 404 unknown, 403 suspended |
| `workspaceTenant` | same | sign-in flows: tenant from `body.workspace`; unknown → "Invalid credentials"; mismatch with header → 400 |
| `authGuard` | `middleware/authMiddleware.js` | verifies the staff JWT (`aud` staff), tenant active, request tenant = token tenant, `tokenVersion`, user active/not blocked; continues inside the tenant |
| `optionalAuth` | same | identifies a caller if a valid token is present (any audience), else anonymous |
| `shopperGuard` | same | storefront session (`aud` shopper) only |
| `guestOrAuth` | `middleware/guestOrAuth.js` | token, or `x-guest-id` with a named store |
| `authorize(module, action)` / `authorizeAny(...)` | `middleware/checkPermission.middleware.js` | role ∪ direct grants; owner bypass within own tenant |
| `platformGuard`, `requirePlatformRole` | `middleware/platformGuard.middleware.js` | platform operator JWT, runs in platform scope |
| `validate(schema)` / `validateBody` / `validateQuery` | `middleware/validate.js`, `validation/platform/validateBody.js` | Joi validation, body replaced with the validated value |
| upload wrappers | `middleware/multer.middleware.js` | disk storage in `public/temp`, image types only, 10 MB; `guardUploads` refuses (422) when the tenant has no Cloudinary |
| limiters | `middleware/rateLimit.middleware.js` | login (10 failed / 15 min per IP+workspace+account), password reset (5/h), reset submit, register (10/h/IP), change password, platform login/OTP, reports (60/min/user), domain verify |
| `legacyRoute` | `middleware/legacyRoute.middleware.js` | 410 for single-tenant payment callbacks in strict mode |
| `resolveWebhookTenant` | `middleware/webhookTenant.middleware.js` | tenant from `:webhookKey`; 404 unknown/cancelled |
| `globalErrorHandeler` | `lib/GlobalErrorHandeler.js` | maps customError, JWT errors, duplicate key, CastError, Mongoose ValidationError, TenancyError; concise shape outside development |

## BullMQ queues and workers

Prefix `bull-<NODE_ENV>` (`queues/prefix.js`); every job is stamped with the
enqueuing tenant (`tenancy/queue.js` `tenantAwareQueue`) and run inside it
(`tenantJob`, refuses a job without tenant in strict mode).

| Queue | Producer(s) | Worker | Payload | Retry | Side effects |
|---|---|---|---|---|---|
| `audit-log` | `service/audit.service.js` `logAudit` (login, stock adjust, product/coupon/order/user changes) | `workers/audit.worker.js`, concurrency 25 | `{ user, action, entity, meta, before/after/changes, createdAt, tenantId }` | 3, exponential 1 s, keep 500 done / 5000 failed | native insert into `auditlogs` |
| `due-sms` | sales (`send-sales-sms`, jobId `sales-sms-<saleId>`), due SMS bulk (`send-due-sms-bulk`, jobId = log id), bulk campaigns | `workers/sms.worker.js`, concurrency 2 | `{ logId, message, recipients: [{ phone, index }] }` | 3, exponential 3 s | per-recipient send through the tenant's SMS gateway, `SmsLog` status/counts, socket `sms:bulk:done` |
| `email` | sales invoice (`send-sales-invoice`, jobId `sales-email-<saleId>`) | `workers/email.worker.js`, concurrency 3 | `{ to, subject, html }` | 3, exponential 3 s | SMTP send with the tenant's settings |
| `image-upload` | category/brand/product/variant/customer/user/banner/site/store/employee create & update, `delete-cloudinary-image` | `workers/image.worker.js`, concurrency 3 | `{ modelName, documentId, localPath, fieldName, index, oldPublicId, oldCloudName }` or `{ publicId, cloudName }` | 5, exponential 2 s | Cloudinary upload/delete with the tenant's account, image sub-document status, temp file cleanup, cache bump |

No repeatable BullMQ jobs exist.

## Cron

| Job | File | Schedule | Effect |
|---|---|---|---|
| Temp upload cleanup | `jobs/cleanTempFiles.job.js` | `0 18 * * *` Asia/Dhaka (started by `index.js`) | deletes everything in `public/temp` except `.gitkeep` |

## Redis usage

- **Cache** (`utils/cache.util.js`): keys `t:<tenantId>:<ns>:v<version>:<suffix>`, platform `p:<key>`; JSON values with TTL (default 60 s; modules use 5 min–1 h); namespace versions `t:<tenantId>:<ns>:v` (no TTL, bumped on writes, dashboard bumped with its source namespaces).
- **BullMQ** connection (`config/redis.config.js` `connection`, `maxRetriesPerRequest: null`).
- **Pub/sub**: `tenant-settings:invalidate` (settings cache invalidation across processes, `settings/settings.service.js`).
- **Not in Redis**: sessions (refresh token stored on the user document), rate-limit counters (in-memory `MemoryStore`), tenant resolver cache and settings cache (in-process maps), platform OTP challenges.
- No locks.

## External integrations (all per tenant, from Store Settings)

| Integration | Code | Mocked in tests with |
|---|---|---|
| SMS (BulkSMSBD-style HTTP) | `helpers/sms.js` | nock |
| SMTP email | `helpers/nodemailer.js` | `nodemailer.createTransport` spy (SMTP is not HTTP) |
| Cloudinary | `helpers/cloudinary.js` | nock (`api.cloudinary.com`) |
| SSLCommerz | `integrations/sslcommerz.js` (`sslcommerz-lts` → node-fetch) | nock (`sandbox.sslcommerz.com`) |
| Pathao | `service/couriers/PathaoCourier.js`, `courierCityZone.js` | nock |
| Steadfast | `service/couriers/steadFast/SteadFastCourier.js` | nock |
| DNS (domain verification) | `service/domainVerification.service.js` | existing tests stub the resolver |

## Risk ranking

| Risk | Modules | Why |
|---|---|---|
| High | auth/users, tenancy | every tenant boundary and every permission decision |
| High | sales, sales returns | money in, stock out, customer dues, profit |
| High | purchases, purchase returns, stock adjust | stock levels and supplier dues |
| High | orders, storefront checkout, cart, coupons, payments | public internet surface, money, coupon abuse |
| High | product / variant | public catalogue (cost-price leakage), pricing, stock fields |
| High | reports, dashboard, profit util | business decisions are taken on these figures |
| High | customers & payments, suppliers & payments | receivables and payables |
| Medium | accounts, transactions, money transfer, fund handover | ledger consistency |
| Medium | workers (image, SMS, email, audit) | retries, idempotency, tenant context in background jobs |
| Medium | settings, integrations, couriers | third-party credentials and callbacks |
| Low | categories, brands, banners, size charts, site/store/outlet info, delivery charges, order sources, chat | catalogue/content CRUD |
