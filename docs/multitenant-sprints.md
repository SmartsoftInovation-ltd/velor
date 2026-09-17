# Multi-Tenant Build — Sprint Plan (TDD)

> Source of truth for *what* to build: [`dashboard-backend-multitenant-architecture.md`](./dashboard-backend-multitenant-architecture.md).
> This file says *in what order*, and how each sprint is proven done.
> Branch: `developement`. Scope: backend + dashboard. Storefront is a later sprint series.

## Working agreement

- **Test-driven:** every behavior change starts with a failing test (red), then minimal code (green), then cleanup (refactor).
- Backend tests: Jest 29 + supertest + `mongodb-memory-server` (single-node **replica set**, so transactions work). Run with `npm test` inside `backend/`.
- A sprint is **done** when its tests pass and the "Done when" checks below hold. No sprint may break existing behavior for Velor.
- Every sprint ends reviewable: one PR (or a small set of commits) per sprint.
- Dashboard has no test runner yet; Sprint 10 adds Vitest + Testing Library before dashboard changes.

## Sprint overview

| Sprint | Name | Architecture doc refs | Status |
|---|---|---|---|
| 1 | Safety net & security fixes | §9 S1–S4, §10 steps 1–2 | **done** (manual secret rotation pending) |
| 2 | Tenancy core (context + plugin, shadow mode) | §2, §10 step 3 | **done** |
| 3 | Platform identity & tenant API | §3.1, §8.2 (API only), §10 step 4 | **done** |
| 4 | Tenant settings core (encryption, service, platform endpoints) | §5.2–5.6, §10 step 5 | **done** |
| 5 | Integrations read settings (prefix, SMS, email, SSLCommerz, couriers, Cloudinary, Groq, webhooks) | §5.1, §5.6–5.9, §10 step 6 | todo |
| 6 | Data migration for Velor (backfill, indexes, counters, env import) | §11, §10 step 7 | todo |
| 7 | Tenant-aware auth (workspace login, token claims, getme) | §3.2–3.4, §10 step 8 | todo |
| 8 | Per-tenant RBAC (owner, escalation guard, staff limit) | §4, §10 step 9 | todo |
| 9 | Cross-cutting (cache, queues, sockets, audit, vector search) | §6, §10 step 10 | todo |
| 10 | Dashboard multi-tenant | §7, §10 step 11 | todo |
| 11 | Provisioning, isolation suite, fail-closed | §8.2, §12, §10 steps 12–13 | todo |
| 12 | Platform console UI | §8.3, §10 step 14 | todo |

---

## Sprint 1 — Safety net & security fixes

**Goal:** a test harness exists, and the secrets committed in source are gone from the code.

| # | Story | Tests first |
|---|---|---|
| 1.1 | Jest + supertest + in-memory replica set harness; `npm test`, `npm run test:watch` | Smoke test: connects, writes and reads in a transaction |
| 1.2 | **S1** Mail helper reads `HOST_MAIL` / `HOST_APP_PASSWORD` / `MAIL_FROM_NAME` from env; no hardcoded Gmail credentials; `user.controller` reuses the helper | Transport built from env; send refuses (no crash) when env missing |
| 1.3 | **S2** Pathao webhook: no hardcoded fallback secret; invalid/missing secret → 401 (was 500) | Missing env → 401; wrong signature → 401; correct → 202 + echo header |
| 1.4 | **S3** Dashboard courier form no longer reads `VITE_*_WEBHOOK_SECRET` | (manual check — no dashboard test runner until Sprint 10) |
| 1.5 | **S4** Superadmin seeder takes credentials from env, enforces minimum password length, is idempotent (no delete-and-recreate), and is importable without side effects; fix broken `superAdmin` npm script path | Missing env → refuses; weak password → refuses; existing user → skip; creates with roles + permissions |
| 1.6 | `autoIndex` off in production | `dbConnect` passes `autoIndex: false` when `NODE_ENV=production` |

**Done when:** `npm test` green; `grep` finds no Gmail password, no Pathao fallback secret, no `VITE_*_WEBHOOK_SECRET`, no hardcoded seeder password in source.

**Manual follow-up (owner action, cannot be done in code):** revoke the Gmail app password that was committed in `helpers/nodemailer.js`; rotate Pathao and courier webhook secrets; change the production superadmin password if it was seeded with `Sadmin@123`.

## Sprint 2 — Tenancy core (shadow mode)

**Goal:** tenant context and the Mongoose tenant plugin exist and are proven by tests; every model carries an optional `tenantId`; app behavior for Velor is unchanged.

| # | Story | Tests first |
|---|---|---|
| 2.1 | `tenancy/context.js`: `runForTenant`, `runAsPlatform`, `getTenantId`, `isPlatform` on AsyncLocalStorage | Outside scope → none; inside → id; survives `await`/timers; nested scopes restore; invalid id rejected |
| 2.2 | `tenancy/tenantPlugin.js` — reads | find / findOne / findById / countDocuments / distinct / exists / populate are scoped |
| 2.3 | Plugin — writes | create/save stamp; foreign `tenantId` in payload rejected; save of another tenant's doc rejected; updateOne/updateMany/findOneAndUpdate/deleteOne/deleteMany scoped; upsert stamps; insertMany stamps; bulkWrite scoped |
| 2.4 | Plugin — aggregate | `$match` prepended; stays after `$vectorSearch`/`$geoNear`/`$search`; `$vectorSearch.filter` gets `tenantId` |
| 2.5 | Plugin — modes | `shadow`: no context → unscoped + one warning per model/op; `strict`: no context → throws; `runAsPlatform` → unscoped in both; `estimatedDocumentCount` throws in strict |
| 2.6 | `Tenant` model | slug format, reserved slugs, unique slug, generated unique `webhookKey`, status enum |
| 2.7 | `tenancy/registry.js` + plugin applied to every tenant-scoped model | Registry test: every model is either tenant-scoped (has plugin + `tenantId` path) or explicitly global (`Permission`, `Tenant`) |

**Done when:** tests green; app boots; with no tenant context the app behaves exactly as today (shadow mode default `TENANCY_MODE=shadow`).

**Implementation notes (as built):**
- `runForTenant` / `runAsPlatform` execute a returned Mongoose Query/Aggregate inside the scope (queries are lazy; returned un-awaited they would otherwise run unscoped).
- A `tenantId` already present in a filter is ANDed with the context tenant, so it can only narrow the result.
- Shadow-mode warnings are opt-in with `TENANCY_LOG_UNSCOPED=true` (until Sprint 7 opens a context per request, every query would warn).
- `tenantId` is `immutable`; the Sprint 6 backfill must write it with raw collection updates under `runAsPlatform`.
- Out of scope for the plugin: `Model.collection.*` driver calls, `$unionWith` / `$lookup` sub-pipelines on other collections (all current joins are by ObjectId).

## Sprint 3 — Platform identity & tenant API

| # | Story |
|---|---|
| 3.1 | `PlatformUser` model (bcrypt, `tokenVersion`, TOTP-ready fields) |
| 3.2 | `POST /api/v1/platform/auth/login|refresh|logout`, separate secret `PLATFORM_ACCESS_TOKEN_SECRET`, `aud: platform` |
| 3.3 | `platformGuard`; staff tokens rejected on platform routes and vice versa |
| 3.4 | `POST/GET/PATCH /platform/tenants`, suspend/activate; `PlatformAuditLog` |
| 3.5 | `seed:platform-admin` script (env/CLI credentials) |
| 3.6 | Create the `velor` tenant record (no data backfill yet) |

**Done when:** platform admin can log in and create/list/suspend tenants via API; tenant tokens cannot reach platform routes.

**Implementation notes (as built):**
- Platform roles: `superadmin` (full control) and `support` (read-only: list/get tenants).
- Access token 1h (`aud: platform`), refresh token 7d in httpOnly cookie `platformRefreshToken` scoped to `/api/v1/platform/auth` (`aud: platform-refresh`). Separate secrets, validated at request time (min 32 chars, must differ from staff secrets) — misconfiguration fails closed with 500.
- Logout bumps `tokenVersion`, revoking every platform session of that operator (all devices).
- New tenants start in `provisioning`; `POST /:id/activate` makes them `active`. Full provisioning (owner, roles, settings) is Sprint 11.
- Suspending a tenant does not yet sign out its staff — that needs tenant-aware tokens (Sprint 7).
- `twoFactorEnabled` / `twoFactorSecret` fields exist; TOTP verification is not implemented yet.
- `PlatformUser` and `PlatformAuditLog` are global models (registry).

**API quick reference** (base `/api/v1/platform`):

| Method | Path | Role | Body / query |
|---|---|---|---|
| POST | `/auth/login` | — | `{ email, password }` → `data.accessToken` + refresh cookie |
| POST | `/auth/refresh` | cookie | → `data.accessToken` |
| POST | `/auth/logout` | cookie | revokes all sessions |
| GET | `/auth/me` | any | current operator |
| GET | `/tenants` | any | `?status=&search=&page=1&limit=20` |
| GET | `/tenants/:tenantId` | any | |
| POST | `/tenants` | superadmin | `{ name, slug, plan?, limits?: { maxStaff } }` |
| PATCH | `/tenants/:tenantId` | superadmin | `{ name?, plan?, limits? }` (slug/status not editable) |
| POST | `/tenants/:tenantId/suspend` | superadmin | `{ reason? }` |
| POST | `/tenants/:tenantId/activate` | superadmin | `{ reason? }` |

**First-time setup on the server:**
1. Set `PLATFORM_ACCESS_TOKEN_SECRET`, `PLATFORM_REFRESH_TOKEN_SECRET` (e.g. `openssl rand -base64 48`), `PLATFORM_URL`.
2. `PLATFORM_ADMIN_EMAIL=... PLATFORM_ADMIN_PASSWORD=... npm run seed:platform-admin`
3. `npm run tenant:create -- --name Velor --slug velor --status active`

## Sprint 4 — Tenant settings core

| # | Story |
|---|---|
| 4.1 | `settings/crypto.js` AES-256-GCM, key ring, `last4`, rotation helper |
| 4.2 | `TenantSettings` model with sections: general, sms, email, payment.sslcommerz, couriers.*, cloudinary, ai.groq |
| 4.3 | Joi schemas per section + owner-editable policy table |
| 4.4 | `settings.service`: decrypted LRU (60 s) + Redis pub/sub invalidation |
| 4.5 | Platform endpoints `GET /settings`, `PATCH /settings/:section` (omit = keep, `null` = clear), masked responses, audit field names only |
| 4.6 | Tenant endpoints `GET /settings`, `PATCH /settings/general` (owner fields), `GET /settings/webhooks` |

**Done when:** secrets never appear in responses/logs/audit; PATCH semantics tested; invalidation reaches a second process in a test.

**Implementation notes (as built):**
- One definition file (`src/settings/definitions.js`) drives validation, storage, masking, features and owner-editable fields. Sections: `general`, `sms`, `email` (flat `smtpHost`/`smtpPort`/`smtpSecure`/`smtpUser`/`smtpPassword`), `sslcommerz`, `pathao`, `steadfast` (`apiKey` is also a secret), `cloudinary`, `groq`.
- Platform: `GET /platform/tenants/:id/settings` (masked + features + version), `PATCH /platform/tenants/:id/settings/{general|sms|email|payment/sslcommerz|couriers/pathao|couriers/steadfast|cloudinary|ai/groq}` (superadmin), `GET /platform/tenants/:id/settings/webhooks`.
- Tenant: `GET /api/v1/settings`, `PATCH /api/v1/settings/general` (only `orderHotline`, `facebookUrl`), `GET /api/v1/settings/webhooks` — permission `store-settings`. They return `400 TENANT_CONTEXT_REQUIRED` until Sprint 7 opens a tenant context per request.
- Errors can carry a machine-readable `code` (e.g. `SMS_NOT_CONFIGURED`), returned in the JSON body.
- Cache holds raw (encrypted) documents for 60 s; `startSettingsInvalidationListener()` runs in the API process (workers added in Sprint 5).
- `test` endpoints per section are part of Sprint 5.

## Sprint 5 — Integrations read settings

| # | Story |
|---|---|
| 5.1 | Serial generators (15 sites) use `general.invoicePrefix` |
| 5.2 | SMS client + balance from settings; `SMS_NOT_CONFIGURED` |
| 5.3 | Mailer from settings (`platform` / `smtp` / `disabled`); email links from settings |
| 5.4 | SSLCommerz from settings; per-tenant callback/IPN routes `/hooks/sslcommerz/:webhookKey/*` |
| 5.5 | Couriers from settings; `/hooks/pathao/:webhookKey`, `/hooks/steadfast/:webhookKey`; Pathao token in Redis per tenant |
| 5.6 | Cloudinary per-call credentials; `cloudName` on image schema; `CLOUDINARY_NOT_CONFIGURED` checked before save |
| 5.7 | Groq from settings; `AI_NOT_CONFIGURED` |
| 5.8 | `POST /platform/tenants/:id/settings/:section/test` for every section |
| 5.9 | Order hotline and Facebook URL from settings |

**Done when:** grep finds none of the per-seller env vars in `src/`; two tenants with different settings produce different outbound calls in tests (HTTP mocked).

## Sprint 6 — Velor data migration

| # | Story |
|---|---|
| 6.1 | Migrations runner (`migrations` collection, up + verify) |
| 6.2 | Env → Velor `TenantSettings` import (incl. `Merchant` docs, Cloudinary, Groq) |
| 6.3 | Batched idempotent `tenantId` backfill for all tenant-scoped collections + verification counts |
| 6.4 | Counters keyed `{tenantId, key}` preserving `seq` |
| 6.5 | Compound unique indexes built (old global ones kept for now); `User.phone` partial index |
| 6.6 | `cloudName` backfill on image fields |

**Done when:** migration runs twice with the same result on a copy of production data; counts/totals match pre-migration snapshot.

## Sprint 7 — Tenant-aware auth

| # | Story |
|---|---|
| 7.1 | Login with `workspace`; shoppers cannot log into dashboard |
| 7.2 | Token claims `sub`, `tid`, `aud`, `tv`; `authGuard` loads by `sub` + `tid`; `tokenVersion` checks |
| 7.3 | Refresh re-checks tenant status; `TENANT_SUSPENDED` code |
| 7.4 | Legacy tokens without `tid` accepted for 15 days |
| 7.5 | Request pipeline opens tenant context (`runForTenant`) for staff routes |
| 7.6 | `getme` returns `user`, `tenant`, effective `permissions`, `features` |
| 7.7 | Cookie `sameSite: lax`, path-scoped |

## Sprint 8 — Per-tenant RBAC

| # | Story |
|---|---|
| 8.1 | Reserved `owner` role replaces `superadmin` bypass (tenant-bound) |
| 8.2 | Roles unique per tenant; default role template |
| 8.3 | Escalation guard for role/permission assignment |
| 8.4 | Staff limit; deactivate bumps `tokenVersion` |
| 8.5 | Permission CRUD moved to platform routes; retire `UserPermission` |

## Sprint 9 — Cross-cutting subsystems

| # | Story |
|---|---|
| 9.1 | Cache keys prefixed per tenant |
| 9.2 | BullMQ jobs carry `tenantId`; workers run in `runForTenant` |
| 9.3 | Audit worker writes through the model |
| 9.4 | Socket.io handshake auth + tenant rooms; remove global `io.emit` |
| 9.5 | Vector search `tenantId` filter; per-tenant auth rate-limit keys |

## Sprint 10 — Dashboard

| # | Story |
|---|---|
| 10.1 | Vitest + Testing Library setup |
| 10.2 | `SessionContext` (user, tenant, permissions, features, isOwner) replacing `AuthContext` internals |
| 10.3 | Sign-in with workspace (remembered, `?workspace=` deep link) |
| 10.4 | `FeatureGate` / `useFeature`; image uploads and SMS/courier/payment gated |
| 10.5 | Store Settings page (general, integrations status, webhook URLs) |
| 10.6 | Role/user screens: hide owner, disable permissions not held, staff limit |
| 10.7 | Query cache + tenant-namespaced drafts cleared per session; suspended page |
| 10.8 | Socket client with `VITE_SOCKET_URL` + token auth |

## Sprint 11 — Provisioning & isolation

| # | Story |
|---|---|
| 11.1 | `POST /platform/tenants` full provisioning (owner, roles, settings, store info) in one transaction |
| 11.2 | Isolation test suite: two tenants with identical names/SKUs/emails across all route families |
| 11.3 | Flip `TENANCY_MODE=strict`; make `tenantId` required; drop old global unique indexes; remove legacy tokens/routes |

## Sprint 12 — Platform console UI

Tenants list, create wizard (Cloudinary required step), tenant detail tabs (overview, settings with test buttons, webhooks, staff, audit), permissions catalog, platform users.
