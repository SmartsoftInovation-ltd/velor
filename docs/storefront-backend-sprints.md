# Storefront Backend Sprints — Custom Domain Multi-Tenancy

> ## ✅ সব sprint (S1–S6) সম্পন্ন — 2026-09-18
>
> **ফলাফল:** backend test 443/443 সবুজ (আগে ছিল 370), 52 suite। `migrate:audit` → `ready: true`।
> প্রতিটা sprint-এর guard ইচ্ছা করে bug ঢুকিয়ে যাচাই করা হয়েছে — নিচে §৮ দেখুন।
>
> Frontend এখনো বাকি (আপনার পরিকল্পনা অনুযায়ী)। Backend এখন domain-ready:
> `x-tenant-host` header পেলেই সব কাজ করবে।

> **তারিখ:** 2026-09-18
> **স্কোপ:** শুধু **backend**। Frontend (`frontend/`) এখন design-only, পরে connect হবে।
> **লক্ষ্য:** Backend এমনভাবে তৈরি রাখা যে ভবিষ্যতে frontend শুধু domain-টা জানালেই সব কাজ করবে।
> **সঙ্গী:** [`storefront-multitenant-plan-bangla.md`](./storefront-multitenant-plan-bangla.md) (কেন — বিশ্লেষণ), এই ফাইল (কী — কাজের তালিকা)।

---

## ০. আপনি যা চেয়েছেন (আমি যা বুঝেছি)

সিদ্ধান্তগুলো নিচে লিখে রাখলাম, যাতে পরে কোনো সন্দেহ না থাকে।

| # | সিদ্ধান্ত | মানে |
|---|---|---|
| ১ | **প্রতিটা seller-এর নিজের custom domain** | `velor.com`, `pizzashop.com` — subdomain নয়। তাই DNS verification আর per-domain TLS লাগবে |
| ২ | **Domain-ই tenant পরিচয়** | `velor.com` থেকে order এলে velor-এর `tenantId` নিয়ে save হবে। Browser-এর পাঠানো কিছুর উপর ভরসা নয় — **server `Host` header দেখবে** |
| ৩ | **এখন শুধু backend** | Frontend design-only। `proxy.ts`, API client, storefront UI — এই sprint-এ **নাই**। Backend তৈরি থাকবে, frontend পরে শুধু plug করবে |
| ৪ | **Shopper account + guest — দুইটাই** | Register/login করে order দিতে পারবে, আবার account ছাড়া guest হিসেবেও পারবে |
| ৫ | **Live chat এই sprint-এই** | Visitor chat করবে → ঐ store-এর dashboard-এ যাবে, অন্য কোথাও না |
| ৬ | **DNS TXT verification** | Seller তার DNS-এ TXT record বসাবে, backend check করে domain active করবে। প্রমাণ ছাড়া কোনো domain চালু হবে না |
| ৭ | **`velor.com` আর `www.velor.com` — আলাদা row, এক tenant** | দুইটাই কাজ করবে, `isPrimary` দিয়ে canonical ঠিক হবে |

**এক লাইনে:** domain → tenantId mapping বানাতে হবে, তার উপর public shopper API আর chat দাঁড় করাতে হবে — সব `tenantPlugin`-এর বিদ্যমান isolation ব্যবহার করে।

---

## ১. শুরুর আগে — ভিত্তি যা ইতিমধ্যে আছে

এগুলো নতুন করে বানাতে হবে **না**। Sprint-গুলো এগুলোর উপরেই দাঁড়াবে।

| জিনিস | ফাইল | কাজে লাগবে যেভাবে |
|---|---|---|
| Tenant context | `src/tenancy/context.js:25` `runForTenant()` | নতুন সব entry point এটাই ব্যবহার করবে |
| Fail-closed plugin | `src/tenancy/tenantPlugin.js:54` | context ছাড়া query throw করে — নতুন model-এ নিজে থেকেই `tenantId` বসবে |
| Slug দিয়ে tenant + 30s cache | `src/tenancy/tenantResolver.js:20` | `getTenantByHost()` হুবহু এই প্যাটার্নে লিখব |
| Webhook `:webhookKey` → tenant | `src/middleware/webhookTenant.middleware.js:8` | domain resolution-এর **অনুকরণীয় উদাহরণ** |
| Socket tenant + guest room | `src/socket/socket.js:9,31-35,51` | chat-এর ভিত্তি — guest ইতিমধ্যে connect করতে পারে |
| `emitToTenant` / `emitToUserOrGuest` | `src/socket/socket.js:84,90` | chat এগুলোই ব্যবহার করবে, নতুন broadcast লিখব না |
| Platform API প্যাটার্ন | `src/routes/platform/tenant.api.js:18-26` | domain endpoint একই কাঠামোয় |
| Platform audit | `src/service/platformAudit.service.js:3` | domain add/verify/remove log হবে |
| Per-tenant webhook URL | `src/settings/settings.service.js:263` | payment callback — **বদলাতে হবে না** ✅ |

---

## ২. Sprint ভাগ

৬টা sprint। প্রতিটা আলাদা PR। নির্ভরশীলতার ক্রমে সাজানো।

| Sprint | নাম | কেন এই ক্রমে | আকার |
|---|---|---|---|
| **S1** | `TenantDomain` + Host resolution | সব কিছুর ভিত্তি | মাঝারি |
| **S2** | Platform domain API + DNS verification | S1 ছাড়া অর্থহীন | মাঝারি |
| **S3** | Guest context fix + public catalog | S1 লাগবে | ছোট |
| **S4** | Shopper auth (account + guest) | S1, S3 লাগবে | বড় |
| **S5** | Public checkout + payment redirect | S4 লাগবে | **সবচেয়ে বড়** |
| **S6** | Live chat | S1 লাগবে (S4 নয়) | মাঝারি |

> S6 আসলে S1-এর পরেই করা যায়। চাইলে S4/S5-এর সমান্তরালে চলতে পারে।

---

# Sprint 1 — `TenantDomain` + Host resolution

**লক্ষ্য:** `Host: velor.com` দেখে backend velor-এর tenant context খুলবে।

### ১.১ নতুন model — `src/models/platform/tenantDomain.model.js`

| Field | ধরন | নিয়ম |
|---|---|---|
| `tenantId` | ObjectId, ref `Tenant`, required, indexed | |
| `host` | String, **unique**, required, lowercase, trim | `velor.com`, `www.velor.com` |
| `isPrimary` | Boolean, default `false` | canonical domain |
| `status` | enum `pending`·`verifying`·`active`·`failed`, default `pending` | |
| `verificationToken` | String, immutable, auto-generate | DNS TXT-এ যা বসাতে হবে |
| `verifiedAt` | Date, default `null` | |
| `lastCheckedAt`, `failureReason` | Date, String | কেন verify হয়নি, seller-কে দেখানোর জন্য |
| timestamps | | |

**Index:**
- `{ host: 1 }` **unique** — এক domain দুই tenant-এ যেতে পারবে না (এটাই সবচেয়ে জরুরি guard)
- `{ tenantId: 1, isPrimary: 1 }` — canonical domain দ্রুত বের করতে

**Validation:**
- `host` lowercase + trim, port বাদ (`velor.com:443` → `velor.com`)
- Punycode/IDN normalize (বাংলা domain হলে)
- Platform-এর নিজের domain (`api.`, `app.`, `platform.`) **reserved** — `tenant.model.js:5-8`-এর `RESERVED_TENANT_SLUGS`-এর মতো একটা reserved host list
- এক tenant-এ একাধিক `isPrimary: true` হতে পারবে না (pre-save hook)

**⚠️ অবশ্যই:** `TenantDomain`-কে `src/tenancy/registry.js:3` এর `GLOBAL_MODELS`-এ যোগ করতে হবে (`Tenant`/`TenantSettings`-এর মতো)। না করলে `tests/integration/tenancyRegistry.test.js` fail করবে — এবং **সেটাই ঠিক**, কারণ এটা control-plane model, tenant data নয়।

### ১.২ `src/tenancy/tenantResolver.js`-এ যোগ

`getTenantByHost(host)` — `getTenantBySlug` (`:20`)-এর হুবহু প্যাটার্নে, একই 30s cache:

```
cache key: `host:<normalized host>`
  → TenantDomain.findOne({ host, status: "active" })   // active ছাড়া কিছু নয়
  → পেলে getTenantById(domain.tenantId)
  → না পেলে null
```

`invalidateTenantCache()` (`:29`) ইতিমধ্যে সব clear করে — domain add/verify/remove-এর পর এটা call করতে হবে।

### ১.৩ `src/middleware/requestTenant.middleware.js` বদল

Precedence (উপর থেকে নিচে):

1. **`x-tenant-host`** header → `getTenantByHost()` — storefront path
2. **`x-tenant`** header → `getTenantBySlug()` — dashboard path (আগের মতোই)
3. কোনোটাই না → context ছাড়া চলবে, strict mode query-তে ধরবে (আগের আচরণ অপরিবর্তিত)

Host পাওয়া গেল কিন্তু কোনো tenant নাই → **404 `DOMAIN_NOT_FOUND`**। Suspended হলে `assertTenantActive` (`tenantResolver.js:33`) নিজেই `TENANT_SUSPENDED` দেবে।

> **নোট:** `authMiddleware.js:46-49`-এর mismatch guard এমনিতেই কাজ করবে — JWT-র `tid` আর Host-এর tenant না মিললে 401। এটা বদলানোর দরকার নাই, শুধু test দিয়ে নিশ্চিত হতে হবে।

### ১.৪ 🚨 নিরাপত্তা — এটা বাদ দিলে পুরো জিনিস ফাঁকা

`x-tenant-host` header **শুধু** আপনার proxy বসাবে। Client যা পাঠায় তা **অবশ্যই** মুছতে হবে, নইলে যে কেউ header পাঠিয়ে অন্য tenant সাজতে পারবে।

Nginx:
```nginx
proxy_set_header x-tenant-host $host;   # client-এর পাঠানো মান overwrite হয়ে যায়
```

দ্বিতীয় স্তরের সুরক্ষা (deploy-এ ভুল হলে ধরা পড়বে):
`TRUST_TENANT_HOST_HEADER=true` env না থাকলে backend `x-tenant-host` **উপেক্ষা** করবে। Production-এ proxy ঠিকঠাক বসানোর পরেই এটা `true` করবেন। এতে ভুলে খোলা থাকলেও attacker কিছু করতে পারবে না।

### ১.৫ Test — `tests/integration/domainResolution.test.js`

- দুই tenant, দুই domain, একই product নাম → প্রতিটা Host নিজের product দেয়
- `www.velor.com` আর `velor.com` → একই tenantId
- অজানা Host → 404 `DOMAIN_NOT_FOUND`
- `status: "pending"` domain → 404 (verify না হলে কাজ করবে না)
- Suspended tenant-এর domain → 403 `TENANT_SUSPENDED`
- **Spoof test:** `TRUST_TENANT_HOST_HEADER` off থাকলে header উপেক্ষিত
- **Mismatch test:** velor-এর JWT + `pizzashop.com` Host → 401
- একই host দুই tenant-এ insert → duplicate key error

**Done when:** উপরের সব test সবুজ, আর ইচ্ছা করে `getTenantByHost`-এ `status: "active"` filter সরিয়ে দিলে pending-domain test fail করে (মানে test সত্যিই পাহারা দিচ্ছে)।

---

# Sprint 2 — Platform domain API + DNS verification

**লক্ষ্য:** আপনি console/Postman থেকে seller-এর domain যোগ করবেন, seller DNS-এ record বসাবে, backend যাচাই করে চালু করবে।

### ২.১ Endpoints — `src/routes/platform/domain.api.js` (নতুন)

`tenant.api.js:18-26`-এর কাঠামো অনুসরণ করে (`platformGuard`, `superadmin`, `validateBody`):

| Method | Path | কাজ |
|---|---|---|
| `GET` | `/platform/tenants/:tenantId/domains` | তালিকা + status |
| `POST` | `/platform/tenants/:tenantId/domains` | domain যোগ (status `pending`, token তৈরি) |
| `POST` | `/platform/tenants/:tenantId/domains/:domainId/verify` | DNS check চালাও |
| `PATCH` | `/platform/tenants/:tenantId/domains/:domainId` | `isPrimary` সেট |
| `DELETE` | `/platform/tenants/:tenantId/domains/:domainId` | সরাও |

`routes/platform/index.js`-এ mount করতে হবে।

**Response-এ seller-কে যা দেখাতে হবে** (`POST` করার পর):
```json
{
  "host": "velor.com",
  "status": "pending",
  "dnsRecord": {
    "type": "TXT",
    "name": "_velor-verify.velor.com",
    "value": "velor-verify=<token>"
  }
}
```

### ২.২ Verification — `src/service/domainVerification.service.js` (নতুন)

Node-এর built-in `dns/promises` (`resolveTxt`) ব্যবহার করুন — নতুন package লাগবে না।

```
_<prefix>-verify.<host> এর TXT record খোঁজো
  → token মিললে: status = "active", verifiedAt = now, invalidateTenantCache()
  → না মিললে:    status = "failed", failureReason লেখো
```

**সতর্কতা:**
- DNS propagate হতে সময় লাগে — verify fail মানেই স্থায়ী fail নয়। Seller আবার চেষ্টা করতে পারবে।
- Timeout দিন (৫s), নইলে DNS ঝুলে গেলে request আটকে থাকবে।
- Rate limit দিন — verify endpoint বারবার চাপলে DNS lookup-এর বন্যা হবে।
- **Domain সরানোর সময়** `invalidateTenantCache()` call করতেই হবে, নইলে ৩০ সেকেন্ড পর্যন্ত পুরোনো mapping কাজ করবে।

### ২.৩ Audit

প্রতিটা add/verify/remove/primary-change `recordPlatformAudit` (`src/service/platformAudit.service.js:3`) দিয়ে log হবে — action: `DOMAIN_ADDED`, `DOMAIN_VERIFIED`, `DOMAIN_REMOVED`, `DOMAIN_PRIMARY_CHANGED`।

### ২.৪ Test — `tests/integration/platformDomainApi.test.js`

- Platform token ছাড়া → 401 (`platformGuard.test.js`-এর প্যাটার্ন)
- Domain যোগ → `pending`, token ফেরত আসে
- DNS mock করে verify → `active`, তখন Host resolution কাজ করে
- ভুল token → `failed`, Host resolution **কাজ করে না**
- অন্য tenant-এর দখল করা domain যোগ → 409
- `isPrimary` সেট করলে আগেরটা `false` হয়
- Domain মুছলে cache invalidate হয় (মুছার পরপরই Host আর কাজ করে না)

**Done when:** Postman দিয়ে domain add → verify → ঐ Host দিয়ে product list আসে।

---

# Sprint 3 — Guest context fix + public catalog

**লক্ষ্য:** Public/guest request-এ tenant context নিশ্চিত করা।

### ৩.১ 🐛 বিদ্যমান bug — `src/middleware/guestOrAuth.js`

Guest path (token নাই, `guestId` আছে) শুধু `next()` call করে — **কোনো tenant context খোলে না**। এখন `resolveRequestTenant` আগে চলে বলে `x-tenant` থাকলে বাঁচা যায়, না থাকলে strict mode-এ অস্পষ্ট error আসে।

**ঠিক করুন:** guest path-এ `getTenantId()` check করুন। Context না থাকলে **400 `TENANT_CONTEXT_REQUIRED`** — পরিষ্কার বার্তা, plugin-এর ভেতরের error নয়।

### ৩.২ Public catalog যাচাই

এই route-গুলো ইতিমধ্যে auth ছাড়া (`product.api.js:21,23,78,80,84,86,88`, `Category.api.js:17,19`, `brand.api.js:15,17,20`, `coupon.api.js:19` ইত্যাদি)। S1-এর পর Host দিলেই কাজ করবে।

**যা করতে হবে — field leak যাচাই:** প্রতিটা public endpoint-এর response দেখে নিশ্চিত করুন shopper যেন না দেখে:
- cost price / purchase price
- supplier তথ্য
- ভেতরের stock হিসাব, margin
- staff note

পেলে `.select()` দিয়ে বাদ দিন, অথবা public serializer লিখুন।

### ৩.৩ Test — `tests/integration/publicCatalog.test.js`

- Host ছাড়া public call → 400 `TENANT_CONTEXT_REQUIRED` (strict mode-এর কাঁচা error নয়)
- Host দিয়ে → শুধু ঐ store-এর product
- Guest cart: `x-guest-id` + Host → কাজ করে; Host ছাড়া → 400
- **Leak test:** public product response-এ cost price field নাই

**Done when:** সব সবুজ, আর `guestOrAuth`-এর fix সরালে Host-ছাড়া test fail করে।

---

# Sprint 4 — Shopper auth (account + guest)

**লক্ষ্য:** Shopper register/login করতে পারবে, guest-ও order দিতে পারবে।

### ৪.১ মূল নীতি

- Shopper = **role-হীন `User`** (ইতিমধ্যে এই বিভাজন আছে — `user.controller.js:158` dashboard login-এ role-হীন user আটকায়)
- Tenant আসবে **Host থেকে**, `workspace` body থেকে **নয়** (ওটা dashboard-এর জিনিস)
- Token-এ **`aud: "shopper"`** claim — shopper token দিয়ে dashboard API-তে ঢোকা যাবে না

### ৪.২ নতুন route — `src/routes/api/shop.api.js`

| Method | Path | নোট |
|---|---|---|
| `POST` | `/shop/auth/register` | Host → tenant। ঐ store-এ email/phone unique |
| `POST` | `/shop/auth/login` | shopper token দেয় |
| `POST` | `/shop/auth/logout` | |
| `POST` | `/shop/auth/forgot-password` · `/reset-password` | tenant-এর নিজের SMS/email setting ব্যবহার করবে (`src/integrations/config.js`) |
| `GET` | `/shop/me` | shopper profile |
| `GET` | `/shop/orders` · `/shop/orders/:id` | **নিজের** order, `userId` দিয়ে filter |

### ৪.৩ 🚨 `authGuard`-এ audience check

এটাই এই sprint-এর সবচেয়ে গুরুত্বপূর্ণ নিরাপত্তা কাজ।

`src/middleware/authMiddleware.js`-এ **অবশ্যই** `aud` যাচাই করতে হবে:
- Staff route-এ `aud: "shopper"` token → **401**
- Shopper route-এ `aud: "staff"` token → **401**

না করলে shopper তার token দিয়ে dashboard API-তে ঢুকে যাবে। Rate limit-ও দিতে হবে (`rateLimit.middleware.js`-এর বিদ্যমান প্যাটার্নে)।

### ৪.৪ Test — `tests/integration/shopperAuth.test.js`

- Host দিয়ে register → ঐ tenant-এ user তৈরি
- দুই tenant-এ **একই email** → দুইটাই সফল, আলাদা user (isolation-এর আসল পরীক্ষা)
- velor-এর shopper token + `pizzashop.com` Host → 401
- **Shopper token দিয়ে `/order/allorders` (staff route) → 401** ← এটা না থাকলে sprint অসম্পূর্ণ
- Staff token দিয়ে `/shop/me` → 401
- `/shop/orders` শুধু নিজের order দেয়, ঐ store-এর অন্যেরটা নয়

---

# Sprint 5 — Public checkout + payment redirect

**লক্ষ্য:** Storefront থেকে order → সঠিক tenantId-তে save → সঠিক dashboard-এ notification।

> **সবচেয়ে ঝুঁকিপূর্ণ sprint।** এখানে টাকার হিসাব, তাই client-এর পাঠানো কিছুই বিশ্বাস করা যাবে না।

### ৫.১ `POST /shop/order`

`guestOrAuth` ব্যবহার করবে (account বা guest — দুইটাই)। `authGuard` **নয়** (আজ `order.api.js:7`-এ `authGuard` + `authorize("order","add")` আছে, সেটা staff-এর order entry-র জন্য — **ওটা অপরিবর্তিত থাকবে**)।

### ৫.২ 🚨 যা server-side হিসাব করতেই হবে

| জিনিস | কেন |
|---|---|
| **দাম** | Client `price: 1` পাঠালে ১ টাকায় order হয়ে যাবে। DB থেকে দাম নিন |
| **Discount** | একই কারণ |
| **Delivery charge** | `DeliveryCharge` model থেকে |
| **Coupon** | server-side validate — মেয়াদ, সীমা, ঐ tenant-এর কিনা |
| **Stock** | কমানোর আগে check; race condition-এর জন্য atomic update |
| **মোট** | সব যোগ করে server নিজে বের করবে |

Client শুধু পাঠাবে: কোন product, কত quantity, ঠিকানা, payment method।

### ৫.৩ tenantId কিভাবে বসবে

**কিছু করতে হবে না** — `tenantPlugin.js:198-212` নিজেই `isNew` document-এ context-এর `tenantId` বসায় (`order.model.js:177`-এ plugin applied)। শুধু নিশ্চিত করুন handler `runForTenant`-এর ভেতরে চলছে, যা S1-এর middleware করবে।

### ৫.৪ Notification

`emitToTenant(getTenantId(), "orderPlaced", ...)` — `order.controller.js:395`-এ ইতিমধ্যে আছে, একই প্যাটার্ন।

### ৫.৫ Payment redirect

**আজ `payment.controller.js`-এ কোনো redirect নাই — JSON return করে।** Storefront এলে shopper-কে তার **নিজের** store-এ ফেরত পাঠাতে হবে।

ক্রম: primary `TenantDomain` → না থাকলে `general.storefrontUrl` (`src/settings/definitions.js:16`) → না থাকলে error log।

**হার্ডকোড `FRONTEND_URL` ব্যবহার করবেন না** — সব seller-এর customer velor-এ গিয়ে পড়বে।

> Webhook URL ইতিমধ্যে tenant-wise (`settings.service.js:263`) — **বদলাতে হবে না** ✅

### ৫.৬ ⚠️ Legacy `/payment/*` route

`payment.api.js:8-11`-এ কোনো tenant middleware নাই; `payment.controller.js:20,53`-এর `Order.findOneAndUpdate({ invoiceId })` shadow mode-এ **সব tenant জুড়ে** চলে। এখন `TENANCY_MODE=strict` বলে বাঁচা আছে, কিন্তু storefront live হওয়ার আগে এই route-গুলো **সরিয়ে দিন** (`/hooks/...` ইতিমধ্যে আছে)।

### ৫.৭ Test — `tests/integration/publicCheckout.test.js`

- `velor.com` থেকে order → velor-এর tenantId (DB-তে সরাসরি যাচাই)
- pizzashop-এর dashboard-এ ঐ order **নাই**
- **দাম জালিয়াতি:** `price: 1` পাঠালে server-এর দাম বসে, client-এরটা নয়
- **Coupon:** অন্য tenant-এর coupon → reject
- **Stock:** stock-এর বেশি order → reject
- Guest order (`x-guest-id`) কাজ করে
- Socket: velor-এর staff `orderPlaced` পায়, pizzashop-এর পায় না
- Payment success → velor-এর domain-এ redirect, `FRONTEND_URL`-এ নয়

**Done when:** সব সবুজ + ইচ্ছা করে server-side দাম হিসাব সরিয়ে দিলে জালিয়াতি test fail করে।

---

# Sprint 6 — Live chat

**লক্ষ্য:** `velor.com`-এর visitor chat করলে শুধু velor-এর dashboard-এ যাবে।

> S1-এর পরেই করা যায়; S4/S5-এর জন্য অপেক্ষা করতে হবে না।

### ৬.১ নতুন model (দুইটাই `tenantPlugin` apply করবে)

**`src/models/chatConversation.model.js`**

| Field | নোট |
|---|---|
| `tenantId` | plugin বসাবে |
| `guestId` বা `userId` | যেকোনো একটা |
| `status` | `open`·`closed` |
| `lastMessageAt`, `unreadForStaff` | inbox sort/badge |

**`src/models/chatMessage.model.js`**

| Field | নোট |
|---|---|
| `tenantId` | plugin বসাবে |
| `conversationId` | ref, indexed |
| `body` | trim, max length |
| `senderType` | `guest`·`staff` |
| `senderId` | staff হলে userId |
| `readAt` | |

**Index:** `{ tenantId: 1, conversationId: 1, createdAt: -1 }`

> `registry.js`-এ যোগ করবেন **না** — এগুলো tenant data, plugin apply হবে। Registry test নিজেই এটা enforce করবে।

### ৬.২ Socket — কাঠামোগত পরিবর্তন

**আজ socket একমুখী** — `socket.js:63-64`-এ শুধু `connection` আর `error`, একটাও `socket.on(...)` নাই। Chat-এর জন্য inbound handler যোগ করতে হবে।

`joinRooms`-এ (`socket.js:42`) listener যোগ করুন:

| Event | কে পাঠায় | কাজ |
|---|---|---|
| `chat:send` | guest বা staff | message save → অন্য পক্ষকে emit |
| `chat:read` | staff | `readAt` সেট |
| `chat:typing` | দুইজনই | ক্ষণস্থায়ী, save হবে না |

### ৬.৩ 🚨 তিনটা নিয়ম — একটাও ভাঙা যাবে না

১. **tenantId সবসময় `socket.data.tenantId` থেকে** (`socket.js:26,32`-এ handshake-এ বসানো)। Client-এর payload থেকে **কখনো না** — নইলে visitor নিজে tenantId পাঠিয়ে অন্য store-এ message ঢোকাবে।

২. **DB লেখার আগে `runForTenant(socket.data.tenantId, ...)`**। Socket handler HTTP middleware-এর বাইরে চলে, তাই context আপনা-আপনি খোলে না। ভুলে গেলে strict mode throw করবে — ভালো, কিন্তু শুরুতেই ঠিক লিখুন।

৩. **`emitToTenant` / `emitToUserOrGuest` (`socket.js:84,90`) ছাড়া কিছু ব্যবহার করবেন না।** `io.emit()` কখনো না — comment-এ কারণ লেখা আছে: "one store's events on every other store's screens"।

### ৬.৪ REST endpoint (dashboard inbox)

| Method | Path | কাজ |
|---|---|---|
| `GET` | `/chat/conversations` | staff, permission-gated |
| `GET` | `/chat/conversations/:id/messages` | pagination সহ |
| `POST` | `/chat/conversations/:id/close` | |

Permission module হিসেবে `chat` যোগ করতে হবে (`authorize("chat", "view")`) — seeder-এ।

### ৬.৫ Test — `tests/integration/chatIsolation.test.js`

`tenantSocket.test.js`-এর প্যাটার্ন অনুসরণ করুন।

- velor-এর guest message → velor staff পায়
- **pizzashop-এর staff socket ঐ message পায় না** ← মূল পরীক্ষা
- Guest নিজের conversation-এর reply পায়, অন্যেরটা নয়
- **Spoof:** payload-এ অন্য tenantId পাঠালে উপেক্ষিত, `socket.data`-রটাই বসে
- Suspended tenant → guest connect করতে পারে না (`assertTenantActive`)
- `/chat/conversations` শুধু নিজের tenant-এর দেয়

**Done when:** সব সবুজ + ইচ্ছা করে payload-এর tenantId ব্যবহার করলে spoof test fail করে।

---

## ৩. প্রতিটা Sprint-এ যা করতেই হবে

| # | নিয়ম |
|---|---|
| ১ | **Test আগে বা সাথে** — পরে নয় |
| ২ | **Test সত্যিই পাহারা দেয় কিনা যাচাই** — ইচ্ছা করে bug ঢুকিয়ে দেখুন test ধরে, তারপর revert। আগের কাজে এভাবেই তিনটা test যাচাই হয়েছে |
| ৩ | `npm test` পুরোটা সবুজ — শুধু নতুন test নয় |
| ৪ | নতুন model → `registry.js` সিদ্ধান্ত (global না tenant-scoped) |
| ৫ | নতুন secret → `.env` নয়, `TenantSettings`-এ |
| ৬ | Cache বদলালে `invalidateTenantCache()` |
| ৭ | Platform action → `recordPlatformAudit` |

---

## ৪. যা এই sprint-এ **নাই** (ইচ্ছাকৃত)

| জিনিস | কেন |
|---|---|
| `frontend/proxy.ts`, API client, storefront UI | আপনি বলেছেন frontend পরে |
| Nginx/TLS config | Deploy-এর কাজ; S1-এর §১.৪-এ header নিয়মটা লেখা আছে |
| Dashboard chat UI | S6 backend দেয়; UI আলাদা কাজ |
| Per-tenant theme/logo storefront-এ | `TenantSettings`-এ পরে |
| Domain auto-TLS (Caddy on-demand) | Infra sprint |

---

## ৫. ঝুঁকি — সবচেয়ে বিপজ্জনক আগে

| # | ঝুঁকি | Sprint | প্রতিকার |
|---|---|---|---|
| ১ | **Header spoofing** — client `x-tenant-host` পাঠিয়ে অন্য tenant সাজবে | S1 | Nginx overwrite + `TRUST_TENANT_HOST_HEADER` (§১.৪) |
| ২ | **Client-এর দাম বিশ্বাস** — ১ টাকায় order | S5 | সব হিসাব server-side (§৫.২) |
| ৩ | **Shopper token দিয়ে staff API** | S4 | `aud` check (§৪.৩) |
| ৪ | **Chat payload-এ tenantId** | S6 | শুধু `socket.data` (§৬.৩) |
| ৫ | **Verify ছাড়া domain চালু** — ভুল domain বসালে data expose | S2 | DNS TXT বাধ্যতামূলক, `status: "active"` ছাড়া resolve নয় |
| ৬ | **Legacy `/payment/*` context ছাড়া** | S5 | Route সরান (§৫.৬) |
| ৭ | **Cache stale** — domain সরানোর পরও ৩০s কাজ করে | S2 | `invalidateTenantCache()` |
| ৮ | **Public API-তে cost price leak** | S3 | Field যাচাই (§৩.২) |

---

## ৬. Frontend যখন আসবে (ভবিষ্যতের জন্য নোট)

Backend তৈরি থাকলে frontend-এর কাজ হবে মাত্র তিনটা:

1. **`frontend/src/proxy.ts`** — `Host` পড়ে `x-tenant-host` header বসাবে (Next 16-এ `middleware.ts` **নয়**, deprecated)
2. **Server-side fetch** — Server Component থেকে, তাহলে CORS-ই লাগবে না
3. **Cache-এ host** — Next-এর data cache tenant চেনে না; cache key-তে host দিন বা `no-store`। এটা বাদ দিলে এক store-এর page অন্য store-এ দেখাবে

`generateStaticParams` দিয়ে product prerender করবেন **না** — এক tenant-এর product অন্য tenant-এর domain-এ cache হয়ে যাবে।

---

## ৭. সংক্ষেপে

| Sprint | কাজ | নির্ভরশীল |
|---|---|---|
| S1 | `TenantDomain` + Host resolution | — |
| S2 | Platform domain API + DNS verify | S1 |
| S3 | Guest context fix + public catalog | S1 |
| S4 | Shopper auth (account + guest) | S1, S3 |
| S5 | Public checkout + payment redirect | S4 |
| S6 | Live chat | S1 |

**সুপারিশ:** S1 → S2 (এই দুইটা হলেই একটা domain দিয়ে catalog দেখা যাবে) → S3 → S4 → S5 → S6।

সবচেয়ে সতর্কতা দরকার **S5**-এ (টাকা) আর **S1-এর §১.৪**-এ (header spoofing)। বাকিটা তুলনামূলক যান্ত্রিক, কারণ isolation-এর ভিত্তি ইতিমধ্যে তৈরি।

---

## ৮. যা আসলে তৈরি হলো (implementation log)

### নতুন ফাইল (২০টা)

| ফাইল | কাজ |
|---|---|
| `src/models/platform/tenantDomain.model.js` | host → tenant map; `host` unique, reserved label guard, single-primary hook |
| `src/service/domainVerification.service.js` | DNS TXT যাচাই, 5s timeout, injectable resolver (test-এর জন্য) |
| `src/controller/platform/domain.controller.js` | domain add/verify/primary/remove + audit + cache invalidation |
| `src/validation/platform/domain.validation.js` | Joi schema |
| `src/controller/shop.controller.js` | shopper register/login/me/orders |
| `src/routes/api/shop.api.js` | storefront route |
| `src/controller/shopOrder.controller.js` | public checkout — সব দাম server-side |
| `src/service/storefrontUrl.service.js` | payment-এর পর tenant-এর নিজের domain-এ redirect |
| `src/utils/publicProduct.js` | shopper-এর কাছ থেকে cost price লুকায় |
| `src/models/chatConversation.model.js`, `chatMessage.model.js` | chat, দুইটাই `tenantPlugin` সহ |
| `src/socket/chat.js` | socket inbound handler (আগে socket একমুখী ছিল) |
| `src/controller/chat.controller.js`, `src/routes/api/chat.api.js` | dashboard inbox |
| 6টা test file | নিচের টেবিল |

### বদলানো ফাইল (১৫টা)

`requestTenant.middleware.js` (host resolution), `tenantResolver.js` (`getTenantByHost`), `registry.js` (`TenantDomain` global), `authMiddleware.js` (`aud` check + `optionalAuth` + `shopperGuard`), `user.model.js` (`aud` claim), `guestOrAuth.js` (context bug fix), `payment.controller.js` (redirect), `product.controller.js` + `product.api.js` (cost price), `socket.js` (inbound events), `platformAuditLog.model.js` (4টা নতুন action), `rateLimit.middleware.js` (`domainVerifyLimiter`), `permissionSeeder.js` (Chat), `tenant.api.js`, `routes/index.js`।

### Test — প্রতিটা ইচ্ছা করে ভেঙে যাচাই করা

| Test file | কয়টা | যে bug ঢুকিয়ে যাচাই করা হয়েছে |
|---|---|---|
| `domainResolution.test.js` | 11 | `status:"active"` filter সরানো → unverified domain route করে ❌ ধরা পড়ে ✅ |
| | | `TRUST_TENANT_HOST_HEADER` সবসময় true → spoofing ❌ ধরা পড়ে ✅ |
| `platformDomainApi.test.js` | 14 | cache invalidation বাদ → মুছে ফেলা domain কাজ করে ❌ ধরা পড়ে ✅ |
| | | unverified domain primary হতে দেওয়া ❌ ধরা পড়ে ✅ |
| `publicCatalog.test.js` | 8 | cost price strip বন্ধ ❌ ধরা পড়ে ✅ |
| `shopperAuth.test.js` | 12 | `aud` check সরানো → shopper token দিয়ে dashboard ❌ ধরা পড়ে ✅ |
| `publicCheckout.test.js` | 17 | client-এর `finalAmount` বিশ্বাস → ১ টাকায় order ❌ ধরা পড়ে ✅ |
| | | coupon lookup `runAsPlatform` → অন্য store-এর coupon ❌ ধরা পড়ে ✅ |
| | | hardcoded redirect URL → অন্য seller-এর customer ❌ ধরা পড়ে ✅ |
| `chatIsolation.test.js` | 10 | payload-এর `tenantId` বিশ্বাস → অন্য store-এ message ❌ ধরা পড়ে ✅ |

### কাজ করতে গিয়ে যা বাড়তি পাওয়া গেল

১. **Cost price সত্যিই leak হচ্ছিল** (§৩.২-এ সন্দেহ করা হয়েছিল, নিশ্চিত হলো)। `getAllProducts`/`getProductBySlug`-এ কোনো `.select()` ছিল না, তাই `purchasePrice` anonymous visitor-ও দেখত। এখন `optionalAuth` দিয়ে staff চেনা হয় — staff দেখে, shopper দেখে না।

২. **`optionalAuth` লাগল** — public route-এ কোনো auth middleware ছিল না, তাই `req.user` কখনো set হতো না। প্রথম fix-এ staff-এর কাছ থেকেও cost price লুকিয়ে যাচ্ছিল; test সেটা ধরল।

৩. **`PlatformAuditLog.action` enum** — নতুন `DOMAIN_*` action যোগ না করায় প্রতিটা domain API 400 দিচ্ছিল।

৪. **Socket একমুখী ছিল** — `socket.js`-এ একটাও `socket.on(...)` ছিল না। Chat-এর জন্য `src/socket/chat.js`-এ inbound handler যোগ করতে হয়েছে।

### এখনো বাকি (ইচ্ছাকৃত)

- Frontend (`proxy.ts`, API client) — আপনি পরে করবেন; §৬-এ নোট আছে
- Nginx `proxy_set_header x-tenant-host $host;` + `TRUST_TENANT_HOST_HEADER=true` — deploy-এর সময়
- Legacy `/payment/*` route সরানো (§৫.৬) — storefront live হওয়ার আগে
- Dashboard chat UI — backend তৈরি, UI আলাদা কাজ
