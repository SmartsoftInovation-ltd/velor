# Multi-Tenant SaaS + Multi-Website Plan

> Status: **PLAN ONLY — awaiting review.** No implementation code has been written.
> Scope: `backend/` (Express + Mongoose), `dashbaord/` (Vite admin SPA), `frontend/` (Next.js storefront).
> Date: 2026-09-17

---

## Table of Contents

1. [Current State](#1-current-state)
2. [Target Architecture](#2-target-architecture)
3. [Gaps Found](#3-gaps-found)
4. [Step-by-Step Implementation Plan](#4-step-by-step-implementation-plan)
5. [Migration Plan](#5-migration-plan)
6. [Open Questions](#6-open-questions)
7. [Appendix A — Model Inventory](#appendix-a--model-inventory)
8. [Appendix B — Unique Constraints to Re-scope](#appendix-b--unique-constraints-to-re-scope)

---

## 1. Current State

### 1.1 Repo shape

| App | Stack | Deployment (as found) |
|---|---|---|
| `backend/` | Node ≥20, Express 4, Mongoose 8, ioredis + BullMQ, Socket.io, JWT, Cloudinary, SSLCommerz, Pathao/Steadfast, Groq LLM + `@xenova/transformers` embeddings | Single process via `pm2` (`npm run build`) on a VPS ("Accessible externally via VPS IP"). `.env.docker.sample` + `.dockerignore` reference a `Dockerfile`/`docker-compose.yml` (mongo, redis, backups) that is **not committed**. |
| `dashbaord/` | React 19, Vite 6, TanStack Query, react-router 7 | Vercel (`vercel.json` SPA rewrite). One build, one `VITE_API_URL`. |
| `frontend/` | Next.js 16.3, React 19.2, Tailwind 4 | No deployment config found. **Not wired to the backend** — every page renders from fixtures in `src/lib/catalog/*`. |

### 1.2 Database & connection

- One Mongoose connection: `mongoose.connect(DATABASE_URL)` in `backend/src/database/db.js`. All 51 models (44 files) are compiled on the default connection at `require` time and imported directly by controllers.
- Multi-document transactions are used (`startSession` × 20) → production must be a replica set / Atlas.
- `$vectorSearch` on `Product.embedding` (`utils/retrieve.js`, index `vector_index`) → production is **MongoDB Atlas** (Docker sample uses plain Mongo, which cannot serve that query — confirm, see Open Questions).
- Query surface: ~850 Mongoose calls across controllers/services/workers/models; ~110 `aggregate()` pipelines (67 in `dashboard.controller.js`, 39 in the 6,700-line `report.controller.js`, 18 in `invoice.controller.js`); 106 `$lookup` stages. All `$lookup` joins found use ObjectId foreign keys (`_id`, `product`, `supplierId`). No `$unionWith`, `$graphLookup`, `$out`, `$merge`. One raw driver write: `audit.worker.js` → `auditLogModel.collection.insertOne`.

### 1.3 Auth flow

- `POST /auth/login` → `User.findOne({ $or: [{ email }, { phone }] })` → bcrypt compare → access JWT `{ id, email, name, phone }` (1d) in response body + refresh JWT `{ id }` (15d) in an httpOnly cookie (`sameSite: none` in production) and stored on `user.refreshToken`.
- `authGuard` verifies the JWT, then **re-loads the user by `email OR phone`** (not by `id`), deep-populates roles → permissions, rejects blocked/inactive users.
- `guestOrAuth` (cart/wishlist) accepts a JWT or an `x-guest-id` header.
- The **same `User` collection** holds dashboard staff (users with `roles[]`) and storefront shoppers (`registerUser` creates `roles: []`).

### 1.4 RBAC

- `Permission` = a catalog of module slugs (`product`, `retail-sales`, `create-user`, …) seeded by `seed:permissions`; mirrored in `dashbaord/src/config/permissions.ts` (202 lines).
- `Role` = `{ name (unique), slug (unique), permissions: [{ permission, actions[] }] }`. Default roles seeded: `superAdmin`, `admin`, `user`, `manager`, `guest`, `salesMen`.
- `User.permissions[]` = direct per-user grants, unioned with role grants (`checkPermission.middleware.js`).
- `authorize(module, action)` / `authorizeAny(...)` with a **global bypass for any role whose slug is `superadmin`**. Role model hooks protect the reserved slug.
- `addSuperAdminSeeder.js` creates `superadmin@gmail.com` with a hardcoded password and all permissions.
- `UserPermission` model + `/userpermission` routes still exist (legacy parallel grant store).
- Dashboard: `AuthContext` exposes `can(module, action)` and `isSuperAdmin`; `ProtectedRoute` + `PermissionGuard` gate routes; `AppSidebar` hides items via `can`.

### 1.5 How requests are scoped today

They are not. There is no owner/business concept anywhere. Examples of "the whole database is one business":

- Singleton settings: `SiteInformation.findOne()`, `StoreInformation.findOne()` used for branding, invoices and reports.
- Global sequence counters: `Counter` keyed by `SALES_INVOICE`, `SALES_RETURN`, etc., formatted with the global `env.INVOICE_PREFIX`.
- Global unique indexes on business keys (`Product.name`, `Product.sku`, `Customer.mobileNumber`, `User.email`, `Role.name`, every `slug`, every serial ID).
- Redis cache keys `"{ns}:v{n}:{suffix}"` with no owner prefix.
- `io.emit("orderPlaced", …)` and `io.emit("sms:bulk:done", …)` broadcast to every socket; sockets are unauthenticated (dashboard connects to hardcoded `http://localhost:3000` with `query: { userId: "123" }`).
- Integrations use process-wide env credentials: `SSLC_STORE_ID/PASSWORD`, `BULK_SMS_*`, `HOST_MAIL`, `STEADFAST_API_KEY`, `GROQ_API_KEY`, Cloudinary. Courier creds live in the `Merchant` collection (global, `merchantID` unique).
- Links in emails use `process.env.FRONTEND_URL`; SSLCommerz callbacks use `process.env.BACKEND_URL`.
- Background workers (`image`, `sms`, `email`, `audit`, `embedding`) receive `{ modelName, documentId, … }` — no owner context.

### 1.6 Routing & domains

- Backend: all APIs under `/api/v1` (46 route files). Webhooks: `/courier/pathao-webhook`, `/courier/steadfast-webhook`, `/payment/{success,fail,cancel,ipn}`.
- CORS: an **uncommitted** change in this working tree replaces allow-all with a static allowlist (`FRONTEND_URL`, `DASHBOARD_URL`, `CORS_ORIGINS`) in `backend/src/config/cors.config.js`, shared by Express and Socket.io.
- Dashboard: single domain, SPA.
- Storefront: single Next app, App Router, `(shop)` and `(auth)` route groups, no `middleware.ts`/`proxy.ts`, no host awareness. Design-token system (`DESIGN_SYSTEM.md`) — every component reads semantic CSS variables, which makes per-tenant theming cheap later.

---

## 2. Target Architecture

### 2.1 Core decision: shared database + `tenantId` on every business document

**Recommendation: one database, one set of collections, a required `tenantId` on every tenant-owned document, enforced automatically by a fail-closed Mongoose plugin driven by request-scoped context (AsyncLocalStorage).**

Why this over database-per-tenant, for *this* codebase:

| Concern | Shared DB + `tenantId` | Database-per-tenant (`connection.useDb`) |
|---|---|---|
| Code change size | Plugin + context; most of the ~850 call sites stay untouched because query/aggregate/save middleware injects the filter | Every one of ~850 call sites must resolve a model from a per-request connection instead of the imported global model |
| Aggregations (110) / `$lookup` (106) | A `pre('aggregate')` hook inserts `$match: { tenantId }` as the first stage; all joins are by ObjectId so they cannot cross tenants once the root is scoped | Free isolation |
| Atlas Vector Search | One `vector_index` with `tenantId` added as a `filter` field | One search index per tenant DB — Atlas caps search indexes per cluster |
| Scale of Mongo files | ~51 collections, fixed | ~51 collections × indexes × N tenants → tens of thousands of WiredTiger files at a few hundred tenants |
| Platform analytics / billing | Simple | Fan-out across DBs |
| Isolation strength | Logical; depends on the plugin being fail-closed and tested | Physical |
| Per-tenant export/delete | `deleteMany({ tenantId })` per collection (scripted) | Drop database |

Risk mitigation for the shared model is built into the plan: fail-closed plugin (throws when no tenant context), an explicit and grep-able bypass for platform code, a CI check that every model is registered, and a cross-tenant isolation test suite. A `Tenant.isolation` field can later route a very large customer to a dedicated database without changing the model for everyone else (out of scope now).

### 2.2 Actors

| Actor | Where they live | Scope |
|---|---|---|
| **Platform owner / platform staff** (you) | New `PlatformUser` collection (separate from `User`), separate JWT audience | Creates/suspends tenants, sets plans, manages domains, impersonation (audited) |
| **Tenant owner** ("Velor", "Pizzashop" admin) | `User` with `tenantId`, holding the reserved per-tenant `owner` role | Full access inside their tenant only; adds/removes employees |
| **Employee** | `User` with `tenantId`, tenant-scoped roles | Whatever their roles grant, inside their tenant only |
| **Shopper** (registered) | `User` with `tenantId`, no staff roles (or a flag `kind: "shopper"`) | Their own cart/orders/wishlist on that tenant's storefront |
| **Guest** | `guestId` header, scoped to tenant | Cart/checkout on that tenant's storefront |

### 2.3 Control-plane data (new, global — not tenant-scoped)

**`Tenant`**
- `name`, `slug` (unique, used for the default subdomain; reserved-word blocklist: `www`, `app`, `api`, `admin`, `platform`, `mail`, `static`, `cdn`, …)
- `status`: `provisioning | active | suspended | cancelled`
- `plan`, `limits` (max staff, max outlets, SMS quota, storage)
- `ownerUserId`
- `settings`: `invoicePrefix` (replaces `env.INVOICE_PREFIX`), currency, timezone, locale
- `integrations` (encrypted at rest with a platform KMS/env key): SSLCommerz store id/password, SMS provider key/sender, SMTP or "use platform sender", Cloudinary folder
- `webhookKey`: opaque random key used in per-tenant webhook URLs
- audit: `createdBy` (platform user), timestamps

**`TenantDomain`**
- `hostname` (lowercased, unique globally), `tenantId`
- `type`: `subdomain | custom`
- `isPrimary` (canonical host; others 301 to it)
- `status`: `pending_verification | verified | active | failed | removed`
- `verificationToken`, `verifiedAt`, `certStatus`, `providerRef` (Vercel/Cloudflare id)

**`PlatformUser`**, **`PlatformAuditLog`**.

**`Permission`** stays global: it is a code-defined module catalog, not tenant data. Only platform staff may modify it.

### 2.4 Tenant-scoped data

Every other existing model gets `tenantId` (required, indexed, immutable). Full list in [Appendix A](#appendix-a--model-inventory).

### 2.5 Tenant context & enforcement (backend)

1. **Request context.** A middleware opens an AsyncLocalStorage scope per request holding `{ tenantId, tenant, actor, bypass: false }`. Context propagates through `await`, Mongoose hooks and transactions (the 20 `startSession` uses are fine).
2. **Mongoose tenant plugin** (registered on every tenant-scoped schema):
   - Query middleware (`find*`, `count*`, `distinct`, `update*`, `replaceOne`, `delete*`, `findOneAnd*`) adds `tenantId` to the filter; on upserts it also lands in the inserted document.
   - `pre('validate'/'save')`: sets `tenantId` on new docs; throws if an existing doc's `tenantId` differs from context.
   - `pre('insertMany')`, `pre('bulkWrite')`: stamp/inject per document/operation (confirm `bulkWrite` middleware on the installed Mongoose 8.x).
   - `pre('aggregate')`: inserts `$match: { tenantId }` as stage 0, or as stage 1 after pipeline-leading stages that must stay first (`$vectorSearch` gets `filter: { tenantId }` instead; `$geoNear`/`$search` likewise).
   - `estimatedDocumentCount` is disallowed on tenant models.
   - **Fail closed:** no tenant in context and no explicit bypass → throw. Platform/migration code must call an explicit `runAsPlatform(...)` / `runForTenant(tenantId, ...)` helper so every bypass is grep-able.
   - Raw driver access (`Model.collection.*`) bypasses middleware → forbid via lint rule, fix `audit.worker.js`.
   - `populate` goes through the ref model's `find` middleware → automatically scoped.
3. **Model hooks that check uniqueness in code** (`this.constructor.findOne({ slug })` in Role, Permission, Brand, Delivery, Merchant, SizeChart, etc.) become tenant-scoped automatically via (2), and the DB-level indexes become compound (Appendix B).

### 2.6 Tenant resolution

```
                    ┌──────────────────────────────────────────────────────┐
 Browser on         │ Next.js storefront (one deployment, all tenants)     │
 pizzashop.com  ──► │  proxy.ts reads Host → rewrites /api/* to backend    │──┐
 pizzashop.         │  sets X-Forwarded-Host (+ platform proxy secret)     │  │
   mysaas.com       └──────────────────────────────────────────────────────┘  │
                                                                              ▼
 Browser on         ┌──────────────────┐                        ┌──────────────────────────┐
 app.mysaas.com ──► │ Dashboard SPA    │── Bearer JWT {tid} ──► │ api.mysaas.com (Express) │
                    └──────────────────┘                        │  resolveTenant middleware │
 Pathao/Steadfast/  ─── /webhooks/:provider/:webhookKey ──────► │  → ALS context → plugin   │
 SSLCommerz                                                     └──────────────────────────┘
 Platform console ─── /platform/* (PlatformUser JWT, no tenant) ─────────────▲
```

`resolveTenant` decides the tenant in this order, and the first rule that applies wins:

| Request type | Tenant source | Checks |
|---|---|---|
| `/platform/*` | none | `PlatformUser` JWT required; handlers use explicit `runForTenant` |
| Webhooks / payment callbacks | `:webhookKey` path param → `Tenant` | Provider signature/secret from that tenant's integration settings |
| Authenticated **staff** request (dashboard) | `tid` claim in the access JWT | Tenant `active`; user re-loaded **by `id` + `tenantId`** |
| **Storefront** request (shopper token or guest) | Host → `TenantDomain` lookup | If a shopper JWT is present, its `tid` must equal the host's tenant, else 401 |
| Nothing resolvable | — | 404 `Unknown store` (fail closed) |

Host lookup details:
- Host comes from `X-Forwarded-Host` (Express `trust proxy` is already set) → lowercase, strip port, optional `www.` normalization.
- Cache `domain:{hostname} → tenantId` in Redis (e.g. 5 min) + short in-process LRU; negative-cache unknown hosts briefly; invalidate on domain/tenant status change.
- **Host spoofing is not an escalation:** anyone can already browse any tenant's public storefront, and every authenticated action is bound to the token's `tid`. The platform proxy secret header is still recommended so the backend can distinguish "came through our storefront" from direct calls (useful for rate limiting and analytics).

### 2.7 Dashboard vs storefront

**Dashboard (owner/employees)**
- Stays **one deployment** at `app.mysaas.com` (not per-tenant hostnames): simpler Vercel setup, and `app.` + `api.` share the registrable domain so the refresh cookie becomes same-site (`sameSite: lax`), which avoids today's third-party-cookie dependence (`sameSite: none`).
- Login identifies the tenant with a **workspace slug** field (remembered in localStorage after the first login), then `email/phone + password` looked up with `{ tenantId, email }`. Alternative in Open Questions.
- JWTs carry `tid`; refresh re-validates tenant status (a suspended tenant's staff are signed out on the next refresh/401).

**Storefront (shoppers/guests)**
- One Next.js deployment serves all tenants. Tenant comes from the Host header.
- The browser **only talks to its own origin** (`/api/*` on `pizzashop.com`); the Next proxy forwards to the backend. Benefits: shopper auth cookies are first-party on custom domains (no Safari ITP / third-party cookie breakage), and the backend CORS allowlist stays static (`app.mysaas.com`, platform console, dev) instead of growing with every custom domain.
- Server-rendered data fetching and any Next caching (`fetch` cache, `"use cache"`, ISR) **must include the tenant/host in the cache key**, otherwise one tenant's page is served to another.
- Per-tenant `generateMetadata`, favicon, OG images, `robots.txt`, `sitemap.xml` from tenant site settings.
- Per-tenant theme: override the semantic CSS variables (brand color ramp) from tenant settings — the existing token architecture already supports it.
- Next 16 renamed `middleware.ts` → `proxy.ts`; per `frontend/AGENTS.md`, confirm against `node_modules/next/dist/docs/` before implementing.

### 2.8 Domains

**Default subdomain:** `{tenant.slug}.mysaas.com`, created automatically at provisioning (a `TenantDomain` row, `type: subdomain`, `status: active`). Needs one wildcard DNS record `*.mysaas.com` pointing at the storefront host and a wildcard TLS certificate (DNS-01).

**Custom domain flow** (owner self-serve from dashboard, or platform staff):
1. Owner enters `www.pizzashop.com` → `TenantDomain` created as `pending_verification` with a random `verificationToken`.
2. Dashboard shows DNS instructions:
   - Ownership: `TXT _mysaas-verify.www.pizzashop.com = <token>`
   - Routing: `CNAME www → stores.mysaas.com` (or the provider's target). Apex (`pizzashop.com`) needs `A`/`ALIAS` records — recommend `www` as primary and apex → `www` redirect.
3. Backend verification job polls DNS (and a "Verify now" button), marks `verified`.
4. Domain is registered with the edge provider (below) → certificate issued → `active`. Cache invalidated.
5. Owner may set it `isPrimary`; other hosts 301 to the primary (SEO).
6. Removal: deregister from provider, mark `removed`, invalidate cache.

Hostnames are globally unique, and ownership is verified **before** activation so nobody can claim someone else's domain.

**Edge provider options** — depends on where the storefront runs (nothing in the repo decides this yet):

| Option | Subdomains | Custom domains + TLS | Fit |
|---|---|---|---|
| **A. Vercel** (dashboard is already there) | Wildcard `*.mysaas.com` on the project (requires `mysaas.com` nameservers on Vercel) | Vercel REST API: add domain to project → verification challenge → auto cert | Least ops; check per-project domain limits and pricing for your expected tenant count |
| **B. VPS + Caddy** (backend is already on a VPS with pm2) | Wildcard cert via DNS-01 | Caddy on-demand TLS with an `ask` endpoint on the backend (`GET /internal/domains/allowed?domain=`) that only approves `verified` domains | Cheapest at scale; you own uptime, certificates and rate limits |
| **C. Cloudflare for SaaS** in front of A or B | Wildcard | Custom Hostnames API, Cloudflare issues certs | Good at scale; extra vendor |

**Recommendation:** decide the storefront host first. If it goes on Vercel, use A; if you want everything on the VPS, use B. Section 4 keeps the domain provider behind one small interface (`register`, `status`, `remove`) so the choice can change later.

### 2.9 RBAC with a tenant dimension

- `Role` gains `tenantId`; uniqueness becomes `(tenantId, slug)` and `(tenantId, name)`.
- Global `superadmin` bypass is replaced by:
  - **Tenant `owner`** — reserved per-tenant role slug; bypasses permission checks **only inside its own tenant**; exactly one owner is created at provisioning (transferable by platform staff).
  - **Platform admin** — a different principal (`PlatformUser`), never matches `authorize()` on tenant routes; impersonation is an explicit, audited, time-boxed token with `tid` + `impersonatedBy`.
- `authorize()` additionally asserts `req.user.tenantId === context.tenantId` (defense in depth).
- **Escalation guard inside a tenant:** a user with `create-user:add`/`edit` can only assign roles/direct permissions that are a subset of their own; only the owner can grant/revoke admin-level roles; nobody but platform staff can create an `owner`.
- `Permission` catalog stays global and read-only for tenants; hide Permission CRUD in the tenant dashboard.
- Default roles (`admin`, `manager`, `salesmen`, …) are seeded **per tenant** at provisioning from a template; tenants can then edit their own copies.
- Plan limits (max staff accounts) enforced on user creation.
- Retire the legacy `UserPermission` model/routes or add `tenantId` to it (see Open Questions).

### 2.10 Cross-cutting subsystems

| Subsystem | Target |
|---|---|
| Redis cache (`utils/cache.util.js`) | Prefix every key and namespace version with `t:{tenantId}:` from context (single-file change covers all ~190 call sites) |
| Counters / serials | `Counter` unique on `(tenantId, key)`; prefix from `tenant.settings.invoicePrefix`; each tenant's sequences start at 1 |
| BullMQ jobs | Queue helper auto-attaches `tenantId` from context; workers wrap every job in `runForTenant(job.data.tenantId)`; a job without `tenantId` fails |
| Socket.io | Authenticate on handshake with the JWT; join `tenant:{tid}` and `tenant:{tid}:user:{id}` rooms; replace every `io.emit` with room emits; storefront wishlist events use `tenant:{tid}:guest:{guestId}` |
| Audit logs | `tenantId` on `AuditLog`; worker inserts through the model (not `collection.insertOne`) or stamps `tenantId` explicitly |
| Cloudinary | Folder `tenants/{tenantId}/…`; per-tenant storage accounting later |
| Email | Platform SMTP sender by default with tenant "reply-to"; links built from the tenant's **primary domain**, not `FRONTEND_URL` |
| SMS | Per-tenant provider credentials or platform account with per-tenant quota; bulk SMS recipient queries are tenant-scoped by the plugin |
| Payments (SSLCommerz) | **Per-tenant store credentials are mandatory** (money must land in the tenant's account); callback/IPN URLs include `webhookKey` |
| Couriers | `Merchant` gets `tenantId`; webhook URLs per tenant; remove the global `STEADFAST_API_KEY` fallback |
| AI chat / embeddings | `vector_index` gains `tenantId` filter field; `retrieve()` passes `filter: { tenantId }`; embedding worker runs in tenant context; Groq key stays platform-level with per-tenant rate limit |
| Rate limiting | Global IP limiter stays; auth limiter keys include tenant; add per-tenant API budget later |
| Cron (`cleanTempFiles`) | Filesystem only — no tenant context needed |
| Seeders/backfills | All become `forTenant(tenantId)` or explicit platform scripts |

---

## 3. Gaps Found

Severity: **Critical** = cross-tenant data leak or takeover the moment a second tenant exists; **High** = wrong data/behavior for tenants; **Medium** = operational.

### 3.1 Data layer

| # | Gap | Where | Severity |
|---|---|---|---|
| D1 | No `tenantId` on any of the 50 business models | `backend/src/models/*` | Critical |
| D2 | ~850 queries and ~110 aggregation pipelines with no tenant filter (largest: `report.controller.js` 6.7k lines / 39 pipelines, `dashboard.controller.js` 67 pipelines) | `backend/src/controller/*` | Critical |
| D3 | Global unique indexes on business keys — second tenant cannot create "T-Shirt", reuse a mobile number, email, SKU, slug, role name, or invoice serial | See [Appendix B](#appendix-b--unique-constraints-to-re-scope) | High |
| D4 | Singleton assumptions: `SiteInformation.findOne()`, `StoreInformation.findOne()` | `siteinformation.controller.js`, `storeInformation.controller.js`, `sales.controller.js:251`, `report.controller.js:63` | High |
| D5 | Global counters + global `INVOICE_PREFIX` | `counter.model.js`, hooks in sales, salesReturn, purchase, purchaseReturn, supplier, customer, coupon, crateTransaction, employee, moneyTransfer, fundHandover | High |
| D6 | Raw driver insert bypasses middleware | `workers/audit.worker.js:28` | High |
| D7 | Vector index has no filter field; `$match` runs after `$vectorSearch` | `utils/retrieve.js` | High |
| D8 | `$lookup` stages reference collection names; safe only once the root stage is tenant-scoped (all found joins are by ObjectId) | 106 stages | Medium (verify) |
| D9 | `User.phone` is `unique` without `sparse`/partial filter — users without a phone collide on `null` (latent bug, matters more per tenant) | `user.model.js:48` | Medium |
| D10 | Mongoose `autoIndex` presumably on in production — index changes would build implicitly on boot | `db.js` | Medium |

### 3.2 Auth & RBAC

| # | Gap | Where | Severity |
|---|---|---|---|
| A1 | `authGuard`/`guestOrAuth` re-load the user by `email OR phone` from the token — with per-tenant emails this resolves to an arbitrary tenant's user | `middleware/authMiddleware.js`, `guestOrAuth.js` | Critical |
| A2 | Login looks up `{ $or: [{ email }, { phone }] }` globally | `user.controller.js:82` | Critical |
| A3 | Global `superadmin` bypass — any tenant's superadmin would pass every check on every tenant | `checkPermission.middleware.js` | Critical |
| A4 | Roles are global; `getAllUser` / `getUserAddedByAdmin` / role list return every user/role in the DB | `user.controller.js:409, 648`, `role.controller.js:20` | Critical |
| A5 | No escalation guard: `create-user:edit` holders can assign any role, including admin | `addUser`, `updateUser`, `addPermissionToUser` | High |
| A6 | JWT has no tenant claim; refresh does not re-check any tenant status | `user.model.js` token methods | High |
| A7 | Refresh cookie relies on `sameSite: none` cross-site | `user.controller.js:155` | Medium |
| A8 | Hardcoded superadmin credentials in seeder | `seeder/addSuperAdminSeeder.js` | Medium |
| A9 | Legacy `UserPermission` model/routes duplicate grants | `adduserpermission.controller.js` | Medium |
| A10 | Permission CRUD is reachable by tenant-side admins; it must become platform-only | `routes/api/permisson.api.js` | High |

### 3.3 Integrations, events, infrastructure

| # | Gap | Where | Severity |
|---|---|---|---|
| I1 | Socket.io unauthenticated; `io.emit("orderPlaced")` broadcasts orders to every connected client | `socket/socket.js`, `order.controller.js:408`, `workers/sms.worker.js:96` | Critical |
| I2 | Redis cache keys not tenant-prefixed → tenant A can be served tenant B's cached lists/dashboards | `utils/cache.util.js` | Critical |
| I3 | Bulk SMS reads `User.find()` and `Order.find()` → would text every tenant's customers | `sms.controller.js:74, 87` | Critical |
| I4 | SSLCommerz store credentials and callback URLs are process-wide | `order.controller.js:373-393` | Critical (money routing) |
| I5 | Courier webhooks have no tenant identifier; `Merchant.merchantID` globally unique | `courier.api.js`, `marchant.model.js` | High |
| I6 | BullMQ job payloads carry no tenant | `queues/*`, `workers/*` | High |
| I7 | Email links use `FRONTEND_URL` | `user.controller.js:263, 336`, `emailTemplate/orderTemplate.js` | High |
| I8 | Courier webhook secrets shipped to the browser via `VITE_*_WEBHOOK_SECRET` | `dashbaord` env usage | High (existing security issue) |
| I9 | Dashboard socket URL hardcoded to `http://localhost:3000` with fake `userId` | `dashbaord/src/socket/socket.ts` | Medium |
| I10 | CORS allowlist (uncommitted change) is static — fine for `app.`/platform origins if storefront uses same-origin proxy; would not scale if storefronts called the API cross-origin | `backend/src/config/cors.config.js` | Medium |
| I11 | No test suite in any app — isolation cannot be proven today | all | High |
| I12 | Deployment files (Dockerfile/compose/reverse proxy) not in repo; no wildcard DNS/TLS setup exists | — | Medium |

### 3.4 Frontends

| # | Gap | Where | Severity |
|---|---|---|---|
| F1 | Dashboard login has no tenant/workspace input; `AuthContext.isSuperAdmin` drives bypass UI | `dashbaord/src/context/AuthContext.tsx`, sign-in page | High |
| F2 | Dashboard exposes Permission management and global settings pages meant for platform staff | `AppSidebar.tsx`, `App.tsx` | Medium |
| F3 | No platform console exists | — | High |
| F4 | Storefront has no API integration, no host awareness, no per-tenant metadata/theme; `images.remotePatterns` only allows Unsplash | `frontend/*`, `next.config.ts` | High (greenfield — cheapest to do right now) |

---

## 4. Step-by-Step Implementation Plan

Each phase is a separate PR/conversation, reviewable on its own. Phases 1–4 are **invisible to current users** (single tenant keeps working).

### Phase 0 — Decisions & safety net (prerequisite)
1. Resolve the Open Questions marked **Blocking**.
2. Add a backend integration-test harness (in-memory MongoDB replica set + supertest). No tests exist today; the isolation suite in Phase 11 depends on it.
3. Set `autoIndex: false` for production; introduce a versioned migrations runner (scripts with up/verify, recorded in a `migrations` collection).
4. Commit Docker/compose/reverse-proxy files (or document the real production topology) so domain work has a concrete target.

### Phase 1 — Control plane foundation
1. `Tenant`, `TenantDomain`, `PlatformUser`, `PlatformAuditLog` models.
2. Tenant context module (AsyncLocalStorage) with `getTenantId()`, `runForTenant()`, `runAsPlatform()`.
3. Platform auth: separate login, separate JWT secret/audience, `platformGuard`.
4. Seed script for the first platform admin (credentials from env/CLI prompt, never hardcoded).

### Phase 2 — Tenant plugin in shadow mode
1. Build the Mongoose tenant plugin (behavior in §2.5).
2. Add optional `tenantId` field + plugin to every tenant-scoped model (Appendix A).
3. Run in **shadow mode**: inject/stamp when context exists, **log** (not throw) when it is missing. Ship. Collect logs to find every code path that runs without context (workers, seeders, hooks, cron).
4. CI check: fail if a model file is not registered as tenant-scoped or explicitly global.
5. Lint rule: forbid `.collection.` driver calls and `estimatedDocumentCount` on tenant models.

### Phase 3 — Resolution middleware + single-tenant compatibility
1. `resolveTenant` middleware per §2.6, mounted before routes.
2. **Compatibility mode** (`DEFAULT_TENANT_ID` env): while only Velor exists, requests that resolve nothing fall back to the default tenant and log a warning.
3. Domain cache (Redis + LRU) and invalidation hooks.
4. Webhook routes gain `/:webhookKey` variants; old routes map to the default tenant during transition.

### Phase 4 — Data migration (see §5, steps M1–M6)
Backfill `tenantId`, counters, compound indexes, drop global uniques.

### Phase 5 — Auth & RBAC
1. Tokens carry `tid`; `authGuard`/`guestOrAuth` load by `id` + `tenantId`; tenant status check on every refresh.
2. Tenant-scoped login (`{ tenantId, email|phone }`), register (shopper), forgot/reset/verify-email (links to tenant primary domain).
3. Replace `superadmin` bypass with tenant `owner` bypass + tenant equality assertion.
4. Role/permission escalation guards; plan staff limits.
5. Permission CRUD → platform-only routes; tenant endpoint becomes read-only catalog.
6. Owner/employee management endpoints (add/remove/deactivate employee, reset employee password, transfer ownership via platform).
7. Resolve `UserPermission` legacy.
8. Refresh cookie → `sameSite: lax` on the shared parent domain once dashboard is at `app.mysaas.com`.

### Phase 6 — Cross-cutting subsystems
1. Cache key prefixing (`cache.util.js`).
2. Counters per tenant + prefix from tenant settings.
3. Queue helper + workers run in tenant context; fix `audit.worker.js`.
4. Socket.io: JWT handshake, tenant rooms, replace all `io.emit`.
5. Cloudinary folders per tenant.
6. Atlas `vector_index` with `tenantId` filter; update `retrieve()`.
7. Singleton settings (`SiteInformation`, `StoreInformation`) become "one per tenant"; decide whether `StoreInformation`/`OutletInformation` represent multiple outlets per tenant.

### Phase 7 — Per-tenant integrations
1. Encrypted `tenant.integrations` + dashboard settings screens.
2. SSLCommerz per tenant, callback URLs with `webhookKey`.
3. SMS/email per tenant (or platform default + quota).
4. Couriers: `Merchant.tenantId`, per-tenant webhook URLs, remove env-key fallback; **remove `VITE_*_WEBHOOK_SECRET` from the dashboard bundle** and rotate those secrets.

### Phase 8 — Provisioning & platform console
1. Platform API: create tenant (slug check, reserved words) → create owner user (temp password + forced change, or invite link) → seed default roles from template → create default `TenantDomain` subdomain → initialize counters/settings → status `active`. All inside one transaction where possible; idempotent retry.
2. Suspend/reactivate/cancel tenant (suspended: storefront shows "store unavailable", staff logged out on refresh, webhooks still recorded).
3. Tenant data export and hard-delete script (per collection `deleteMany({ tenantId })`, Cloudinary folder cleanup).
4. Impersonation (audited, short-lived).
5. Minimal platform console UI: tenant list/create/suspend, domains, plans. (Separate small app or a `/platform` area — see Open Questions.)

### Phase 9 — Dashboard changes (light, no routing rework)
1. Sign-in: workspace field (remembered), tenant name/logo shown after resolution.
2. `AuthContext`: `isSuperAdmin` → `isOwner`; everything else (`can`, `ProtectedRoute`, sidebar) unchanged because the backend already scopes data.
3. Employee management screens: owner-only role assignment rules reflected in UI.
4. Hide Permission CRUD; add **Domains** page (subdomain, add custom domain, DNS instructions, verification status, set primary) and **Integrations** page.
5. Socket client: `VITE_SOCKET_URL`, JWT auth.
6. TanStack Query: clear the query cache on login/logout (prevents showing a previous tenant's cached data on a shared machine).

### Phase 10 — Storefront wiring (greenfield, tenant-aware from day one)
1. `proxy.ts`: resolve host, 404 unknown stores, redirect non-primary hosts, rewrite `/api/*` to backend with forwarded host + platform proxy secret.
2. Server data layer replacing `lib/catalog` fixtures; every cache key includes tenant.
3. Per-tenant metadata, icons, robots, sitemap, theme variables.
4. `next.config.ts` `images.remotePatterns` → Cloudinary.
5. Shopper auth via same-origin cookies.

### Phase 11 — Domains & edge
1. Wildcard DNS `*.mysaas.com` + wildcard TLS.
2. Domain provider adapter (Vercel / Caddy `ask` / Cloudflare) per §2.8.
3. DNS verification job + manual "verify now".
4. Primary-domain redirects.

### Phase 12 — Isolation verification & go-live
1. Isolation test suite: two tenants with identical slugs/emails/SKUs; for every route family assert tenant A cannot read, update, delete or aggregate tenant B's data (including reports, dashboard, cache, sockets, webhooks, jobs).
2. Flip plugin from shadow → **fail-closed**; remove `DEFAULT_TENANT_ID` fallback.
3. Provision a real second test tenant on staging with a custom domain end-to-end.
4. Load test the host-resolution path and dashboard aggregations with `tenantId` leading indexes.
5. Then sell tenant #2.

---

## 5. Migration Plan

Goal: convert the existing single-tenant ("Velor") data with **no data loss and no downtime**, using expand → backfill → contract. Every step is reversible until M6.

### M0 — Prepare
- Full backup (Atlas snapshot or `mongodump`) and restore drill on staging from that backup.
- Record per-collection document counts and a few checksums (e.g. total `Sales.grandTotal`, count of customers, latest counter `seq` values) for post-migration verification.
- Create the `Tenant` document for Velor (`slug: velor`), its owner mapping, and `TenantDomain` rows for the current storefront/dashboard hosts. Set `DEFAULT_TENANT_ID`.

### M1 — Expand (deploy code, no data change)
- Deploy Phases 1–3: `tenantId` field optional, plugin in shadow mode, compatibility fallback to Velor.
- From this moment **all new writes** get `tenantId = Velor`. Reads are unchanged because unscoped and Velor-scoped results are identical while one tenant exists.

### M2 — Backfill `tenantId`
- For each tenant-scoped collection (Appendix A), in batches of ~1,000 by `_id`: set `tenantId = Velor` where `tenantId` is missing. Idempotent; safe to re-run; throttled to avoid replication lag.
- Verify: `countDocuments({ tenantId: { $exists: false } }) === 0` per collection; totals equal M0 counts.

### M3 — Counters
- Add `tenantId` to existing `Counter` docs (backfilled in M2), build unique `(tenantId, key)`, then drop the old unique `key` index (done in M4 ordering). `seq` values are preserved, so Velor's next invoice number continues exactly where it left off.
- Copy `env.INVOICE_PREFIX` into `Velor.settings.invoicePrefix` so formatted serials do not change.

### M4 — Indexes (build new before dropping old)
1. Build every compound index from Appendix B (`{ tenantId: 1, <field>: 1 }`, unique where the old one was unique; sparse/partial preserved). Atlas/4.2+ index builds do not block reads/writes; run one at a time.
2. Add `tenantId`-leading variants of hot query indexes (e.g. `{ tenantId, isActive, createdAt }` on Product, `{ tenantId, date }` on Purchase, `{ tenantId, createdAt }` on AuditLog).
3. Update the Atlas `vector_index` definition to include `tenantId` as a filter field (Atlas rebuilds in the background; `retrieve()` keeps working without the filter until Phase 6 ships).
4. **Only after** code no longer depends on them (end of Phase 5), drop the old global unique indexes. Because all data belongs to one tenant, the new compound uniques cannot fail on existing data.
5. Fix `User.phone` to a partial unique index (`phone` exists) — pre-check for duplicate `null`s first.

### M5 — Roles, users, auth cutover
- Existing roles get `tenantId = Velor` (M2). The `superadmin` role in Velor is renamed/re-slugged to the tenant `owner` role (or `owner` is created and the current superadmin user moved to it — see Open Questions); other roles unchanged.
- Existing users (staff and shoppers) already have `tenantId` from M2.
- Create the platform admin in `PlatformUser` (separate from Velor's superadmin).
- Tokens: deploy `tid`-aware auth that **accepts legacy tokens without `tid` for one refresh period (15 days)** by resolving the user by `id` and reading `user.tenantId`; new tokens always include `tid`. After 15 days, remove the legacy path.
- Redis: tenant-prefixed keys make old keys unreachable; they expire by TTL (or flush the cache namespace once at deploy).
- Webhooks: register new `/:webhookKey` URLs with Pathao/Steadfast/SSLCommerz for Velor; keep old URLs mapped to Velor until providers are updated, then remove.

### M6 — Contract
- Make `tenantId` `required` + `immutable` in schemas.
- Flip the plugin to fail-closed; remove `DEFAULT_TENANT_ID` fallback.
- Remove legacy token path, legacy webhook routes, old global indexes (if not already dropped).
- Re-verify M0 counts/checksums; spot-check Velor dashboard totals and reports against pre-migration exports.

### Rollback
- Through M5: roll back application code; extra `tenantId` fields and extra indexes are harmless to old code. **Do not drop old global unique indexes until you are confident**; that is the only step that needs a rebuild to undo.
- Backfill scripts only add fields; no field is renamed or removed before M6.

### Existing seeders/backfills
- `roleSeeder`, `permissionSeeder`, `rolePermissionSeeder`, `seedUsers`, `deliverySeeder`, `addSuperAdminSeeder`, and all `backfill:*` scripts: become tenant-parameterized (`--tenant velor`) or platform-only. `addSuperAdminSeeder` is replaced by the platform-admin seed + tenant provisioning.

---

## 6. Open Questions

**Blocking** = needed before Phase 1 starts.

| # | Question | Options | Recommendation |
|---|---|---|---|
| Q1 **Blocking** | Isolation model | (a) shared DB + `tenantId` (b) DB-per-tenant (c) shared now, dedicated DB for large tenants later | (a), keep (c) possible |
| Q2 **Blocking** | Platform domain name and naming scheme | `{slug}.mysaas.com` vs `{slug}.shop.mysaas.com`; dashboard `app.` vs `admin.`; API `api.` | `{slug}.<platform-domain>`, `app.`, `api.`; reserved-slug list |
| Q3 **Blocking** | Where will the storefront (Next.js) be hosted? | Vercel / same VPS / other | Drives domain provider choice (§2.8) |
| Q4 **Blocking** | Is production MongoDB Atlas? (`$vectorSearch` implies yes; Docker sample implies self-hosted) | — | Confirm; affects vector index and index-build procedure |
| Q5 | Dashboard tenant identification at login | (a) workspace slug field (b) per-tenant dashboard hostname `velor.app.mysaas.com` (c) globally unique staff identity with memberships in multiple tenants | (a) now; (c) only if one person must work for several tenants |
| Q6 | Can one email be both staff and shopper in the same tenant? | Same `User` doc vs separate records | Same doc (current model), role-less = shopper |
| Q7 | Rename existing `superadmin` in Velor | Rename to `owner` vs keep label but change semantics | Rename slug to `owner`; show "Owner" in UI |
| Q8 | Keep default roles `user`, `guest`? (they overlap with shopper/guest concepts) | Keep / remove from tenant template | Remove from staff role template |
| Q9 | Does a tenant have multiple outlets/branches? (`StoreInformation` has list + activate/deactivate; `OutletInformation` exists) | One store per tenant vs many outlets per tenant | Clarify; if many, outlet becomes a second scoping dimension for stock/sales later (not in this plan) |
| Q10 | Payments: each tenant uses their own SSLCommerz account, or platform collects and settles? | Own account vs marketplace | Own account (no money handling liability) |
| Q11 | SMS/email: tenant credentials or platform account with metered quota? | — | Platform default + quota; optional own credentials |
| Q12 | Platform console: separate small app, or `/platform` area inside the dashboard build? | — | Separate small app (smaller blast radius, separate auth) |
| Q13 | Legacy `UserPermission` model/routes | Retire vs migrate | Retire after confirming the dashboard does not use it |
| Q14 | Apex custom domains (`pizzashop.com` without `www`) supported? | Yes (needs A/ALIAS + static IP) / `www` only with redirect | `www` primary; apex via redirect |
| Q15 | Billing/plan enforcement in scope now? | — | Store `plan`/`limits` now, enforce only staff count; billing later |
| Q16 | Tenant data retention on cancellation | Immediate delete / N-day grace / export on request | 30-day grace + export |
| Q17 | Frontend routing rework? | Full rework vs light | **Light**: dashboard keeps its routes; storefront adds `proxy.ts` + tenant-aware data layer while being wired to the API for the first time |
| Q18 | Uncommitted CORS change in working tree | Commit as-is before this work | Commit it; allowlist stays static under the same-origin storefront proxy design |

---

## Appendix A — Model Inventory

**Global (no `tenantId`)**
- `Permission` (module catalog)
- New: `Tenant`, `TenantDomain`, `PlatformUser`, `PlatformAuditLog`, `migrations`

**Tenant-scoped (add `tenantId`)**

| Domain | Models (file) |
|---|---|
| Identity & RBAC | `User` (user.model), `Role` (role.model), `UserPermission` (userPermisson.model — legacy) |
| Catalog | `Category`, `Subcategory`, `Brand`, `Product`, `Variant`, `SizeChart`, `Review` |
| Promotions & content | `Discount`, `Coupon`, `Banner`, `discountBanner`, `SiteInformation`, `StoreInformation`, `OutletInformation` |
| Storefront commerce | `Cart`, `Wishlist`, `Order`, `Invoice`, `Delivery` |
| POS sales | `Sales`, `SalesReturn`, `ByReturn` (byReturnSale), `CustomerType`, `Customer`, `CustomerPaymentRecived`, `CustomerAdvancePaymentRecived` |
| Purchasing & stock | `Purchase`, `PurchaseReturn`, `Supplier`, `SupplierDuePayment`, `StockAdjust` |
| Accounting | `Account`, `CrateTransaction`, `TransitionCategory`, `MoneyTransfer`, `FundHandoverDescription`, `DailyCashSummary` |
| HR | `Employee`, `EmployeeAdvancePayment`, `EmployeeDesignation`, `Department`, `Section` (advancePayment.model) |
| Couriers & messaging | `Merchant` (marchant.model), `CourierReturn`, `SmsLog` |
| System | `Counter`, `auditlog` (auditLog.model) |

---

## Appendix B — Unique Constraints to Re-scope

All become `{ tenantId: 1, <field>: 1 }` unique (keeping `sparse`/partial behavior where present). Application-level "already exists" checks in pre-save hooks become tenant-scoped automatically through the plugin.

| Model | Currently globally unique |
|---|---|
| User | `email`, `phone` (also fix: partial index, see D9) |
| Role | `name`, `slug` |
| Product | `name`, `slug`, `sku` (sparse), `barCode` (sparse) |
| Variant | `slug` (+ `sku`/`barCode` indexes → tenant-leading) |
| Category / Subcategory / Brand | `slug` |
| SizeChart | `slug` |
| Discount / Banner / discountBanner | `slug` |
| Coupon | `code`, `slug`, serial |
| SiteInformation / StoreInformation / OutletInformation | `slug` |
| Customer | `customSerialId` (sparse), `customerId`, `mobileNumber` |
| CustomerPaymentRecived / CustomerAdvancePaymentRecived | `paymentId` |
| Supplier / SupplierDuePayment | supplier ID fields, `transactionId` |
| Purchase | `invoiceNumber` + purchase serial |
| PurchaseReturn / SalesReturn | return serial / `returnId` |
| Sales | `invoiceNumber` |
| ByReturn | `slug` |
| Invoice | `invoiceId`, `order` |
| Employee | `employeeId`, `mobile` |
| EmployeeDesignation / Department / Section | `slug` |
| Account / TransitionCategory | `slug` |
| CrateTransaction | `transactionSerialId` |
| MoneyTransfer | `transferSerialId` |
| FundHandoverDescription | `handoverSerialId` |
| DailyCashSummary | `date` |
| Merchant | `merchantID` |
| Delivery | `name` (enforced in hook only) |
| Counter | `key` |

> Verify exact field names for the few rows described as "serial"/"ID fields" when writing the M4 index script; they were identified by line position in the model files.
