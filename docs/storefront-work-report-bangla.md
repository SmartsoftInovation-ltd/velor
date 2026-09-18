# কাজের রিপোর্ট — Storefront Multi-Domain Backend

> **তারিখ:** 2026-09-18
> **Commit:** `544ffa3`
> **তুলনা করা হয়েছে:** `aef649b` (আগের commit) থেকে
> **পরিমাণ:** 44টা ফাইল, +3881 / −3054 লাইন
> **ফলাফল:** backend test **443/443 সবুজ** (আগে 370), 52 suite। `migrate:audit` → `ready: true`

---

## ০. এক নজরে — কী সমস্যা ছিল, কী হলো

**আগে যা ছিল না:**

আপনার প্রশ্ন ছিল — *"কোন domain থেকে order আসলে কোন tenantId-এর under-এ যাবে?"* উত্তর ছিল: **এটা করা ছিল না**। Backend শুধু `x-tenant` header দেখত (dashboard-এর জন্য)। কোনো domain → tenant mapping ছিল না, `TenantDomain` model ছিল না, storefront-এর shopper order দেওয়ার কোনো রাস্তাই ছিল না, chat feature ছিল না।

**এখন যা আছে:**

`velor.com` থেকে order এলে velor-এর `tenantId` নিয়ে database-এ save হয়, velor-এর dashboard-এ notification যায়, আর velor-এর website-এ সেই তথ্য দেখানোর API তৈরি। `pizzashop.com` থেকে এলে pizzashop-এর। দুইটা কখনো মেশে না — এবং এটা আমি ইচ্ছা করে bug ঢুকিয়ে প্রমাণ করেছি (§৫)।

**মূল নীতি:** tenant ঠিক হয় **server-এর দেখা Host থেকে**, browser-এর পাঠানো কোনো কথা থেকে নয়। কারণ header যে কেউ বদলাতে পারে, কিন্তু domain ঠিক করে DNS — visitor না।

---

## ১. নতুন ফাইল (২০টা) — কোনটা কী কাজ করে

### ১.১ Domain → Tenant mapping (Sprint 1–2)

| ফাইল | লাইন | কাজ |
|---|---|---|
| `src/models/platform/tenantDomain.model.js` | 131 | কোন domain কোন store-এর — এই তালিকা। `host` unique (এক domain দুই store-এ যেতে পারবে না), platform-এর নিজের নাম (`api`, `app`) reserved, এক store-এ একটাই primary domain |
| `src/service/domainVerification.service.js` | 118 | DNS TXT record দেখে প্রমাণ করে domain-টা সত্যিই seller-এর। 5 সেকেন্ড timeout, test-এর জন্য resolver বদলানো যায় |
| `src/controller/platform/domain.controller.js` | 178 | আপনি console/Postman থেকে domain add/verify/primary/remove করবেন। প্রতিটা কাজ audit log-এ যায়, আর cache clear হয় |
| `src/validation/platform/domain.validation.js` | 19 | request-এর শুদ্ধতা যাচাই |

**কিভাবে কাজ করে:**

```
আপনি domain যোগ করলেন  →  status: "pending"  (এখনো কোনো traffic যাবে না)
         ↓
Seller-কে একটা TXT record দেওয়া হলো:
   _velor-verify.velor.com  TXT  "velor-verify=<token>"
         ↓
Seller তার DNS-এ বসালো  →  আপনি verify চাপলেন
         ↓
মিলে গেলে  →  status: "active"  →  এখন velor.com কাজ করবে
মিল না হলে →  status: "failed"  →  কেন হয়নি লেখা থাকবে, আবার চেষ্টা করা যাবে
```

**কেন verification লাগে:** এটা ছাড়া ভুল করে `competitor.com` বসিয়ে দিলে ঐ domain-এ আসা সব visitor আপনার এক seller-এর দোকান দেখত।

### ১.২ Shopper account + checkout (Sprint 4–5)

| ফাইল | লাইন | কাজ |
|---|---|---|
| `src/controller/shop.controller.js` | 146 | shopper register/login/profile/order-history |
| `src/routes/api/shop.api.js` | 30 | storefront-এর route |
| `src/controller/shopOrder.controller.js` | 261 | **public checkout** — সব দাম server-side হিসাব |
| `src/service/storefrontUrl.service.js` | 56 | payment-এর পর shopper-কে **তার নিজের** দোকানে ফেরত পাঠায় |
| `src/utils/publicProduct.js` | 48 | shopper-এর কাছ থেকে cost price লুকায় |

**Checkout-এ যা server নিজে হিসাব করে** (client যা-ই পাঠাক):

- প্রতিটা পণ্যের দাম — database থেকে
- Discount, coupon — যাচাই করে, অন্য store-এর coupon চললে reject
- Delivery charge — `Delivery` model থেকে
- মোট টাকা — server নিজে যোগ করে
- Stock — atomic update, দুইজন একসাথে শেষ পণ্যটা কিনলে একজন পাবে

Client শুধু পাঠায়: কোন পণ্য, কয়টা, ঠিকানা, payment method।

### ১.৩ Live chat (Sprint 6)

| ফাইল | লাইন | কাজ |
|---|---|---|
| `src/models/chatConversation.model.js` | 38 | visitor-এর সাথে দোকানের কথোপকথন |
| `src/models/chatMessage.model.js` | 35 | প্রতিটা message |
| `src/socket/chat.js` | 166 | socket-এর inbound handler |
| `src/controller/chat.controller.js` | 59 | dashboard-এর inbox |
| `src/routes/api/chat.api.js` | 18 | staff-only route |

**কিভাবে কাজ করে:**

```
velor.com-এ visitor chat লিখল
        ↓
socket handshake: { tenant: "velor", guestId: "..." }  →  যাচাই হলো
        ↓
message save হলো velor-এর tenantId নিয়ে
        ↓
শুধু velor-এর staff room-এ গেল  →  velor dashboard-এ দেখা গেল
        ↓
Staff reply দিল  →  শুধু ঐ একজন visitor-এর কাছে গেল
```

pizzashop-এর dashboard এটা **কখনো** পাবে না।

### ১.৪ Test (৬টা ফাইল, ৭২টা নতুন test)

| ফাইল | test | কী পরীক্ষা করে |
|---|---|---|
| `domainResolution.test.js` | 11 | domain → tenant, www/apex, spoofing, suspended store |
| `platformDomainApi.test.js` | 14 | domain API, DNS verify, cache, permission |
| `publicCatalog.test.js` | 8 | catalog isolation, cost price leak, guest cart |
| `shopperAuth.test.js` | 12 | shopper account, token আলাদা রাখা |
| `publicCheckout.test.js` | 17 | দাম জালিয়াতি, coupon, stock, payment redirect |
| `chatIsolation.test.js` | 10 | chat এক দোকানের ভেতরেই থাকে |

---

## ২. বদলানো ফাইল (১৫টা) — কী বদলালো, কেন

| ফাইল | কী বদলালো | কেন |
|---|---|---|
| `middleware/requestTenant.middleware.js` | `x-tenant-host` header থেকে tenant বের করা যোগ হলো | storefront-এর মূল দরজা |
| `tenancy/tenantResolver.js` | `getTenantByHost()` যোগ, 30s cache সহ | domain দেখে store খোঁজা |
| `tenancy/registry.js` | `TenantDomain` global model হিসেবে তালিকাভুক্ত | এটা দিয়েই tenant খোঁজা হয়, তাই এটা নিজে tenant-scoped হতে পারে না |
| `middleware/authMiddleware.js` | `aud` যাচাই + `optionalAuth` + `shopperGuard` | shopper আর staff-এর session আলাদা রাখা |
| `models/user.model.js` | token-এ `aud` claim যোগ | role আছে = staff, নেই = shopper |
| `middleware/guestOrAuth.js` | tenant context না থাকলে পরিষ্কার 400 | **আগের bug** — guest cart অস্পষ্ট error দিত |
| `controller/payment.controller.js` | JSON-এর বদলে redirect | shopper browser-এ raw JSON দেখত |
| `controller/product.controller.js` + `routes/api/product.api.js` | cost price শুধু staff দেখে | **আগের leak** — নিচে §৪ |
| `socket/socket.js` | inbound event handler যোগ | socket আগে একমুখী ছিল |
| `models/platform/platformAuditLog.model.js` | 4টা নতুন `DOMAIN_*` action | enum-এ না থাকলে API 400 দিত |
| `middleware/rateLimit.middleware.js` | `domainVerifyLimiter` | DNS lookup-এর বন্যা ঠেকাতে |
| `seeder/permissionSeeder.js` | `Chat` permission | dashboard inbox-এর জন্য |
| `routes/platform/tenant.api.js`, `routes/index.js` | নতুন route mount | |

---

## ৩. ডকুমেন্ট পরিবর্তন

**নতুন:**
- `docs/storefront-multitenant-plan-bangla.md` (381 লাইন) — বিশ্লেষণ: কী ছিল, কী নাই, কেন
- `docs/storefront-backend-sprints.md` (553 লাইন) — ৬টা sprint-এর কাজের তালিকা + ফলাফল
- `docs/storefront-work-report-bangla.md` — এই ফাইল

**সংশোধন:** `docs/dashboard-backend-multitenant-architecture.md` — ৫ জায়গায় কোডের সাথে মিলছিল না:

| লেখা ছিল | আসলে |
|---|---|
| `tenantDomain.model.js` আছে | ছিল না (এখন বানানো হয়েছে) |
| "tenant = host" resolution আছে | ছিল না |
| `groq.client.js` | নেই (Groq সরানো হয়েছে) |
| `worker-embed` pm2 process | নেই (RAG সরানো হয়েছে) |
| `resolveTenant.middleware.js` | আসল নাম `requestTenant.middleware.js` |

**মুছে ফেলা (6টা, 3005 লাইন):** `QUERY_INDEX_AUDIT.md`, `multi-tenant-plan.md`, `multitenant-audit-report-bangla.md`, `multitenant-implementation-report.md`, `multitenant-sprints.md`, `multiuser-readiness-report-bangla.md` — এগুলো আগের কাজের ডকুমেন্ট, নতুন দুইটা ফাইল প্রতিস্থাপন করেছে।

---

## ৪. কাজ করতে গিয়ে যা বাড়তি ধরা পড়ল

### 🔴 ১. Cost price সত্যিই leak হচ্ছিল

**সমস্যা:** `getAllProducts` আর `getProductBySlug`-এ কোনো `.select()` ছিল না। তাই `purchasePrice` — অর্থাৎ দোকান কত টাকায় পণ্যটা কিনেছে — **যে কেউ** দেখতে পেত। প্রতিযোগী চাইলে আপনার প্রতিটা seller-এর লাভের হিসাব বের করে ফেলতে পারত।

**সমাধান:** `optionalAuth` middleware দিয়ে staff চেনা হয়। Staff দেখে, shopper দেখে না।

**একটা ভুলও হয়েছিল:** প্রথম fix-এ staff-এর কাছ থেকেও লুকিয়ে যাচ্ছিল — কারণ public route-এ কোনো auth middleware ছিলই না, তাই `req.user` কখনো set হতো না। Test সেটা ধরল, তারপর `optionalAuth` লিখতে হলো।

### 🔴 ২. Guest cart-এর tenant context bug

`guestOrAuth.js`-এ guest path কোনো tenant context খুলত না। `x-tenant` header থাকলে বেঁচে যেত, না থাকলে strict mode-এর ভেতরের অস্পষ্ট error আসত। এখন পরিষ্কার `400 TENANT_CONTEXT_REQUIRED`।

### 🟡 ৩. Socket একমুখী ছিল

`socket.js`-এ একটাও `socket.on(...)` ছিল না — server পাঠাতে পারত, কিন্তু client-এর কথা শুনতে পারত না। Chat-এর জন্য পুরো inbound layer নতুন লিখতে হয়েছে।

### 🟡 ৪. Audit log enum

`PlatformAuditLog.action` একটা enum। নতুন `DOMAIN_*` action যোগ না করায় প্রতিটা domain API 400 দিচ্ছিল — প্রথমে ধরতে সময় লেগেছে।

---

## ৫. প্রতিটা সুরক্ষা ইচ্ছা করে ভেঙে যাচাই করা হয়েছে

শুধু test লিখে "pass" দেখলে যথেষ্ট নয় — test টা আদৌ পাহারা দিচ্ছে কিনা সেটাও প্রমাণ দরকার। তাই প্রতিটা গুরুত্বপূর্ণ সুরক্ষা আমি **ইচ্ছা করে ভেঙেছি**, দেখেছি test ধরে কিনা, তারপর ঠিক করে দিয়েছি।

| যে bug ঢুকিয়েছি | কী হতো | Test ধরল? |
|---|---|---|
| `status:"active"` filter সরানো | যাচাই-না-হওয়া domain traffic পেত | ✅ |
| `TRUST_TENANT_HOST_HEADER` সবসময় true | যে কেউ header পাঠিয়ে অন্য দোকান সাজতে পারত | ✅ |
| Client-এর `finalAmount` বিশ্বাস | ৫০০ টাকার order ১ টাকায় | ✅ |
| Coupon lookup `runAsPlatform` দিয়ে | অন্য দোকানের coupon এখানে চলত | ✅ |
| `aud` check সরানো | shopper-এর token দিয়ে dashboard খুলত | ✅ |
| Chat payload-এর `tenantId` বিশ্বাস | visitor অন্য দোকানের inbox-এ message ঢোকাত | ✅ |
| Hardcoded redirect URL | pizzashop-এর customer velor-এ গিয়ে পড়ত | ✅ |
| Cache invalidation বাদ | মুছে ফেলা domain ৩০ সেকেন্ড কাজ করত | ✅ |
| Unverified domain primary হতে দেওয়া | payment redirect ভুল জায়গায় যেত | ✅ |
| Cost price strip বন্ধ | লাভের হিসাব ফাঁস | ✅ |

---

## ৬. এখন কোনটা কী কাজ করে — সংক্ষেপে

### Request-এর পথ

```
Shopper velor.com-এ order দিল
        ↓
Nginx  →  x-tenant-host: velor.com  (client যা পাঠাক, overwrite হয়)
        ↓
resolveRequestTenant  →  TenantDomain খুঁজল  →  velor-এর tenantId
        ↓
runForTenant(velorId)  →  context খুলল
        ↓
shopOrder.controller  →  দাম server-side হিসাব  →  stock check
        ↓
Order.create()  →  tenantPlugin নিজেই tenantId বসাল ✅
        ↓
emitToTenant(velorId, "orderPlaced")  →  শুধু velor-এর dashboard ✅
```

### API তালিকা

**Platform (আপনার জন্য):**

| Method | Path | কাজ |
|---|---|---|
| `GET` | `/platform/tenants/:id/domains` | domain তালিকা |
| `POST` | `/platform/tenants/:id/domains` | domain যোগ (pending) |
| `POST` | `/platform/tenants/:id/domains/:domainId/verify` | DNS যাচাই |
| `PATCH` | `/platform/tenants/:id/domains/:domainId` | primary সেট |
| `DELETE` | `/platform/tenants/:id/domains/:domainId` | সরানো |

**Storefront (frontend পরে ব্যবহার করবে):**

| Method | Path | কাজ |
|---|---|---|
| `POST` | `/shop/auth/register` · `/login` | shopper account |
| `GET` | `/shop/me` | profile |
| `GET` | `/shop/orders` · `/orders/:id` | নিজের order |
| `POST` | `/shop/order` | **checkout** (guest-ও পারবে) |
| `GET` | `/shop/track/:invoiceId` | order tracking |

**Dashboard (staff):**

| Method | Path | কাজ |
|---|---|---|
| `GET` | `/chat/conversations` | inbox |
| `GET` | `/chat/conversations/:id/messages` | কথোপকথন |
| `POST` | `/chat/conversations/:id/close` | বন্ধ করা |

**Socket events:** `chat:send`, `chat:read`, `chat:typing`

---

## ৭. যা এখনো বাকি

### আপনার হাতে (deploy-এর সময়)

**১. Nginx config** — এটা বাদ দিলে পুরো নিরাপত্তা ফাঁকা:

```nginx
proxy_set_header x-tenant-host $host;   # client যা পাঠাক, মুছে যাবে
```

**২. Env:**

```
TRUST_TENANT_HOST_HEADER=true
```

> ⚠️ এই env **by default বন্ধ**। মানে Nginx লাইনটা বসানোর আগে storefront কাজ করবে না — ইচ্ছা করে এভাবে রাখা হয়েছে, যাতে ভুলে গেলে নিরাপত্তা ফাঁকা না হয়ে বরং বন্ধ থাকে।

**৩. Legacy `/payment/*` route সরানো** — storefront live হওয়ার আগে। `/hooks/...` ইতিমধ্যে tenant-wise আছে।

**৪. TLS** — custom domain-এ automatic certificate (Caddy on-demand বা Let's Encrypt)।

### Frontend (আপনার পরিকল্পনা অনুযায়ী পরে)

তিনটা কাজ:

1. **`frontend/src/proxy.ts`** — Host পড়ে `x-tenant-host` বসাবে
   ⚠️ Next.js 16-এ `middleware.ts` **deprecated**, নাম এখন `proxy.ts`
2. **Server-side fetch** — Server Component থেকে, তাহলে CORS-ই লাগবে না
3. **Cache key-তে host** — Next-এর data cache tenant চেনে না। এটা বাদ দিলে এক দোকানের page অন্য দোকানে দেখাবে

`generateStaticParams` দিয়ে product prerender করবেন **না**।

### Dashboard UI

Chat-এর backend তৈরি, inbox UI বানানো বাকি।

---

## ৮. একটা সৎ কথা

পুরো suite চালানোর সময় **একবার** `domainResolution` test-এর একটা case fail করেছিল। এরপর পরপর তিনবার পুরো suite আর তিনবার আলাদাভাবে চালিয়েও আর reproduce করতে পারিনি — সব সবুজ।

আমি এটা লুকাইনি এবং জোর করে "ঠিক" করে দেইনি, কারণ কারণটা নিশ্চিত না। সন্দেহ: parallel load-এ timing। আবার দেখা দিলে ঐদিকে খোঁজা উচিত।

---

## ৯. যাচাইয়ের ফলাফল

```
Test Suites:  52 passed, 52 total
Tests:       443 passed, 443 total     (আগে 370)

migrate:audit →  {
  "collections": 52,
  "untenanted": [],
  "globalUniqueIndexes": [],
  "missingIndexes": [],
  "ready": true
}
```

নতুন দুইটা chat collection-ও ঠিকভাবে tenant-scoped — audit নিজেই সেটা নিশ্চিত করেছে।
