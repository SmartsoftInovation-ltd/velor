# Multi-Tenant Architecture — Backend + Dashboard

> Companion to [`multi-tenant-plan.md`](./multi-tenant-plan.md). That file is the big-picture plan; **this file is the build guide for the backend and the dashboard only.** The Next.js storefront is the next stage and is only referenced where the backend must be ready for it.
>
> Status: **Design — no code written yet.** Date: 2026-09-17

---

## সংক্ষেপে (Quick summary)

- একটাই database; প্রতিটা business document এ `tenantId` থাকবে। একটা Mongoose plugin নিজে থেকেই প্রতিটা query তে `tenantId` filter বসাবে — tenant না জানলে query চালাবেই না (fail-closed)।
- **Platform owner (আপনি)** আলাদা account দিয়ে login করবেন, seller (tenant) তৈরি করবেন, তার owner account বানাবেন, আর API দিয়ে seller-এর SMS, invoice prefix, SSLCommerz, order hotline, courier key/secret, email, **Cloudinary, Groq API key** — সব **per-seller settings** হিসেবে assign করবেন।
- এই values আর `.env` এ থাকবে না। Database এ `TenantSettings` এ থাকবে, secret গুলো **encrypted** থাকবে, API কখনো secret ফেরত দেবে না (শুধু `••••1234`)।
- `.env` এ থাকবে শুধু platform-level জিনিস (DB, Redis, JWT secret, encryption key, public URL)। কোনো seller-এর third-party key `.env` এ থাকবে না।
- Dashboard: একটাই build (`app.<domain>`)। Login এ workspace (store ID) লাগবে। Tenant owner তার staff add/remove করবে; staff শুধু নিজের tenant এর data দেখবে।
- Platform console (`platform.<domain>`) আলাদা ছোট app — tenant তৈরি, settings assign, suspend।

---

## Table of Contents

0. [Decisions Locked In](#0-decisions-locked-in)
1. [System Topology on the VPS](#1-system-topology-on-the-vps)
2. [Backend: Tenant Isolation Layer](#2-backend-tenant-isolation-layer)
3. [Backend: Identity, Auth and Tokens](#3-backend-identity-auth-and-tokens)
4. [Backend: RBAC per Tenant](#4-backend-rbac-per-tenant)
5. [Per-Seller Settings (SMS, Invoice Prefix, SSLCommerz, Hotline, Couriers, Email)](#5-per-seller-settings)
6. [Backend: Cross-Cutting Subsystems](#6-backend-cross-cutting-subsystems)
7. [Dashboard Architecture (Tenant Dashboard)](#7-dashboard-architecture-tenant-dashboard)
8. [Platform Console](#8-platform-console)
9. [Security Issues Found — Fix First](#9-security-issues-found--fix-first)
10. [Implementation Order](#10-implementation-order)
11. [Migrating Velor (the existing data)](#11-migrating-velor-the-existing-data)
12. [Test Checklist](#12-test-checklist)
13. [Open Questions](#13-open-questions)

---

## 0. Decisions Locked In

| Topic | Decision |
|---|---|
| Hosting | Everything on the VPS (API, workers, dashboard static build, platform console, later the storefront) |
| Current scope | Backend + dashboard. Storefront later. |
| Isolation model | Shared MongoDB database, `tenantId` on every business document, fail-closed Mongoose plugin |
| Per-seller configuration | Stored per tenant in the database, assigned by the platform owner via API/console, secrets encrypted. Includes **every** third-party account: SMS, email, SSLCommerz, couriers, **Cloudinary**, **Groq**. No platform-shared third-party accounts. |
| Dashboard deployment | One build for all tenants at `app.<domain>` |
| Platform owner identity | Separate `PlatformUser` collection and login — never a row in `User` |

`<domain>` below = your platform domain (still to be chosen, see Open Questions).

---

## 1. System Topology on the VPS

```
                         Internet
                            │
                  ┌─────────▼──────────┐
                  │  Nginx (or Caddy)  │  TLS for api., app., platform.
                  └──┬──────┬───────┬──┘  (later: *.<domain> + custom domains)
                     │      │       │
   api.<domain> ─────┘      │       └───── platform.<domain>
   proxy → 127.0.0.1:3000   │              static: platform-console/dist
   (+ WebSocket upgrade)    │              (IP allowlist recommended)
                            │
                   app.<domain>
                   static: dashbaord/dist (SPA fallback to index.html)

   pm2:
     api            node index.js            (Express + Socket.io)
     worker-image   src/workers/image.worker.js
     worker-sms     src/workers/sms.worker.js
     worker-email   src/workers/email.worker.js
     worker-audit   src/workers/audit.worker.js
     worker-embed   src/workers/embedding.worker.js

   MongoDB (replica set / Atlas)  — not publicly exposed
   Redis                          — bind 127.0.0.1 only
```

Notes:
- `app.<domain>` and `api.<domain>` share the same registrable domain, so they are **same-site**. The refresh-token cookie can move from `sameSite: none` to `sameSite: lax`, which no longer depends on third-party cookies.
- If `api` later runs in pm2 **cluster** mode, Socket.io needs sticky sessions and the Redis adapter. Keep it single-instance (fork mode) until needed.
- `vercel.json` in `dashbaord/` becomes unused. Nginx needs the equivalent SPA fallback (`try_files $uri /index.html`).
- CORS allowlist (the `cors.config.js` change that isn't committed yet): `https://app.<domain>`, `https://platform.<domain>`. The storefront will use a same-origin proxy later, so this list stays short.

---

## 2. Backend: Tenant Isolation Layer

### 2.1 New backend files (proposed layout)

```
backend/src/
  tenancy/
    context.js                 AsyncLocalStorage: getTenantId(), runForTenant(), runAsPlatform()
    tenantPlugin.js            Mongoose plugin (query/aggregate/save/insertMany/bulkWrite hooks)
    registry.js                list of tenant-scoped vs global models (checked in CI)
  middleware/
    resolveTenant.middleware.js
    platformGuard.middleware.js
  models/platform/
    tenant.model.js
    tenantSettings.model.js
    tenantDomain.model.js      (used when the storefront arrives)
    platformUser.model.js
    platformAuditLog.model.js
  settings/
    crypto.js                  AES-256-GCM encrypt/decrypt, key versions, last4 mask
    settings.service.js        getSettings(tenantId), cache, invalidation (Redis pub/sub)
    settings.schema.js         Joi schemas per section
  integrations/
    sms.client.js              getSmsClient(tenantId)
    mailer.client.js           getMailer(tenantId)
    sslcommerz.client.js       getSslCommerz(tenantId)
    courier.factory.js         getCourier(tenantId, provider)
    cloudinary.client.js       getCloudinary(tenantId)  (replaces the global cloudinary.config in helpers/cloudinary.js)
    groq.client.js             getGroq(tenantId)        (replaces process.env.GROQ_API_KEY in utils/llm.js)
  controller/platform/
    tenant.controller.js
    tenantSettings.controller.js
  routes/platform/
    index.js                   mounted at /api/v1/platform
```

### 2.2 Request lifecycle

```
request
  → helmet / cors / cookies / rate-limit                (existing)
  → route match
      /api/v1/platform/*   → platformGuard → runAsPlatform(handler)
      /api/v1/hooks/*      → tenant from :webhookKey → runForTenant(handler)
      /api/v1/*            → authGuard (staff)  → tenant = token.tid
                             guestOrAuth/public → tenant = host (storefront stage) or X-Tenant header
                             → runForTenant(tenantId, handler)
  → controller (unchanged code) → Mongoose calls → tenantPlugin injects tenantId
```

The middleware opens the tenant context. Controllers stay almost unchanged. That's the reason for this design: 46 route files, ~850 queries and ~110 aggregation pipelines don't need hand editing.

### 2.3 Tenant plugin rules

| Operation | Behavior |
|---|---|
| `find`, `findOne`, `findById`, `countDocuments`, `distinct`, `exists` | Add `tenantId` to filter |
| `updateOne/Many`, `findOneAndUpdate`, `replaceOne`, `deleteOne/Many`, `findOneAndDelete` | Add `tenantId` to filter; on upsert, `tenantId` goes into the inserted doc |
| `save` / `create` | New doc: set `tenantId` from context. Existing doc: throw if `tenantId` ≠ context |
| `insertMany`, `bulkWrite` | Stamp/inject on every document/operation |
| `aggregate` | Insert `$match: { tenantId }` as the first stage (after `$vectorSearch`/`$geoNear` which must stay first; `$vectorSearch` gets `filter.tenantId`) |
| `populate` | Scoped automatically (runs `find` on the ref model) |
| `estimatedDocumentCount`, `Model.collection.*` | Forbidden on tenant models (lint rule). Fix `workers/audit.worker.js:28`. |
| No tenant in context and not `runAsPlatform` | **Throw** (after the shadow-mode period, see §10) |

`tenantId`: `ObjectId`, `required`, `immutable`, `index: true`. It's never accepted from a request body. Existing Joi validators must strip it.

### 2.4 Which models get `tenantId`

All business models **except** `Permission`: 50 models. The full list is in `multi-tenant-plan.md` Appendix A, and the unique indexes that must become `{ tenantId, field }` are in Appendix B.

Global models (no `tenantId`): `Permission`, `Tenant`, `TenantSettings` (it *has* a `tenantId` but is read only via the settings service, not the plugin), `TenantDomain`, `PlatformUser`, `PlatformAuditLog`.

### 2.5 Tenant model

| Field | Notes |
|---|---|
| `name` | "Velor", "Pizzashop" |
| `slug` | Unique. Used as the **workspace ID** at dashboard login and later as the subdomain. Lowercase `a-z0-9-`, 3–30 chars, reserved list (`www`, `app`, `api`, `platform`, `admin`, `mail`, …) |
| `status` | `provisioning` · `active` · `suspended` · `cancelled` |
| `ownerUserId` | ref `User` |
| `plan`, `limits` | `maxStaff`, `maxOutlets`, `smsMonthlyQuota` (enforce only `maxStaff` now) |
| `webhookKey` | Random 32-byte URL-safe string, unique. Used in webhook/callback URLs |
| `createdBy` | ref `PlatformUser` |
| timestamps | |

---

## 3. Backend: Identity, Auth and Tokens

### 3.1 Principals

| Principal | Collection | Login endpoint | Token audience |
|---|---|---|---|
| Platform owner/staff | `PlatformUser` | `POST /api/v1/platform/auth/login` | `platform` (separate secret: `PLATFORM_ACCESS_TOKEN_SECRET`) |
| Tenant owner / employee | `User` (`tenantId`, `roles` non-empty) | `POST /api/v1/auth/login` | `staff` |
| Shopper (storefront, later) | `User` (`tenantId`, no staff roles) | storefront login | `shopper` |

### 3.2 Staff login flow

```
Dashboard SignIn form:  workspace = "pizzashop"   email/phone   password
        │
        ▼
POST /api/v1/auth/login  { workspace, email | phone, password }
  1. Tenant.findOne({ slug: workspace })        → not found / not active → generic "Invalid credentials" (or "Store suspended")
  2. runForTenant(tenant._id):
       User.findOne({ email } or { phone })     → plugin adds tenantId
  3. password check, blocked/inactive check      (existing logic)
  4. must hold at least one staff role (shoppers cannot log into the dashboard)
  5. issue tokens (below), set refresh cookie, return { accessToken, user, tenant }
```

### 3.3 Token claims

| Token | Claims |
|---|---|
| Access (1d, as today) | `sub` (user id), `tid` (tenant id), `aud: "staff"`, `tv` (token version) |
| Refresh (15d, cookie) | `sub`, `tid`, `aud`, `tv` |

- Remove `email`, `name`, `phone` from the token. `authGuard` loads the user **by `sub` inside tenant `tid`**, replacing today's `email OR phone` lookup, which picks the wrong user once emails repeat across tenants.
- `tv` = `User.tokenVersion`. Increment it to force logout (password change, deactivate, role change, tenant suspension). `authGuard` rejects when `tv` does not match.
- Refresh also re-checks `Tenant.status === "active"`.
- Cookie: `httpOnly`, `secure`, `sameSite: "lax"`, `path: "/api/v1/auth"`, host-only on `api.<domain>`.

### 3.4 `GET /auth/getme` response (new shape)

```
{
  user:   { _id, name, email, phone, image, roles[{_id,name,slug}], isOwner },
  tenant: { _id, name, slug, logo, status },
  permissions: { "<module-slug>": ["view","add","edit","delete"], ... },   ← effective, computed on server
  features: { sms: true, email: true, sslcommerz: false,
              couriers: { pathao: true, steadfast: false },
              cloudinary: true, ai: false }                               ← which settings are configured
}
```

The server computes the **effective** permissions (roles ∪ direct grants), the same way `authorize()` does. Today the dashboard's `AuthContext.buildPermissionMap` reads only direct user permissions and ignores role permissions, while the backend unions both. The new response removes that mismatch.

---

## 4. Backend: RBAC per Tenant

| Item | Design |
|---|---|
| `Permission` | Global module catalog. Read-only for tenants. Create/edit only via platform API. |
| `Role` | Tenant-scoped. Unique `{tenantId, slug}`, `{tenantId, name}`. |
| Reserved role `owner` | Replaces `superadmin`. Bypasses permission checks **only inside its tenant**. Created by provisioning, never via tenant API. Exactly one owner user per tenant (transfer via platform). |
| Default roles | On provisioning, copy a template: `admin`, `manager`, `salesmen` (drop `user`/`guest` — those are shopper concepts). Tenant can edit its own copies. |
| `authorize()` | 1) `req.user.tenantId` equals context tenant 2) owner → allow 3) effective permissions check |
| Escalation guard | A non-owner can only assign roles/permissions that are a subset of their own effective permissions. Only the owner can create/edit/delete roles that include `create-user`. Nobody can assign `owner`. |
| Staff limit | `addUser` rejects when active staff count ≥ `tenant.limits.maxStaff` |
| Employee lifecycle (tenant API) | add, edit, deactivate/activate (bumps `tokenVersion`), delete (soft), reset password (owner only) |
| Legacy | Retire `UserPermission` model + `/userpermission` routes after confirming the dashboard does not call them |
| Seeder | `addSuperAdminSeeder.js` (hardcoded `Sadmin@123`) is replaced by `seed:platform-admin` (credentials from CLI prompt/env) + tenant provisioning |

---

## 5. Per-Seller Settings

Each seller needs different SMS keys, invoice prefix, SSLCommerz store, order hotline, courier credentials and email. You (the platform owner) assign them by API call, and they are resolved at runtime per tenant.

### 5.1 What moves out of `.env`

| Current env / source | Used in | New settings field | Secret? |
|---|---|---|---|
| `INVOICE_PREFIX` (`env.config.js`) | Serial generators in `sales`, `salesReturn`, `purchase`, `purchaseReturn`, `supplier` (×2), `customer` (×3), `coupon`, `crateTransaction`, `employee`, `moneyTransfer`, `fundHandoverDescription` models; `order.controller.js:227` | `general.invoicePrefix` | no |
| `ORDER_HOT_LINE_NUMBER` | `order.controller.js:344` (order SMS text) | `general.orderHotline` | no |
| `FACEBOOK_URL` | `emailTemplate/orderTemplate.js:164` | `general.facebookUrl` | no |
| `FRONTEND_URL` (in emails) | `user.controller.js:263,336`, `orderTemplate.js:162` | `general.storefrontUrl` (later derived from primary domain) | no |
| `BULK_SMS_URL`, `BULK_SMS_API_KEY`, `BULK_SMS_SENDER_ID` | `helpers/sms.js`, `sms.controller.js:58` (balance URL hardcoded to bulksmsbd.net) | `sms.provider`, `sms.apiUrl`, `sms.balanceUrl`, `sms.apiKey`, `sms.senderId` | `apiKey` |
| `HOST_MAIL`, `HOST_APP_PASSWORD` | `user.controller.js:259,332` | `email.smtp.user`, `email.smtp.password` | `password` |
| **Hardcoded Gmail credentials** | `helpers/nodemailer.js` | `email.*` (see §9) | yes |
| `SSLC_STORE_ID`, `SSLC_STORE_PASSWORD`, `NODE_ENV` for live flag | `order.controller.js:397`, `payment.controller.js:87` | `payment.sslcommerz.storeId`, `.storePassword`, `.isLive` | `storePassword` |
| `BACKEND_URL` (SSLCommerz callbacks) | `order.controller.js:373-376` | Built from platform `API_PUBLIC_URL` + `tenant.webhookKey` (not a tenant setting) | — |
| `Merchant` collection (courier creds, global) | `courier.controller.js`, `service/couriers/*` | `couriers.pathao.*`, `couriers.steadfast.*` | secrets/tokens |
| `WEBHOOK_SECRET` + hardcoded fallback | `PathaoCourier.js:206-212` | `couriers.pathao.webhookSecret` | yes |
| `STEADFAST_API_KEY` | `SteadFastCourier.js:126` | `couriers.steadfast.webhookToken` | yes |
| `VITE_*_WEBHOOK_SECRET` (dashboard bundle!) | `dashbaord/src/components/courier/CourierForm.tsx:38-42` | removed from dashboard; backend-only | yes |
| `CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | `helpers/cloudinary.js` (global `cloudinary.config` at load); callers: `workers/image.worker.js` and the banner, brand, category, customer, discountBanner, outletinformation, siteinformation, storeInformation, user controllers | `cloudinary.cloudName`, `cloudinary.apiKey`, `cloudinary.apiSecret` | `apiSecret` |
| `GROQ_API_KEY` (+ hardcoded model `llama-3.3-70b-versatile`) | `utils/llm.js` → `chat.controller.js` | `ai.groq.apiKey`, `ai.groq.model` | `apiKey` |

### 5.2 What stays in `.env` (platform-level)

| Env var | Purpose |
|---|---|
| `DATABASE_URL`, `REDIS_URL`, `PORT`, `NODE_ENV` | infra |
| `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET` (fix the `SCCERET` typo during migration, accept both for one release) | staff/shopper JWT |
| `PLATFORM_ACCESS_TOKEN_SECRET` | platform JWT |
| `SETTINGS_ENCRYPTION_KEYS` | e.g. `v1:<base64 32 bytes>,v2:<base64 32 bytes>` — key ring for secret fields |
| `SETTINGS_ACTIVE_KEY_VERSION` | which key encrypts new writes |
| `API_PUBLIC_URL` | `https://api.<domain>` — base for webhook/callback URLs |
| `APP_URL`, `PLATFORM_URL` | CORS + email links for staff |
| `PLATFORM_SMTP_*` (optional) | Default sender for tenants without their own SMTP (password reset, staff invites) |

`.env` holds **no seller's third-party credentials** (no Cloudinary, Groq, SMS, SSLCommerz, courier or SMTP keys belonging to a seller).

### 5.3 `TenantSettings` document (one per tenant)

| Section | Field | Type | Secret | Validation |
|---|---|---|---|---|
| **general** | `invoicePrefix` | string | | `^[A-Z0-9]{2,8}$`, uppercase |
| | `orderHotline` | string | | BD phone `^(\+8801\|01)\d{9}$` |
| | `facebookUrl` | string | | https URL, optional |
| | `storefrontUrl` | string | | https URL, optional |
| | `currency`, `timezone` | string | | default `BDT`, `Asia/Dhaka` |
| **sms** | `enabled` | boolean | | |
| | `provider` | enum | | `bulksmsbd` (extendable) |
| | `apiUrl`, `balanceUrl` | string | | https/http URL |
| | `apiKey` | secret | ✔ | required when enabled |
| | `senderId` | string | | required when enabled |
| **email** | `mode` | enum | | `platform` (use platform SMTP) · `smtp` (tenant's own) · `disabled` |
| | `fromName`, `fromEmail`, `replyTo` | string | | email format |
| | `smtpHost`, `smtpPort`, `smtpSecure`, `smtpUser` | mixed | | required when `mode=smtp` |
| | `smtpPassword` | secret | ✔ | required when `mode=smtp` |
| **payment.sslcommerz** | `enabled`, `isLive` | boolean | | |
| | `storeId` | string | | required when enabled |
| | `storePassword` | secret | ✔ | required when enabled |
| **couriers.pathao** | `enabled` | boolean | | |
| | `baseUrl` | string | | sandbox/live URL |
| | `clientId`, `username`, `storeId` | string | | |
| | `clientSecret`, `password`, `webhookSecret` | secret | ✔ | |
| **couriers.steadfast** | `enabled`, `baseUrl` | mixed | | |
| | `apiKey`, `secretKey`, `webhookToken` | secret | ✔ | |
| **couriers.redx / paperfly / ecourier** | same pattern, when those integrations are built | | | |
| **cloudinary** | `enabled` | boolean | | |
| | `cloudName` | string | | `^[a-z0-9_-]+$`, required when enabled |
| | `apiKey` | string | | numeric string, required when enabled |
| | `apiSecret` | secret | ✔ | required when enabled |
| | `folder` | string | | default `velor/{tenantSlug}`; optional |
| **ai.groq** | `enabled` | boolean | | |
| | `apiKey` | secret | ✔ | `^gsk_`, required when enabled |
| | `model` | string | | default `llama-3.3-70b-versatile` |
| | `temperature` | number | | 0–1, default 0.3 |
| meta | `tenantId` (unique), `updatedBy` (PlatformUser), `version` (increments on every change), timestamps | | | |

**Secret field storage shape:** `{ ciphertext, iv, authTag, keyVersion, last4, updatedAt }`, never plaintext.

Courier runtime tokens (Pathao `access_token`/`refresh_token`/expiry) are **not settings**. Keep them in Redis at `t:{tenantId}:courier:pathao:token` with a TTL equal to the token's expiry.

### 5.4 Encryption

- AES-256-GCM, random 12-byte IV per field, auth tag stored.
- Key ring from env (`SETTINGS_ENCRYPTION_KEYS`), `keyVersion` saved per field → **key rotation** = add `v2`, set active version, run a re-encrypt script, then remove `v1`.
- Decrypted values exist only in process memory, never in Redis, logs, audit snapshots or API responses.
- Extend `audit.service.js` `REDACTED_FIELDS` with every secret field name. Settings changes write `PlatformAuditLog` entries with **field names only**, never values.
- Back up the encryption keys separately from database backups. Losing the key means re-entering every seller's secrets.

### 5.5 Platform API — assigning settings to a seller

Base: `https://api.<domain>/api/v1/platform` (platform JWT required)

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/tenants` | Create tenant + owner + default roles + empty settings (§8.2) |
| `GET` | `/tenants` · `/tenants/:tenantId` | List / detail |
| `PATCH` | `/tenants/:tenantId` | Name, plan, limits |
| `POST` | `/tenants/:tenantId/suspend` · `/activate` | Status (suspend bumps all staff `tokenVersion`) |
| `GET` | `/tenants/:tenantId/settings` | Full settings, **secrets masked** |
| `PATCH` | `/tenants/:tenantId/settings/general` | Invoice prefix, hotline, Facebook, storefront URL |
| `PATCH` | `/tenants/:tenantId/settings/sms` | SMS provider config |
| `PATCH` | `/tenants/:tenantId/settings/email` | Email mode / SMTP |
| `PATCH` | `/tenants/:tenantId/settings/payment/sslcommerz` | SSLCommerz |
| `PATCH` | `/tenants/:tenantId/settings/couriers/:provider` | `pathao` · `steadfast` · … |
| `PATCH` | `/tenants/:tenantId/settings/cloudinary` | Seller's own Cloudinary account |
| `PATCH` | `/tenants/:tenantId/settings/ai/groq` | Seller's own Groq key/model |
| `POST` | `/tenants/:tenantId/settings/:section/test` | Live check: send a test SMS / verify SMTP / SSLCommerz session init in sandbox / Pathao token issue / Steadfast balance / Cloudinary `api.ping` with the seller's credentials / Groq `GET /openai/v1/models` with the seller's key |
| `GET` | `/tenants/:tenantId/settings/webhooks` | Shows the URLs to paste into Pathao/Steadfast/SSLCommerz panels |

`PATCH` is the "post kore assign kora" step. It creates the section if missing and updates only the fields sent.

**Write semantics for secrets:**
- Field **omitted** → keep the existing value (you never have to resend secrets to change `senderId`).
- Field set to a **string** → encrypt and replace.
- Field set to **`null`** → clear it (the section becomes invalid if it's enabled and the field is required).

**Example: assign SMS to Pizzashop**

Request `PATCH /platform/tenants/66f0…a1/settings/sms`
```json
{
  "enabled": true,
  "provider": "bulksmsbd",
  "apiUrl": "http://bulksmsbd.net/api/smsapi",
  "balanceUrl": "http://bulksmsbd.net/api/getBalanceApi",
  "apiKey": "pizzashop-real-api-key",
  "senderId": "8809617xxxxxx"
}
```

Response `200`
```json
{
  "section": "sms",
  "version": 7,
  "data": {
    "enabled": true,
    "provider": "bulksmsbd",
    "apiUrl": "http://bulksmsbd.net/api/smsapi",
    "balanceUrl": "http://bulksmsbd.net/api/getBalanceApi",
    "apiKey": { "isSet": true, "last4": "-key", "updatedAt": "2026-09-17T10:12:00Z" },
    "senderId": "8809617xxxxxx"
  }
}
```

**Example: general settings**

Request `PATCH /platform/tenants/66f0…a1/settings/general`
```json
{ "invoicePrefix": "PZS", "orderHotline": "01711000000", "facebookUrl": "https://facebook.com/pizzashop" }
```

**Example: SSLCommerz**

Request `PATCH /platform/tenants/66f0…a1/settings/payment/sslcommerz`
```json
{ "enabled": true, "isLive": false, "storeId": "pizza66f0test", "storePassword": "pizza66f0test@ssl" }
```

**Example: Pathao**

Request `PATCH /platform/tenants/66f0…a1/settings/couriers/pathao`
```json
{
  "enabled": true,
  "baseUrl": "https://api-hermes.pathao.com",
  "clientId": "xxxx",
  "clientSecret": "xxxx",
  "username": "owner@pizzashop.com",
  "password": "xxxx",
  "storeId": "123456",
  "webhookSecret": "generated-or-from-pathao"
}
```

**Example: Cloudinary**

Request `PATCH /platform/tenants/66f0…a1/settings/cloudinary`
```json
{ "enabled": true, "cloudName": "pizzashop-cdn", "apiKey": "123456789012345", "apiSecret": "xxxx", "folder": "pizzashop" }
```

**Example: Groq**

Request `PATCH /platform/tenants/66f0…a1/settings/ai/groq`
```json
{ "enabled": true, "apiKey": "gsk_xxxx", "model": "llama-3.3-70b-versatile" }
```

**Tenant-side (dashboard) settings endpoints**

| Method | Path | Who | Purpose |
|---|---|---|---|
| `GET` | `/api/v1/settings` | owner + `store-settings:view` | Masked settings, no secret metadata beyond `isSet` |
| `PATCH` | `/api/v1/settings/general` | owner | Only fields marked owner-editable (default: `orderHotline`, `facebookUrl`). `invoicePrefix` is platform-only by default. |
| `GET` | `/api/v1/settings/webhooks` | owner | Webhook URLs to paste into courier panels |

Which fields a tenant owner may edit is a policy table in `settings.schema.js`, so you can open up more later (e.g. let owners manage their own SMS key) without changing the architecture.

### 5.6 Runtime resolution

```
controller / worker
   │  getSettings()          ← tenant from context
   ▼
settings.service
   1. in-process LRU (key tenantId, TTL 60 s, holds decrypted object)
   2. miss → TenantSettings.findOne({ tenantId }) → decrypt → cache
   3. on PATCH: version++ → save → publish Redis "tenant-settings:invalidate" { tenantId, version }
      every pm2 process (api + all workers) subscribes and evicts that tenant
```

Integration clients:

| Client | Behavior |
|---|---|
| `getSmsClient()` | Builds the request from `sms.*`; if `!enabled` → throws `FEATURE_NOT_CONFIGURED` (HTTP 422, `code: "SMS_NOT_CONFIGURED"`) |
| `getMailer()` | `mode=smtp` → nodemailer transport cached per `tenantId+version`; `mode=platform` → platform transport with tenant `fromName`/`replyTo`; `disabled` → 422 |
| `getSslCommerz()` | `new SSLCommerzPayment(storeId, storePassword, isLive)` per call; callback URLs = `${API_PUBLIC_URL}/api/v1/hooks/sslcommerz/${tenant.webhookKey}/{success,fail,cancel,ipn}` |
| `getCourier(provider)` | `PathaoCourier`/`SteadFastCourier` constructed from settings instead of a `Merchant` doc; token cache in Redis per tenant |
| `getCloudinary()` | Returns upload/url/delete helpers bound to the tenant's `cloudName`/`apiKey`/`apiSecret`, passed **per call** in the SDK options. Never call global `cloudinary.config()`: one API or worker process serves many tenants at once, so global config would upload seller A's image to seller B's account. Not configured → 422 `CLOUDINARY_NOT_CONFIGURED`. |
| `getGroq()` | Uses `ai.groq.apiKey` + `model`; not configured → 422 `AI_NOT_CONFIGURED` (chat widget hidden). Embeddings stay local (`@xenova/transformers`), no key needed. |
| Serial generators | Read `getSettings().general.invoicePrefix` instead of `env.INVOICE_PREFIX` (15 call sites, listed in §5.1) |

Model hooks run inside the request's tenant context, so they can call `getSettings()`. Replace the synchronous `env.INVOICE_PREFIX` read with an awaited settings read in those `post('save')` hooks.

### 5.7 Invoice prefix rules

- Serials are snapshots: changing `PZS` → `PIZ` affects **only new** documents. Old invoices keep `INV-PZS-01`.
- Counters are per tenant (`{tenantId, key}`), so each seller starts at 1 and never collides with another seller.
- Uniqueness is `{tenantId, invoiceNumber}`, so a prefix change cannot create duplicates.
- Recommended: warn in the console when the tenant already has invoices. Optionally lock the prefix after the first invoice (see Open Questions).

### 5.7.1 Cloudinary account rules

- The image queue runs in a separate worker process. Each job carries `tenantId` (§6), and the worker calls `getCloudinary()` inside `runForTenant`, so every upload goes to that seller's account.
- Every stored image gets `cloudName` next to `url`/`publicId` (existing `imageSchema` in User, Product, Variant, Brand, Category, Banner, SiteInformation, StoreInformation, Employee, Customer…). Deleting or replacing an image uses the account it was uploaded to, not whatever account is configured now.
- **If a seller changes Cloudinary account:** new uploads go to the new account. Old image URLs keep working as long as the old account exists. Deleting an old asset whose `cloudName` no longer matches the current settings is logged and skipped, not an error. Moving old assets is an optional platform script (re-upload + update `url`/`publicId`/`cloudName`).
- Cloudinary is a **required onboarding step**: image upload screens are feature-gated until it's configured, because products, brands, categories and banners all upload images.
- Existing Velor images: the import script (§11) writes the current env account into Velor's settings and backfills `cloudName` on existing image fields.

### 5.8 Webhooks and callbacks per tenant

| Provider | New URL | Verification |
|---|---|---|
| SSLCommerz | `/api/v1/hooks/sslcommerz/:webhookKey/{success,fail,cancel,ipn}` | IPN validated with **that tenant's** store credentials (validation API) |
| Pathao | `/api/v1/hooks/pathao/:webhookKey` | `x-pathao-signature` equals `couriers.pathao.webhookSecret`; echo header from the same secret |
| Steadfast | `/api/v1/hooks/steadfast/:webhookKey` | Bearer token equals `couriers.steadfast.webhookToken` |

`webhookKey` finds the tenant; the secret proves the caller. Old routes (`/courier/pathao-webhook`, `/payment/*`) map to Velor only during migration, then get removed.

### 5.9 Missing-config UX

- `features` in `getme` (§3.4) tells the dashboard which integrations are ready.
- Sidebar items for SMS / courier delivery / online payment show a "Not configured — contact support" state instead of failing on submit.
- Backend returns `422 { code: "SMS_NOT_CONFIGURED" | "SSLCOMMERZ_NOT_CONFIGURED" | "COURIER_NOT_CONFIGURED" | "EMAIL_NOT_CONFIGURED" | "CLOUDINARY_NOT_CONFIGURED" | "AI_NOT_CONFIGURED" }` so the UI can show the right message.
- Image upload is checked **before** the request is accepted (in the controller, not only in the worker). Otherwise the product would be saved and the image job would fail silently in the background.

---

## 6. Backend: Cross-Cutting Subsystems

| Subsystem | Change | File(s) |
|---|---|---|
| Redis cache | All keys and namespace versions prefixed `t:{tenantId}:` from context — one-file change covers every controller | `utils/cache.util.js` |
| Counters | Unique `{tenantId, key}`; plugin scopes existing `Counter.findOneAndUpdate({ key })` calls automatically | `models/counter.model.js` |
| BullMQ | Queue wrapper adds `tenantId` to every job from context; each worker wraps its processor in `runForTenant(job.data.tenantId)`; jobs without `tenantId` fail | `queues/*`, `workers/*` |
| Audit worker | Replace `auditLogModel.collection.insertOne` with model insert (or stamp `tenantId` explicitly) | `workers/audit.worker.js` |
| Socket.io | Handshake auth with the access token; join `tenant:{tid}` and `tenant:{tid}:user:{uid}`; replace `io.emit("orderPlaced")` and `io.emit("sms:bulk:done")` with room emits | `socket/socket.js`, `order.controller.js`, `workers/sms.worker.js` |
| Cloudinary | Per-tenant account via `getCloudinary()` (§5.6, §5.7.1); remove global `cloudinary.config`; add `cloudName` to `imageSchema` | `helpers/cloudinary.js`, `workers/image.worker.js`, image-uploading controllers |
| Groq chat | Per-tenant key via `getGroq()`; per-tenant rate limit on `/chat` | `utils/llm.js`, `chat.controller.js` |
| Auth rate limiter | Key includes workspace slug | `middleware/rateLimit.middleware.js` |
| Vector search | `vector_index` gets `tenantId` filter field; `retrieve()` passes `filter: { tenantId }` | `utils/retrieve.js` |
| Singletons | `SiteInformation.findOne()` / `StoreInformation.findOne()` become per-tenant automatically via the plugin | controllers listed in the main plan §3.1 D4 |
| Seeders/backfills | Accept `--tenant <slug>`; run inside `runForTenant` | `src/seeder/*` |

---

## 7. Dashboard Architecture (Tenant Dashboard)

### 7.1 Principles

1. **The backend is the security boundary.** The dashboard only reflects what `getme` says. No tenant logic is trusted client-side.
2. **One build, all tenants.** No per-tenant builds, no tenant-specific env vars.
3. **Everything tenant-related comes from one place:** a `SessionContext` (evolution of `AuthContext`) holding `user`, `tenant`, `permissions`, `features`.
4. **Nothing survives a session switch:** on login/logout/tenant change, clear the TanStack Query cache, per-tenant localStorage drafts and the socket.

### 7.2 Folder changes (proposed)

```
dashbaord/src/
  context/
    AuthContext.tsx        → SessionContext: user, tenant, permissions, features, isOwner
  hooks/
    useAxiosSecure.tsx     (unchanged interceptor; refresh URL path stays)
    usePermission.ts       isSuperAdmin → isOwner
    useFeature.ts          NEW: useFeature("sms") → boolean
  lib/
    storage.ts             NEW: tenant-namespaced localStorage keys  e.g. "t:pizzashop:product_form_draft"
  socket/
    socket.ts              VITE_SOCKET_URL + auth token, connect after login, disconnect on logout
  components/
    auth/SignInForm.tsx    + workspace field (remembered)
    routes/ProtectedRoute.tsx   + tenant status gate (suspended screen)
    routes/FeatureGate.tsx      NEW: wraps pages needing an integration
  pages/
    Settings/StoreSettings/     NEW: general (owner-editable fields), integration status (read-only), webhook URLs
    AuthPages/StoreSuspended.tsx NEW
```

### 7.3 Sign-in UX

```
┌─────────────────────────────────────┐
│  Workspace   [ pizzashop          ] │  ← remembered in localStorage "lastWorkspace"
│  Email/Phone [ ................... ] │
│  Password    [ ................... ] │
│              [   Sign in   ]        │
│  Not your store? Change workspace   │
└─────────────────────────────────────┘
```

- Optional deep link: `https://app.<domain>/signin?workspace=pizzashop` pre-fills the field (give this link to each seller).
- After login, the header shows the tenant logo and name from `getme.tenant`.

### 7.4 Session & data flow

| Concern | Design |
|---|---|
| Access token | `localStorage["accessToken"]` as today (single session per browser) |
| Refresh | Unchanged single-flight interceptor; 401 with `code: "TENANT_SUSPENDED"` → redirect to `/store-suspended` instead of `/signin` |
| Query cache | `queryClient.clear()` on login and logout; all query keys stay as they are (cache is empty per session) |
| Drafts | `useFormDraft` / `product_form_draft` / `variant_form_draft` keys namespaced by tenant slug + user id (prevents a draft leaking between accounts on a shared shop PC) |
| Permissions | Use `getme.permissions` (effective) — replaces `buildPermissionMap` which ignored role permissions |
| Owner | `isOwner` bypasses UI permission checks (mirrors backend) |
| Features | `useFeature()` / `FeatureGate` hide or disable SMS, courier, online-payment actions when not configured |

### 7.5 Page-by-page changes

| Area | Current | Change |
|---|---|---|
| Sign in | email/phone + password | + workspace; suspended/invalid store messages |
| Header | — | Tenant name/logo; "Store settings" link for owner |
| Sidebar | `can()` based | Same, plus hide **Create Permission** (platform-only); feature-gated items |
| Role & Permission → Create Permission | tenant can CRUD global catalog | **Remove** from tenant dashboard (moves to platform console) |
| Role & Permission → Create Role / Assign | global roles | Tenant roles only (automatic from backend); UI hides `owner`; disable permissions the current user doesn't hold (escalation guard mirror) |
| Users → Add/Edit/List | all users in DB | Tenant staff only (automatic); show staff limit "4 / 10"; owner row locked; "Force logout" action |
| Courier form | Reads `VITE_*_WEBHOOK_SECRET`, tenant enters merchant creds | **Delete secret env usage.** Show integration status + webhook URL from `/settings/webhooks`; credentials are managed by platform (or owner if policy allows later) |
| SMS pages | Uses global key; balance from global key | Feature-gated; balance from tenant SMS key via backend |
| Image uploads (product, variant, brand, category, banner, discount banner, site/store/outlet info, user, employee, customer) | Always enabled | Feature-gated on `features.cloudinary`: upload inputs disabled with a "Cloudinary not configured" note |
| Settings → Site/Store/Outlet information | singleton | Same pages; automatically per tenant |
| New: Store Settings | — | General (hotline, Facebook editable by owner; invoice prefix read-only), Integrations status (✔/✘, `last4`), Webhook URLs |
| New: Store suspended page | — | Shown on `TENANT_SUSPENDED` |
| Socket | `http://localhost:3000`, fake `userId` | `VITE_SOCKET_URL`, token auth, events only for this tenant |

### 7.6 Dashboard env (after)

```
VITE_API_URL=https://api.<domain>/api/v1
VITE_SOCKET_URL=https://api.<domain>
```

Everything else (`VITE_*_WEBHOOK_SECRET`) is deleted.

### 7.7 Build & deploy on the VPS

- `npm run build` → rsync `dist/` to `/var/www/app` → Nginx serves with SPA fallback.
- Long cache for hashed assets, `no-cache` for `index.html` so every tenant gets new releases immediately.

---

## 8. Platform Console

### 8.1 Why a separate small app

- Different users (you and your staff), different login, different token secret. A bug in the tenant dashboard cannot expose platform functions.
- Can be IP-allowlisted in Nginx.
- Can reuse dashboard UI components (copy or a shared folder); keep it small.

**Until the console exists, every platform action works through the API (Postman/curl).** Build the API first (§10 step 4), the UI after.

### 8.2 Create-seller flow (API and future wizard)

```
POST /platform/tenants
{
  "name": "Pizzashop",
  "slug": "pizzashop",
  "plan": "standard",
  "limits": { "maxStaff": 10 },
  "owner": { "name": "Rahim", "email": "rahim@pizzashop.com", "phone": "01711000000" }
}

Server (one transaction, idempotent on slug):
  1. validate slug (format, reserved, unique)
  2. Tenant { status: provisioning, webhookKey: random }
  3. runForTenant:
       default roles from template (+ reserved owner role)
       owner User with a one-time temporary password (or invite link), mustChangePassword = true
       TenantSettings with defaults: general.invoicePrefix = slug-based e.g. "PIZ", all integrations disabled
       StoreInformation/SiteInformation skeleton with the store name
  4. Tenant.status = active
  5. PlatformAuditLog "TENANT_CREATED"
Response: tenant, owner login link  https://app.<domain>/signin?workspace=pizzashop, temporary password (shown once)
```

Then assign settings with the `PATCH …/settings/*` calls from §5.5, and verify each with `POST …/settings/:section/test`.

### 8.3 Console screens

| Screen | Content |
|---|---|
| Login | Platform email + password (+ TOTP recommended) |
| Tenants list | Name, slug, status, plan, staff count, created, integrations ✔/✘ |
| Create tenant wizard | 1 Store info → 2 Owner → 3 General settings → 4 **Cloudinary (required)** → 5 SMS → 6 Email → 7 SSLCommerz → 8 Couriers → 9 Groq AI → 10 Review & create (steps 5–9 skippable) |
| Tenant detail → Overview | Status, plan/limits, owner, suspend/activate |
| Tenant detail → Settings | One card per section: masked values, Edit (write-only secret inputs with "leave blank to keep"), **Test** button, last updated by/at |
| Tenant detail → Webhooks | URLs to paste into Pathao/Steadfast/SSLCommerz |
| Tenant detail → Staff | Read-only list; reset owner password; transfer ownership |
| Tenant detail → Audit | Settings changes (field names only), status changes, impersonation |
| Permissions catalog | Create/edit module permissions (moved from tenant dashboard) |
| Platform users | Your team accounts |

---

## 9. Security Issues Found — Fix First

These exist **today**, before any multi-tenant work:

| # | Issue | Where | Action |
|---|---|---|---|
| S1 | **Gmail address and app password hardcoded and committed** (present since the first `setup` commit, so it is in git history) | `backend/src/helpers/nodemailer.js` | **Revoke that Gmail app password now** in the Google account; move to env/settings. Removing it from the file does not remove it from history. |
| S2 | Pathao webhook secret has a hardcoded fallback value | `backend/src/service/couriers/PathaoCourier.js:212` | Remove fallback; rotate the secret with Pathao |
| S3 | Courier webhook secrets compiled into the dashboard JS bundle | `dashbaord/src/components/courier/CourierForm.tsx:38-42` | Remove `VITE_*_WEBHOOK_SECRET`; rotate those secrets |
| S4 | Superadmin seeder with hardcoded password `Sadmin@123` | `backend/src/seeder/addSuperAdminSeeder.js` | Change that account's password if it exists in production |
| S5 | `authGuard` loads user by `email OR phone` from token | `backend/src/middleware/authMiddleware.js` | Load by `sub` (§3.3) |
| S6 | Socket.io unauthenticated, global broadcasts of orders | `backend/src/socket/socket.js`, `order.controller.js:408` | §6 |
| S7 | Dashboard UI ignores role permissions (backend unions them) | `dashbaord/src/context/AuthContext.tsx` | §3.4, §7.4 |

---

## 10. Implementation Order

Each step is one PR / one conversation. "Done when" is the acceptance check.

| Step | Work | Done when |
|---|---|---|
| **1** | Security fixes S1–S4 (rotate + move to env for now) | No secrets in source; rotated values work |
| **2** | Test harness (in-memory replica set + supertest), `autoIndex: false` in production, migrations runner | `npm test` runs one smoke test |
| **3** | `tenancy/` context + plugin in **shadow mode** (logs, does not throw) + `Tenant` model + Velor tenant created + `tenantId` optional on all models | App behaves exactly as before; logs show unscoped paths |
| **4** | `PlatformUser`, platform auth, `POST/GET/PATCH /platform/tenants` | You can create a tenant via Postman |
| **5** | `TenantSettings` + crypto + settings service + platform settings endpoints + `test` endpoints + **env→settings import for Velor** | Velor's SMS/SSLCommerz/courier/email work from DB settings with env values removed |
| **6** | Replace all env reads with settings (serial generators, SMS, mailer, SSLCommerz, couriers, order hotline, email links, Cloudinary, Groq); per-tenant webhook routes; `Merchant` → settings; `cloudName` on images | grep finds no `INVOICE_PREFIX`, `BULK_SMS_*`, `SSLC_*`, `HOST_MAIL`, `ORDER_HOT_LINE_NUMBER`, `WEBHOOK_SECRET`, `CLOUD_NAME`, `CLOUDINARY_*`, `GROQ_API_KEY`, `cloudinary.config(` in `src/` |
| **7** | Backfill `tenantId` for Velor data; compound unique indexes; counters per tenant | Every document has `tenantId`; new indexes built; old ones still present |
| **8** | Auth: workspace login, new token claims, `authGuard` by `sub`+`tid`, `tokenVersion`, legacy-token grace, `getme` new shape | Dashboard login with workspace works; old sessions refresh cleanly |
| **9** | RBAC: owner role, tenant roles, escalation guard, staff limit, permission CRUD → platform-only | Tests: employee cannot grant more than they have |
| **10** | Cross-cutting: cache prefix, BullMQ tenant context, socket rooms + auth, Cloudinary folders, audit worker, vector index filter | Tests pass with two tenants |
| **11** | Dashboard: SessionContext, workspace sign-in, effective permissions, feature gates, Store Settings page, courier form cleanup, socket, cache clearing, suspended page | Manual run-through as owner and as employee |
| **12** | Provisioning endpoint (full flow §8.2) + second test tenant with identical product names/emails/SKUs | Isolation test suite green |
| **13** | Plugin **fail-closed**; drop old global unique indexes; remove legacy routes/tokens | No shadow-mode warnings for 7 days before flipping |
| **14** | Platform console UI | Create + configure a seller without Postman |
| → next | Storefront (host resolution, domains) | see `multi-tenant-plan.md` Phases 10–11 |

---

## 11. Migrating Velor (the existing data)

1. **Backup** (snapshot/mongodump) + record collection counts and key totals.
2. Create `Tenant { slug: "velor" }` and map the existing superadmin user as owner (rename role slug `superadmin` → `owner` in step 9).
3. **Import env → settings once:** a script reads the current production `.env` values (`INVOICE_PREFIX`, `ORDER_HOT_LINE_NUMBER`, `FACEBOOK_URL`, `BULK_SMS_*`, `SSLC_*`, `HOST_MAIL`/`HOST_APP_PASSWORD`, `WEBHOOK_SECRET`, `STEADFAST_API_KEY`, `CLOUD_NAME`/`CLOUDINARY_API_KEY`/`CLOUDINARY_API_SECRET`, `GROQ_API_KEY`) plus existing `Merchant` documents, and writes Velor's encrypted `TenantSettings`. It also backfills `cloudName` on every existing image field. Then delete those vars from `.env`.
4. Backfill `tenantId = velor` in batches on every collection (idempotent, re-runnable).
5. Counters: existing `seq` values kept → Velor's next invoice number continues exactly where it stopped; prefix is unchanged because it was imported in (3).
6. Build compound indexes → switch code → drop old global unique indexes last.
7. Tokens without `tid` accepted for 15 days (resolve `tenantId` from the user), then removed.
8. Re-register Velor's webhook URLs with Pathao/Steadfast/SSLCommerz (new `/hooks/...` paths); old paths map to Velor until then.
9. Verify counts/totals, run Velor dashboard reports against pre-migration numbers.

---

## 12. Test Checklist

**Isolation (two tenants A and B with the same product name, SKU, customer mobile, staff email, role names)**
- [ ] Staff of A lists products/customers/sales/users/roles → only A's
- [ ] Staff of A requests B's document by `_id` (GET/PUT/DELETE) → 404
- [ ] Every dashboard summary and report endpoint for A excludes B's numbers
- [ ] A's cached list is not served to B (same endpoint, same query)
- [ ] Serial numbers: A and B both start at `…-01` with their own prefixes
- [ ] Socket: A's dashboard never receives B's `orderPlaced`
- [ ] Bulk SMS from A targets only A's users/orders and uses A's SMS key
- [ ] Image/audit/SMS/embedding jobs from A write only A's documents
- [ ] Token from A used with B's workspace/IDs → 401/404
- [ ] Suspended tenant: staff forced out on next request/refresh

**Settings**
- [ ] `GET …/settings` never contains a plaintext secret
- [ ] PATCH without a secret field keeps the old secret
- [ ] PATCH with `null` clears it and marks the section not configured
- [ ] Settings change takes effect in API and every worker within seconds (pub/sub)
- [ ] SMS/SSLCommerz/courier with section disabled → 422 with the right `code`
- [ ] SSLCommerz IPN for A validated with A's credentials only
- [ ] Pathao webhook with B's `webhookKey` and A's secret → rejected
- [ ] Audit log shows changed field names, no values
- [ ] Two tenants uploading images at the same moment → each file lands in its own Cloudinary account (concurrency test against the image worker)
- [ ] Tenant without Cloudinary → upload endpoints return 422 before saving anything
- [ ] Changing a tenant's Cloudinary account: old images still display; new uploads go to the new account
- [ ] Chat for A uses A's Groq key; tenant without Groq → 422 `AI_NOT_CONFIGURED`

**RBAC**
- [ ] Employee with `create-user:add` cannot assign a role holding permissions they lack
- [ ] Nobody can assign/create `owner` via tenant API
- [ ] Staff limit enforced
- [ ] Permission catalog not writable from tenant API

---

## 13. Open Questions

| # | Question | Recommendation |
|---|---|---|
| 1 | Platform domain name (for `api.`, `app.`, `platform.`) | Choose now; needed for cookies, CORS, webhook URLs |
| 2 | Can a tenant owner edit their own integrations (SMS key, courier creds), or only you? | Only you at launch; policy table allows opening later |
| 3 | Lock `invoicePrefix` after the first invoice? | Warn but allow (serials are snapshots) |
| 4 | Email: will every seller bring their own SMTP, or do you provide a platform sender? | Platform sender default (`mode: platform`) + optional own SMTP |
| 5 | SMS: each seller's own bulksmsbd account, or you resell from one account with quotas? | Own account per seller (matches your request); optional platform account later |
| 6 | Should one person be able to work in two stores with the same email? | No for now (one `User` per tenant) |
| 7 | Keep `redx`, `paperfly`, `ecourier` in scope? (dashboard references them, backend has no clients) | Define settings sections only when their clients are built |
| 8 | Is production MongoDB Atlas? (`$vectorSearch` needs it) | Confirm before step 10 |
| 9 | Multiple outlets per tenant (`OutletInformation`, `StoreInformation` lists)? | Out of scope; keep tenant as the only scoping dimension for now |
| 10 | Platform console: separate repo folder `platform-console/` in this monorepo? | Yes |
| 11 | Provide a platform Cloudinary/Groq fallback for sellers who have no account yet? | No, following your requirement; Cloudinary is a required onboarding step, Groq is optional |
