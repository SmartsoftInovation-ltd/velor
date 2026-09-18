# Multi-Tenant Implementation Report

> **Removed (2026-09-17):** the RAG chat / vector search feature described in
> this document no longer exists. `utils/retrieve.js`, `utils/embedding.js`,
> `utils/llm.js`, `chat.controller.js`, the `/chat` route, the embedding queue
> and worker, `scripts/backfill.js`, `scripts/atlasVectorIndex.json`, the
> `embedding` field on Product/Variant, and the dashboard ChatBox were all
> deleted; the Atlas `vector_index` was never created. Sections below that
> describe vector search, embeddings or the chat widget are kept as a record of
> the original design and no longer reflect the codebase.



> Project: **Velor / ECOMPOS** — backend (Express + MongoDB), dashboard (React/Vite) with a built-in **Platform Console** module
> Branch: `developement` · Date: 2026-09-17
> Related docs: [`multi-tenant-plan.md`](./multi-tenant-plan.md) (original plan) · [`dashboard-backend-multitenant-architecture.md`](./dashboard-backend-multitenant-architecture.md) (design) · [`multitenant-sprints.md`](./multitenant-sprints.md) (sprint log + cutover checklist)

---

## Table of Contents

1. [Summary](#1-summary)
2. [What was delivered (commits)](#2-what-was-delivered-commits)
3. [Architecture at a glance](#3-architecture-at-a-glance)
4. [Backend changes](#4-backend-changes)
5. [Model (database) changes](#5-model-database-changes)
6. [Dashboard changes](#6-dashboard-changes)
7. [Platform Console module (in the dashboard)](#7-platform-console-module-in-the-dashboard)
8. [How the whole workflow works now](#8-how-the-whole-workflow-works-now)
9. [Velor data migration (already run)](#9-velor-data-migration-already-run)
10. [API reference](#10-api-reference)
11. [Environment variables](#11-environment-variables)
12. [Tests](#12-tests)
13. [Going live checklist](#13-going-live-checklist)
14. [Known limits and not built](#14-known-limits-and-not-built)

---

## 1. Summary

**Short version (Banglish):** Ekhon ekta backend + ekta dashboard diye onek gulo store (tenant) chalano jay. Protita store er data `tenantId` diye alada, protita store er nijer owner, staff, role, SMS / email / SSLCommerz / courier / Cloudinary credential (encrypted, database e — `.env` e na). Platform owner (apni) dashboard er **Platform Console** module e jan — platform operator email + password diye login, tarpor SMS OTP verify — sekhane seller create / edit / suspend kore; seller owner **Settings → Store Settings** theke nijer integration connect kore. Velor er purono data already `velor` store e migrate kora hoyeche.

**What changed:**

| Area | Before | Now |
|---|---|---|
| Data | One business per database | Many stores; every business document carries `tenantId`; queries are filtered automatically |
| Login | Email + password | Workspace (store slug) + email + password; token bound to the store |
| Admin | One global `superadmin` | Per-store `owner` role; separate **platform operators** for you |
| Third-party keys | `.env` (one set for everyone) | Per-store encrypted settings, managed in the dashboard (Settings → Store Settings for sellers; Platform Console → Sellers for you) |
| Webhooks | One URL per provider | One URL per store per provider (`/hooks/<provider>/<webhookKey>`) |
| Cache / sockets / queues | Shared | Per store |
| Tests | None | Backend 310, dashboard 53 |

---

## 2. What was delivered (commits)

| Commit | Scope |
|---|---|
| `4020f36` Sprint 1 | Test harness (Jest, in-memory MongoDB replica set); removed hardcoded Gmail password, Pathao fallback secret, dashboard `VITE_*_WEBHOOK_SECRET`, seeder password; production `autoIndex` off |
| `c67b590` Sprint 2 | Tenant context (AsyncLocalStorage) + Mongoose tenant plugin on all 50 business models; `Tenant` model |
| `9e67a3a` Sprint 3 | Platform operators (`PlatformUser`), platform login, tenant API, platform audit log |
| `b43eae4` Sprint 4 | Encrypted per-store settings (AES-256-GCM), settings service with cache + Redis invalidation |
| `4e17945` Sprint 5 | SMS, email, SSLCommerz, couriers, Cloudinary, invoice prefix read store settings; per-store webhooks; per-tenant unique indexes; queue tenant propagation |
| `fd84628` Sprint 6 | Migration runner + scripts for existing single-store data |
| `262d113` Sprint 7 | Store-aware login, token claims, request tenant resolution, legacy tokens |
| `825445f` Sprint 8 | Owner role, escalation guards, staff limit, permission catalog to platform |
| `6a09f48` Sprint 9 | Per-store cache keys, socket rooms, vector index filter |
| `340846d` Sprint 10 | Dashboard multi-tenant (workspace sign-in, session, gates, Store Settings v1) |
| `1ea9b60` Sprint 11 | One-step store provisioning, `$lookup` scoping, strict-mode isolation suite |
| `05f5471` Sprint 12 | Platform console (first as a separate app) + backend endpoints it needs |
| `1cae118` | Docs status |
| `92d326f` | Sign-in redesign, CORS fix, Store Settings integrations page (owner self-service), webhook URL domain fallback |
| (next) | Platform Console moved **into the dashboard** as a sidebar module; standalone `platform-console/` app removed |
| (latest) | Console opens with a platform operator login (email + password) followed by an SMS OTP; Permission Catalog page removed; Store → **Seller** naming; ECOMPOS-style UI in green `#0F9D63` |

---

## 3. Architecture at a glance

```
                 ┌───────────────────────────────────────────────────────────┐
 Store staff ──► │ Dashboard (localhost:5173) — workspace sign-in            │
 You (platform)  │  Sidebar → Platform Console                               │
 ──────────────► │    • Sellers / Store Settings / Operators                 │
                 │      (owner of velor only; PlatformGate:                  │
                 │      operator login + SMS OTP → /platform/auth/*)         │
                 └───────────┬───────────────────────────────┬───────────────┘
                             │ Bearer store token {sub,tid,tv}│ Bearer platform token (aud: platform)
                             │ x-tenant: <workspace>          │
                             ▼                                ▼
 ┌───────────────────────────────────────────────────────────────────────────────────────┐
 │ Backend API  /api/v1                                                                   │
 │                                                                                        │
 │  /platform/*  → platformGuard → runAsPlatform (no tenant filter)                       │
 │  /hooks/*     → resolveWebhookTenant (:webhookKey) → runForTenant                      │
 │  everything else → resolveRequestTenant (x-tenant / DEFAULT_TENANT_SLUG)               │
 │                  → authGuard (token tid must match) → runForTenant                     │
 │                                                                                        │
 │  Controllers (mostly unchanged) → Mongoose → tenantPlugin adds { tenantId }            │
 │  Integrations → integrations/config.js → store's encrypted TenantSettings              │
 │  Cache keys t:<tenantId>:… · Socket rooms tenant:<id> · BullMQ jobs carry tenantId     │
 └───────────────────────────────────────────────────────────────────────────────────────┘
                             │
                MongoDB (one database, tenantId on every business document) · Redis
```

---

## 4. Backend changes

### 4.1 Tenancy core — `backend/src/tenancy/`

| File | What it does |
|---|---|
| `context.js` | `runForTenant(id, fn)`, `runAsPlatform(fn)`, `getTenantId()`, `isPlatform()` on AsyncLocalStorage. Survives `await`, timers, Mongoose hooks and transactions. A returned Mongoose query is executed inside the scope. |
| `tenantPlugin.js` | Applied to every business schema. Adds `tenantId` (indexed, immutable, required in strict mode) and scopes every operation (table below). |
| `registry.js` | Lists the only global models: `Permission`, `Tenant`, `PlatformUser`, `PlatformAuditLog`, `TenantSettings`. A test fails if any other model lacks the plugin. |
| `tenantResolver.js` | Cached tenant lookup by id/slug (30 s), `assertTenantActive` (→ `TENANT_SUSPENDED` / `TENANT_INACTIVE`). |
| `rbac.js` | Owner detection, effective permissions, escalation guards, staff limit. |
| `roleTemplate.js` | Default role per store: `owner` only; staff roles are created by the owner. |
| `provisioning.js` | Creates a ready store in one transaction (tenant → roles → owner user → active). |
| `queue.js` | `tenantAwareQueue` stamps `tenantId` on jobs; `tenantJob` runs workers inside that tenant. |

**Tenant plugin rules**

| Operation | Behaviour |
|---|---|
| `find`, `findOne`, `findById`, `countDocuments`, `distinct`, `exists`, `populate` | `tenantId` added to the filter (a `tenantId` in the filter can only narrow) |
| `updateOne/Many`, `findOneAndUpdate`, `deleteOne/Many`, `findOneAndDelete`, `replaceOne` | Scoped filter; upserts get `tenantId` |
| `create` / `save` | New documents stamped; saving another store's document is rejected |
| `insertMany`, `bulkWrite` | Every document / operation stamped or scoped |
| `aggregate` | `$match { tenantId }` first; `$vectorSearch.filter` / `$geoNear.query` extended; **`$lookup`, `$unionWith`, `$graphLookup`, `$facet` sub-pipelines scoped too** (fixed a real leak: supplier joins on mobile number) |
| `estimatedDocumentCount` | Refused inside a store |
| Unique indexes | Every unique index becomes `{ tenantId, field }`; sparse/optional fields use a partial filter |
| Modes | `TENANCY_MODE=shadow` (no context → unscoped, for migration) · `strict` (no context → `TENANT_CONTEXT_REQUIRED`) |

### 4.2 Tenant resolution and authentication

| Piece | Behaviour |
|---|---|
| `middleware/requestTenant.middleware.js` → `resolveRequestTenant` | Reads `x-tenant` header or `DEFAULT_TENANT_SLUG`; unknown store 404, inactive 403; opens the store context |
| `workspaceTenant` | Auth routes accept `workspace` in the body (login, register, forgot/reset password, email verification); unknown workspace answers like wrong credentials |
| Tokens (`user.model.js`) | Access/refresh claims `{ id, sub, tid, tv }` (email/phone removed) |
| `authGuard` / `guestOrAuth` | Load the user by `sub` inside `tid`; tenant must be active; `tokenVersion` must match; token from another store's `x-tenant` → 401 |
| Legacy tokens (issued before) | Accepted until `LEGACY_TOKEN_GRACE_UNTIL` for migrated users |
| Login | Workspace sign-in is staff-only; strict mode without workspace → `WORKSPACE_REQUIRED`; response includes `tenant` |
| Refresh | Token lookup platform-scoped; suspended store → 401 `TENANT_SUSPENDED` |
| `GET /auth/getme` | Adds `tenant`, `effectivePermissions` (roles ∪ direct grants), `features`, `isOwner` |
| Errors | Error responses can carry a machine `code` (`SMS_NOT_CONFIGURED`, `TENANT_SUSPENDED`, …) |

### 4.3 Roles and permissions per store

- `owner` (reserved slug) bypasses permission checks **only inside its own store**; legacy `superadmin` treated the same until migrated.
- Escalation guards on add/edit user, user permissions, bulk permissions, role edit/delete/permissions:
  - nobody assigns the owner role through the store API;
  - non-owners only grant permissions they hold;
  - only the owner edits the owner account or roles holding `create-user` / `create-role`;
  - owner role cannot be edited or deleted; `updaterole` only changes `name` / `isActive`.
- Staff limit (`tenant.limits.maxStaff`) on add and re-activation → `STAFF_LIMIT_REACHED`.
- Deactivation, role change and password change bump `tokenVersion` → sessions end immediately.
- Permission catalog is read-only for stores; managed through the platform API (`/api/v1/platform/permissions`, no dashboard page). A seller owner holds every permission in their store.

### 4.4 Per-store settings — `backend/src/settings/`

| File | What it does |
|---|---|
| `crypto.js` | AES-256-GCM, random IV, auth tag, versioned key ring (`SETTINGS_ENCRYPTION_KEYS`), `last4` mask |
| `definitions.js` | One definition per section drives validation, storage, masking, "configured" flags |
| `settings.service.js` | `getSettings`, `getMaskedSettings`, `getFeatures`, `updateSection` (omitted field = keep, `null` = clear), 60 s cache, Redis pub/sub invalidation across API + workers, `getWebhookUrls` |
| `schema.js` | Section descriptions for generic forms (dashboard + console) |
| `testers.js` | Live "Test connection" per section; secrets scrubbed from errors |

**Sections**

| Section | Fields (🔒 = encrypted) |
|---|---|
| `general` | invoicePrefix, orderHotline, facebookUrl, storefrontUrl, currency, timezone |
| `sms` | enabled, provider, apiUrl, balanceUrl, apiKey 🔒, senderId |
| `email` | mode (`smtp` / `platform` / `disabled`), fromName, fromEmail, replyTo, smtpHost, smtpPort, smtpSecure, smtpUser, smtpPassword 🔒 |
| `sslcommerz` | enabled, isLive, storeId, storePassword 🔒 |
| `pathao` | enabled, baseUrl, clientId, clientSecret 🔒, username, password 🔒, storeId, webhookSecret 🔒 |
| `steadfast` | enabled, baseUrl, apiKey 🔒, secretKey 🔒, webhookToken 🔒 |
| `cloudinary` | enabled, cloudName, apiKey, apiSecret 🔒, folder |

### 4.5 Integrations read the store's settings

`backend/src/integrations/config.js` is the single resolver: inside a store it returns that store's settings (or 422 with a `*_NOT_CONFIGURED` code); without a store (legacy) it falls back to `.env`.

| Integration | Change |
|---|---|
| Invoice / serial numbers | 14 model hooks + order invoice id use the store's `invoicePrefix`; counters per store (`SUPL-PZS-01`, `SUPL-BRG-01`) |
| SMS | `helpers/sms.js` send + balance with the store's provider key |
| Email | `helpers/nodemailer.js` uses store SMTP or the platform mailbox; one transport per config; links use the store's storefront URL |
| SSLCommerz | `integrations/sslcommerz.js` session + validation with store credentials; callbacks `/hooks/sslcommerz/<webhookKey>/{success,fail,cancel,ipn}` |
| Pathao / Steadfast | Courier config from settings (legacy `Merchant` docs otherwise); Pathao tokens per store in Redis; Pathao login uses the merchant's own username/password; webhooks verified with the store's secret/token |
| Cloudinary | Credentials passed per call (no global config); images store `cloudName`; uploads rejected (422) before saving when the store has no Cloudinary; old-account deletes skipped |

### 4.6 Cross-cutting

- **Cache:** all Redis keys and namespace versions stored as `t:<tenantId>:<key>`.
- **Queues:** image, SMS, email, audit, embedding jobs carry `tenantId`; workers run inside that store and listen for settings invalidation.
- **Socket.IO:** handshake auth (token, or store + guestId); rooms `tenant:<id>`, `tenant:<id>:user:<id>`, `tenant:<id>:guest:<id>`; order / wishlist / bulk-SMS events go only to the right store.
- **Audit:** audit worker stamps `tenantId`; store settings changes logged with field names only.
- **Vector search:** plugin adds `tenantId` to `$vectorSearch.filter`; Atlas index definition in `src/scripts/atlasVectorIndex.json`.

### 4.7 Security fixes

- Gmail address/app password removed from `helpers/nodemailer.js` (still in git history → must be revoked).
- Pathao webhook: no fallback secret; bad/missing secret → 401.
- Dashboard no longer bundles courier webhook secrets.
- Superadmin seeder: credentials from env, 12+ chars, idempotent.
- CORS: allowlist (`FRONTEND_URL`, `DASHBOARD_URL`, `PLATFORM_URL`, `CORS_ORIGINS`) + localhost in development (both `development` and this codebase's `developement` spelling).
- Rate limit: global limit restored (`RATE_LIMIT_MAX`); login limiter keyed by workspace + account.
- Production `autoIndex` off.

### 4.8 Scripts

| Command (in `backend/`) | Purpose |
|---|---|
| `npm test` | Backend test suite |
| `npm run seed:platform-admin` | First platform operator (`PLATFORM_ADMIN_EMAIL`, `PLATFORM_ADMIN_PASSWORD`) |
| `npm run tenant:create -- --name X --slug x --status active` | Register a store record |
| `npm run migrate -- --tenant <slug>` | Move single-store data into a store (5 steps, recorded, re-runnable) |
| `npm run migrate:cutover` | Drop old global unique indexes (after migration) |
| `npm run superAdmin` | Legacy superadmin seeder (env credentials) |

---

## 5. Model (database) changes

### 5.1 New collections (global)

| Model | Collection | Key fields |
|---|---|---|
| `Tenant` | `tenants` | `name`, `slug` (unique, reserved words blocked — workspace id), `status` (`provisioning` / `active` / `suspended` / `cancelled`), `statusReason`, `statusChangedAt`, `ownerUserId`, `plan`, `limits.maxStaff`, `webhookKey` (unique, immutable), `createdBy` |
| `TenantSettings` | `tenantsettings` | `tenantId` (unique), `data` (sections; secrets as `{ ciphertext, iv, authTag, keyVersion, last4, updatedAt }`), `version`, `updatedBy` |
| `PlatformUser` | `platformusers` | `name`, `email` (unique), `password` (bcrypt, never selected), `role` (`superadmin` / `support`), `isActive`, `tokenVersion`, `lastLoginAt`, `twoFactorEnabled`, `twoFactorSecret` |
| `PlatformAuditLog` | `platformauditlogs` | `actor`, `actorEmail`, `action` (logins, tenant create/update/suspend/activate, settings updated), `tenantId`, `changes` (field names only), `ip`, `userAgent` |
| (runner) | `migrations` | `name`, `tenantId`, `appliedAt`, `result` |

### 5.2 Every business model (50 models)

- New field **`tenantId`** (`ObjectId` → `Tenant`, indexed, immutable; required in strict mode).
- **Unique indexes are per store**, e.g.:
  - `User`: `{ tenantId, email }`, `{ tenantId, phone }` (partial — users without phone no longer collide)
  - `Product`: `{ tenantId, name }`, `{ tenantId, slug }`, `{ tenantId, sku }`, `{ tenantId, barCode }`
  - `Role`: `{ tenantId, name }`, `{ tenantId, slug }`
  - `Customer`: `{ tenantId, mobileNumber }`, `{ tenantId, customerId }`, …
  - `Sales` / `Purchase` / returns / transactions: `{ tenantId, invoiceNumber / serial }`
  - `Counter`: `{ tenantId, key }` (each store's invoice numbers start at 1)
- Models covered: Account, AuditLog, Banner, Brand, ByReturn, Cart, Category, Counter, Coupon, CourierReturn, CrateTransaction, Customer, CustomerType, CustomerPaymentRecived, CustomerAdvancePaymentRecived, DailyCashSummary, Delivery, Department, Discount, discountBanner, Employee, EmployeeAdvancePayment, EmployeeDesignation, FundHandoverDescription, Invoice, Merchant, MoneyTransfer, Order, OutletInformation, Product, Purchase, PurchaseReturn, Review, Role, Sales, SalesReturn, Section, SiteInformation, SizeChart, SmsLog, StockAdjust, StoreInformation, Subcategory, Supplier, SupplierDuePayment, TransitionCategory, User, UserPermission, Variant, Wishlist.

### 5.3 Field-level changes

| Model | Change |
|---|---|
| `User` | + `tokenVersion` (session revocation), + `mustChangePassword` (set for provisioned owners, cleared on change-password) |
| `Role` | `owner` added to reserved slugs; default roles seeded per store |
| Image sub-documents (Brand, Banner, Category, Customer, discountBanner, Employee, Product, SiteInformation, StoreInformation, User, Variant) | + `cloudName` (Cloudinary account the asset lives in) |
| `Permission` | Unchanged; stays global (catalog), writes only via platform |

---

## 6. Dashboard changes

### 6.1 Sign-in (`/signin`)

- New two-column design: form on the left, dark green brand panel (ECOMPOS, feature cards, Smartsoft footer) on the right; theme toggle top-right.
- **Workspace** field with building icon and `.ecompos.app` suffix (input auto-sizes to its text; suffix from `VITE_WORKSPACE_DOMAIN`), prefilled from `?workspace=` deep link or the last store used.
- Email with valid-email check mark; password show/hide; "Forgot password?"; button colour `#0F9D63`; browser autofill background removed.
- Sends `{ workspace, email, password }`; remembers the workspace.

### 6.2 Session and data isolation in the browser

| File | Change |
|---|---|
| `src/lib/session.ts` | Workspace storage, `?workspace=` deep link, `scopedStorageKey()` for per-store local drafts, `clearTenantStorage()` |
| `src/hooks/useAxiosSecure.tsx` | Sends `x-tenant` on every request (incl. refresh); `TENANT_SUSPENDED` → `/store-suspended` |
| `src/context/AuthContext.tsx` | Exposes `tenant`, `features`, `isOwner` (`isSuperAdmin` alias), `can()` from `effectivePermissions`, `updateFeatures()`; sign-in/out clears TanStack Query cache; sign-out clears store drafts and disconnects the socket |
| `src/socket/socket.ts` | Authenticated with the access token; URL from `VITE_SOCKET_URL`; `disconnectSocket()` |
| Drafts | Product, variant, banner, discount-banner, discount, sales and permission drafts namespaced per store |

### 6.3 Pages and components

| Page / component | What it does |
|---|---|
| **Store Settings** `/store-settings` (Platform Console → Store Settings, permission `store-settings`) | Header: store name, workspace, invoice prefix (read-only), "x of 6 connected" bar. **Integration cards (4 per row):** SMS, Email, SSLCommerz, Pathao, Steadfast, Cloudinary with Connected / Not connected. **Configure panel** (right side): enable switch, labelled fields with help, secrets masked `•••• 1234` with Replace / Remove, email SMTP fields only for SMTP mode, Save (only when changed), Test connection (saved values), inline API errors, Escape / outside click closes. **Webhook URLs** with copy buttons (show the live API domain on the live server). Staff who are not the owner see status only. |
| `FeatureGate` / `useFeature` | SMS pages gated on SMS; Courier Delivery gated on any courier |
| `IntegrationNotice` | Banner when Cloudinary is not configured (image uploads disabled) |
| `StoreSuspended` `/store-suspended` | Shown when the store is suspended |
| Role pickers (Add/Edit user, Create role, Assign role permission) | Owner role hidden |
| User list | "Staff n / max" when a staff limit is set |
| Courier form | No bundled webhook secrets |

### 6.4 Dashboard tests

Vitest + Testing Library (`npm test`): session helpers, axios interceptor, AuthContext, sign-in form, FeatureGate, roles helper, Store Settings page, integration form, platform API client, Platform Console OTP gate, sidebar visibility, create-seller form, seller list, seller detail — 58 tests.

---

## 7. Platform Console module (in the dashboard)

The platform tools live **inside the dashboard** as the sidebar module **Platform Console** (the separate `platform-console/` app was removed).

| Sidebar item | Route | Who can see / use it |
|---|---|---|
| Sellers | `/platform/sellers` | Platform store owner |
| Store Settings | `/store-settings` | Platform store owner (its own integrations) |
| Operators | `/platform/operators` | Platform store owner |

Sellers get every module except the Platform Console; their **Store Settings** sits under **Settings**. The Permission Catalog page was removed (the catalog stays in the database and API).

**Access:**
1. Sign in to the dashboard normally (workspace `velor`, your owner account). No separate operator login.
2. The Platform Console items show only when the workspace is in `VITE_PLATFORM_WORKSPACES` **and** the user is its owner.
3. Opening a console page shows the operator sign-in (`PlatformGate`): **platform operator email + password**. There is no access code, and no client-side secret.
4. Sign-in is two steps and the password alone issues no session. `POST /api/v1/platform/auth/login` returns only an OTP challenge; a 6-digit code is sent by SMS to the operator phone. `POST /api/v1/platform/auth/verify-otp` exchanges the challenge + code for the platform token (`POST /auth/resend-otp` re-sends, throttled 60s). Codes are stored HMAC-hashed in Redis, compared with `crypto.timingSafeEqual`, expire in 5 minutes and burn after 5 wrong attempts.
5. The console token lives in sessionStorage (closing the tab ends it) and is cleared when you sign out of the dashboard.

Code: `src/platform/` (own axios instance → `/api/v1/platform`, `PlatformAuthContext`, `PlatformGate`, `visibility.ts`) and `src/pages/PlatformConsole/` (`ui.tsx` holds the shared header, filter pills, icon actions, avatar, pagination and modal).

**UI:** ECOMPOS style with accent green `rgb(15,157,99)` = `#0F9D63` (Tailwind tokens `accent-25…950` in `src/index.css`).

| Page | What it does |
|---|---|
| Seller List | Breadcrumb, title, counts subtitle, refresh + **Create seller**; search, status pills with counts (from `counts` in `GET /platform/tenants`); table with S/N, avatar, name + workspace, plan / staff chips, created date, status pill (**Live**), view / configure / suspend-activate actions; pagination |
| Create seller (modal) | Seller name (workspace auto-filled from it), workspace, max staff, owner name / email / phone → shows login link, email and one-time password with copy buttons |
| Seller detail → Overview | Edit seller name, plan, max staff; at-a-glance facts; Suspend (reason) / Activate from the header |
| Seller detail → Integrations | Invoice prefix + the same integration cards and configure panel as Store Settings, saved through the platform API |
| Seller detail → Webhooks | The seller's callback URLs with copy buttons |
| Seller detail → Audit | Activity timeline of platform changes |
| Operators | Add operator (modal, role cards), change role, active switch (superadmin; not yourself) |

Shared UI: `src/pages/Settings/StoreSettings/IntegrationGrid.tsx` (cards + side panel) and `IntegrationForm.tsx` are used by both Store Settings and seller detail.

---

## 8. How the whole workflow works now

### 8.1 Onboarding a new seller

1. Sign in to the dashboard (workspace `velor`), open **Platform Console → Sellers**, sign in as a platform operator (email + password, then the SMS code), click **Create seller** (name, workspace e.g. `pizzashop`, max staff, owner details).
2. Backend (one transaction): creates `Tenant` → roles `owner/admin/manager/salesmen` → owner `User` with a temporary password (`mustChangePassword`) → status `active` → invoice prefix from slug (`PIZZAS`).
3. The page shows the **login link** `…/signin?workspace=pizzashop` and the **temporary password** once. Send both to the owner.

### 8.2 Store owner setup

1. Owner opens the link → workspace prefilled → signs in with the temporary password. (The API `POST /auth/change-password` clears `mustChangePassword`, but the dashboard has no change-password screen yet — see §14.)
2. **Settings → Store Settings** → for each provider **Configure & connect** → fill keys → **Save changes** → **Test connection**.
3. Copies the **Webhook URLs** into the Pathao / Steadfast / SSLCommerz panels.
4. **User List → Add user** for staff with roles (`admin`, `manager`, `salesmen`, or custom roles); staff limit enforced.

(You can also do step 2 for them: Platform Console → Sellers → the seller → Integrations.)

### 8.3 Every request

```
Staff signs in (workspace + email + password)
  → token { sub: userId, tid: tenantId, tv: tokenVersion } + refresh cookie
Each API call: Authorization: Bearer … , x-tenant: <workspace>
  → resolveRequestTenant: store exists and is active
  → authGuard: token store == header store, user active, tokenVersion matches
  → runForTenant(tenantId)
  → controller → Mongoose → tenantPlugin filters/stamps tenantId
  → cache key t:<tenantId>:… · socket room tenant:<tenantId> · jobs carry tenantId
```

### 8.4 Order and online payment

1. Order created inside the store → invoice id `<storePrefix>-XXXXXXXX`, per-store counters.
2. Order SMS / email go through the store's SMS account and mail settings.
3. SSLCommerz session opened with the **store's** store id/password; callback URLs contain the store's `webhookKey`.
4. SSLCommerz calls `/api/v1/hooks/sslcommerz/<webhookKey>/ipn` → backend finds the store by key → validates with that store's credentials → updates only that store's order.
5. `orderPlaced` socket event goes only to that store's dashboard.

### 8.5 Courier delivery

1. Staff creates a Pathao/Steadfast delivery → credentials from the store's settings (Pathao token cached per store in Redis).
2. Courier calls `/api/v1/hooks/pathao/<webhookKey>` (or `steadfast`) → store resolved by key → secret/token checked against that store → order status updated in that store only.

### 8.6 Image upload

1. Upload request → multer saves temp file → if the store has no Cloudinary → 422 `CLOUDINARY_NOT_CONFIGURED`, temp file deleted, nothing saved.
2. Otherwise job queued with `tenantId` → image worker runs inside the store → uploads to **the store's** Cloudinary account → saves `url`, `publicId`, `cloudName`.

### 8.7 Changing settings

`PATCH` settings → encrypted save → local cache cleared → Redis message `tenant-settings:invalidate` → API and all workers drop that store's cached settings → next call uses new keys. Dashboard updates status and gates without reload.

### 8.8 Suspending a store

Platform Console → Sellers → the seller → Suspend (reason) → tenant cache cleared → next request or token refresh from that store → 401/403 `TENANT_SUSPENDED` → dashboard shows **Store unavailable**. Activate reverses it.

### 8.9 Security boundaries

- A token from store A with `x-tenant: B` → 401.
- An id from store B used in store A → not found (plugin filter).
- Same email / product name / supplier mobile in two stores → allowed and isolated.
- Secrets never leave the server in plain text; owner sees `•••• last4`, other staff only "set / not set".

---

## 9. Velor data migration (already run)

Database: Atlas `cluster0` / `jahir` (MongoDB 8.0).

| Step | Result |
|---|---|
| Backup | 55 collections, 1,473 documents + old `.env` → `/home/desktop/velor-db-backup-2026-09-17/` |
| `.env` | Added encryption key, platform secrets, `API_PUBLIC_URL`, `APP_URL`, `PLATFORM_URL`, `TENANCY_MODE=shadow`, `DEFAULT_TENANT_SLUG=velor`, `LEGACY_TOKEN_GRACE_UNTIL` |
| Tenant | `velor` created (active) |
| 001 import settings | general, sms, email, sslcommerz, cloudinary imported; pathao/steadfast skipped (no merchants) |
| 002 backfill | `tenantId` on all data (4 users, 14 products, 24 variants, 2 sales, 163 audit logs, …) |
| 003 indexes | 164 per-store indexes built; 4 wait for cutover (`carts.user`, `carts.guestId`, `sizecharts.slug`, `variants.slug`) |
| 004 cloudName | set on existing brand and store images |
| 005 owner role | `superadmin` → `owner`; `superadmin@baig.com` and `karif9632@gmail.com` are Velor owners |
| Platform operator | `johkasouerp@gmail.com` (password in the backup folder, `platform-admin-credentials.txt`) — the account the Platform Console signs in as (password + SMS OTP) |

Sign in to the dashboard with workspace **`velor`**.

---

## 10. API reference

### Store dashboard (`/api/v1`, Bearer token + `x-tenant`)

| Method | Path | Who |
|---|---|---|
| POST | `/auth/login` `{ workspace, email, password }` | — |
| POST | `/auth/refresh-token`, `/auth/logout` | cookie |
| GET | `/auth/getme` | signed in |
| GET | `/settings` | `store-settings:view` (owner sees `last4`) |
| GET | `/settings/schema`, `/settings/webhooks` | `store-settings:view` |
| PATCH | `/settings/{sms, email, payment/sslcommerz, couriers/pathao, couriers/steadfast, cloudinary}` | owner |
| POST | `/settings/<same paths>/test` | owner |
| PATCH | `/settings/general` (orderHotline, facebookUrl) | `store-settings:edit` |
| GET | `/permission/allpermissions` (catalog, read-only) | signed in |

### Provider callbacks (no auth; store from key)

`POST /api/v1/hooks/sslcommerz/:webhookKey/{success,fail,cancel,ipn}` · `POST /api/v1/hooks/pathao/:webhookKey` · `POST /api/v1/hooks/steadfast/:webhookKey`

### Platform (`/api/v1/platform`, platform token)

| Method | Path | Role |
|---|---|---|
| POST | `/auth/login` (password → OTP challenge), `/auth/verify-otp`, `/auth/resend-otp`, `/auth/refresh`, `/auth/logout` · GET `/auth/me` | — / any |
| GET | `/tenants` (with `counts` per status), `/tenants/:id`, `/tenants/:id/audit`, `/tenants/:id/settings`, `/tenants/:id/settings/webhooks`, `/settings/schema`, `/permissions` | any |
| POST | `/tenants` (with `owner` → provisioning) | superadmin |
| PATCH | `/tenants/:id` · POST `/tenants/:id/suspend`, `/activate` | superadmin |
| PATCH / POST | `/tenants/:id/settings/<section path>` / `…/test` | superadmin |
| POST / PATCH / DELETE | `/permissions`, `/permissions/:id` | superadmin |
| GET / POST / PATCH | `/users`, `/users/:id` | superadmin |

---

## 11. Environment variables

### Backend (new)

| Variable | Purpose |
|---|---|
| `SETTINGS_ENCRYPTION_KEYS`, `SETTINGS_ACTIVE_KEY_VERSION` | Key ring for store secrets (**back up separately**) |
| `API_PUBLIC_URL` | Public API origin for webhook / payment callback URLs (**set to the live API domain**) |
| `APP_URL` | Dashboard origin for the owner login link |
| `PLATFORM_URL` | Only needed if the platform pages are ever served from another origin (CORS) |
| `PLATFORM_ACCESS_TOKEN_SECRET`, `PLATFORM_REFRESH_TOKEN_SECRET` (+ `_EXPIRY`) | Platform tokens (32+ chars, different from staff secrets) |
| `PLATFORM_ADMIN_EMAIL/PASSWORD/NAME` | Only for `seed:platform-admin` |
| `TENANCY_MODE` | `shadow` (now) / `strict` (after cutover) |
| `TENANCY_LOG_UNSCOPED` | Log queries that ran without a store |
| `DEFAULT_TENANT_SLUG` | Store used when a request names none (Velor during transition) |
| `LEGACY_TOKEN_GRACE_UNTIL` | End of old-token acceptance |
| `AUTH_COOKIE_SAMESITE` | Refresh cookie SameSite override |
| `CORS_ORIGINS`, `RATE_LIMIT_MAX` | Extra origins, global rate limit |
| `HOST_MAIL`, `HOST_APP_PASSWORD`, `MAIL_FROM_NAME` | Platform mailbox (optional; stores can use their own SMTP) |
| `WEBHOOK_SECRET`, `SUPERADMIN_EMAIL/PASSWORD` | Legacy routes / legacy seeder |

Store-specific keys (SMS, SSLCommerz, Cloudinary, couriers, SMTP) **no longer belong in `.env`** — Velor's were imported into the database and can be removed from `.env` (switch Velor email to SMTP first if `HOST_MAIL` is removed).

### Dashboard

`VITE_API_URL`, `VITE_SOCKET_URL`, `VITE_WORKSPACE_DOMAIN` (optional, default `ecompos.app`), `VITE_PLATFORM_WORKSPACES` (comma list of platform workspaces whose owner sees the Platform Console, e.g. `velor`; backend `PLATFORM_WORKSPACES` must match, optional `PLATFORM_CONSOLE_OPERATOR_EMAIL`).

---

## 12. Tests

| App | Command | Result |
|---|---|---|
| Backend | `cd backend && npm test` | 310 passed (tenancy plugin, isolation in strict mode with two stores, auth, RBAC, settings encryption, integrations, migrations, provisioning, platform API, sockets, cache) |
| Dashboard | `cd dashbaord && npm test` | 53 passed |

---

## 13. Going live checklist

1. **Rotate leaked secrets:** revoke the Gmail app password that was once committed; rotate courier webhook secrets.
2. Live backend `.env`: `API_PUBLIC_URL=https://api.<live-domain>`, `APP_URL`, `PLATFORM_URL`, `DASHBOARD_URL`, platform secrets, **same** `SETTINGS_ENCRYPTION_KEYS` as the database was encrypted with.
3. Deploy backend + dashboard together (the old dashboard does not know the `owner` role); set `VITE_PLATFORM_WORKSPACES` in the dashboard build to your own workspace only.
4. Register each store's webhook URLs with Pathao / Steadfast / SSLCommerz.
5. Update the Atlas `vector_index` from `backend/src/scripts/atlasVectorIndex.json`.
6. `npm run migrate:cutover` (drops old global unique indexes, builds the 4 waiting ones).
7. Run a few days with `TENANCY_LOG_UNSCOPED=true`; when clean, set `TENANCY_MODE=strict` and remove `DEFAULT_TENANT_SLUG`.
8. After the grace date, remove `LEGACY_TOKEN_GRACE_UNTIL`.
9. Remove store-specific keys from `.env`.

---

## 14. Known limits and not built

| Item | Status |
|---|---|
| Storefront (Next.js) multi-tenant (host/domain resolution, custom domains) | Next phase |
| Change-password screen / forced change for `mustChangePassword` | API exists (`POST /auth/change-password`); dashboard has no screen yet |
| "Keep me signed in" checkbox | Visual only |
| Two-factor login for platform operators | Fields exist; not implemented |
| Impersonation, billing / plans enforcement beyond staff limit | Not built |
| Order hotline / Facebook for SMS & email | Read from store settings `general` (imported from `.env`), editable in Platform Console; not linked to Store Information |
| Email "Platform mailbox" mode | Requires `HOST_MAIL` / `HOST_APP_PASSWORD` on the server; otherwise use SMTP |
| Production backend on old code against the migrated database | Old code does not know `owner` → deploy new code before/with the migration |
| `$lookup` with `localField` + `pipeline` | Requires MongoDB ≥ 5.0 (Atlas is 8.0) |
