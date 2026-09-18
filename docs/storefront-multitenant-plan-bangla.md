# Website (Storefront) Multi-Tenant Plan — বাংলা

> **তারিখ:** 2026-09-18
> **স্কোপ:** `frontend/` (Next.js 16 storefront) + `backend/`-এর সেই অংশ যা storefront চালাতে লাগবে।
> **সঙ্গী ডকুমেন্ট:** [`dashboard-backend-multitenant-architecture.md`](./dashboard-backend-multitenant-architecture.md) (backend + dashboard, ইতিমধ্যে implemented), [`multiuser-readiness-report-bangla.md`](./multiuser-readiness-report-bangla.md) (readiness audit)।

---

## ০. আপনার প্রশ্নের সরাসরি উত্তর

আপনি তিনটা জিনিস জানতে চেয়েছেন। সরাসরি উত্তর দিচ্ছি, তারপর বিস্তারিত।

**প্রশ্ন ১: "কোন domain থেকে order আসলে কোন tenantId-এর under-এ যাবে — এটা কি করা আছে?"**

**না, করা নাই।** আজকের কোডে tenant ঠিক হয় **একমাত্র** `x-tenant` header থেকে (`backend/src/middleware/requestTenant.middleware.js:15`)। domain/Host header দেখে tenant বের করার কোনো কোড নাই — পুরো `backend/src/`-এ `req.hostname`, `headers.host`, `customDomain`, `getTenantByDomain` — কিছুরই কোনো match নাই। `TenantDomain` model-ও নাই (`backend/src/models/platform/` এ আছে শুধু `tenant`, `tenantSettings`, `platformUser`, `platformAuditLog`)। `Tenant` model-এ কোনো domain field নাই (`tenant.model.js:16-56`)।

**প্রশ্ন ২: "velor-এর website থেকে order আসলে velor-এর tenantId-wise database-এ যাবে, আর ঐ website-এ ঐ info দেখাবে — তাই না?"**

কনসেপ্ট ঠিক, কিন্তু **আজ এটা কাজ করবে না** — দুইটা কারণে:

1. **Storefront backend-এর সাথে connected-ই না।** `frontend/src/`-এ একটাও `fetch()`/`axios` call নাই, একটাও `process.env` read নাই, কোনো `.env` file নাই। সব page হার্ডকোড করা fixture থেকে render হয় (`frontend/src/lib/catalog/*`)। এটা ইচ্ছাকৃত — `frontend/.claude/rules/scope.md`-এ লেখা আছে "A real API does not exist yet… backed by in-memory fixtures"।
2. **Public order endpoint নাই।** `backend/src/routes/api/order.api.js`-এর **প্রতিটা** route-এ `authGuard` + `authorize("order", ...)` বসানো (line 7-21)। মানে শুধু login করা **staff** order বানাতে পারে। একজন shopper/guest এখন order দিতেই পারবে না।

**প্রশ্ন ৩: "velor website থেকে কেউ live chat করলে সেটা velor-এর dashboard-এ আসবে, right?"**

**কনসেপ্ট ঠিক, এবং ভিত্তিটা ইতিমধ্যে তৈরি — কিন্তু chat feature নিজে নাই।**

ভালো খবর: `backend/src/socket/socket.js` ইতিমধ্যে tenant-aware এবং **guest socket support করে** (`socket.js:31-35`) — guest তার store slug + guestId দিয়ে connect করে, আর `tenant:<id>:guest:<guestId>` room-এ যায় (`socket.js:9`, `:51`)। Staff যায় `tenant:<id>` room-এ (`socket.js:47`)। `emitToTenant()` / `emitToUserOrGuest()` (`socket.js:84`, `:90`) দিয়ে শুধু ঐ store-এর লোকজনের কাছেই message যায়। `io.emit()` ইচ্ছা করে বাদ দেওয়া হয়েছে — comment-এ লেখা: "one store's events on every other store's screens"।

খারাপ খবর: **কোনো chat/message/conversation model বা controller নাই** (`backend/src/models/`-এ grep করে কিছু পাওয়া যায় নাই), storefront-এ `socket.io-client` dependency-ই নাই (`frontend/package.json`-এ আছে শুধু next, react, react-dom, swiper), আর socket এখন **একমুখী** — `socket.js:63-64`-এ শুধু `connection` ও `error` handler, একটাও `socket.on(...)` listener নাই। মানে server এখন client-কে পাঠাতে পারে, কিন্তু client-এর পাঠানো message শোনার কোনো ব্যবস্থা নাই।

**এক লাইনে:** isolation-এর ভিত্তি (plugin, context, socket rooms, webhook-per-tenant) শক্ত এবং তৈরি। কিন্তু storefront-কে tenant-এর সাথে যুক্ত করার লেয়ারটা — domain → tenantId mapping, public API, chat — এখনো লিখতে হবে। নিচে সেটার প্ল্যান।

---

## ১. এখন কী আছে, কী নাই (প্রমাণসহ)

### ১.১ Backend — যা আছে (শক্ত ভিত্তি)

| জিনিস | ফাইল | অবস্থা |
|---|---|---|
| Tenant context (AsyncLocalStorage) | `src/tenancy/context.js` | ✅ |
| Mongoose tenant plugin, fail-closed | `src/tenancy/tenantPlugin.js:32,54` | ✅ `TENANCY_MODE=strict` হলে context ছাড়া query **throw** করে |
| `x-tenant` header দিয়ে tenant resolve | `src/middleware/requestTenant.middleware.js:15` | ✅ সব business route-এর আগে mount করা (`src/routes/index.js:31`) |
| `workspace` body দিয়ে tenant resolve (login) | `requestTenant.middleware.js:31` | ✅ |
| Webhook `:webhookKey` দিয়ে tenant resolve | `src/middleware/webhookTenant.middleware.js:8` | ✅ **domain resolution-এর জন্য ভালো precedent** |
| Per-tenant webhook URL | `src/settings/settings.service.js:263` | ✅ SSLCommerz/Pathao/Steadfast callback ইতিমধ্যে tenant-wise |
| Socket: tenant room + guest room | `src/socket/socket.js:7-9,47-52` | ✅ |
| Socket: guest handshake (token ছাড়া) | `src/socket/socket.js:31-35` | ✅ |
| Token vs header precedence | `src/middleware/authMiddleware.js:46-49` | ✅ `x-tenant` আর JWT `tid` না মিললে 401 — header দিয়ে tenant বদলানো যায় না |
| `general.storefrontUrl` per-tenant setting | `src/settings/definitions.js:16` | ✅ ইতিমধ্যে email template-এ ব্যবহৃত (`src/emailTemplate/orderTemplate.js:13`) |
| Guest cart (`x-guest-id`) | `src/middleware/guestOrAuth.js`, `src/routes/api/cart.api.js:7-11` | ⚠️ আছে, কিন্তু নিচের bug দেখুন |

### ১.২ Backend — যা নাই

| গ্যাপ | প্রমাণ |
|---|---|
| **Domain → tenant mapping** | `TenantDomain` model নাই; `Tenant` model-এ domain field নাই; `req.hostname`/`headers.host` কোথাও read হয় না |
| **Public (guest) order endpoint** | `src/routes/api/order.api.js:7` — `createOrder`-এ `authGuard` + `authorize("order","add")` |
| **Chat/message model ও controller** | `src/models/`-এ chat/message/conversation কিছু নাই |
| **CORS-এ tenant domain** | `src/config/cors.config.js:5-12` — fixed allowlist (`FRONTEND_URL`, `DASHBOARD_URL`, `PLATFORM_URL`, `CORS_ORIGINS`)। নতুন seller-এর domain এখানে না থাকলে browser block করবে |
| **Payment-এর পর storefront-এ redirect** | `src/controller/payment.controller.js`-এ কোনো redirect নাই — JSON return করে |
| **Socket-এ কোনো inbound event handler** | `src/socket/socket.js:63-64` — শুধু `connection` আর `error`। একটাও `socket.on(...)` নাই, মানে socket এখন **একমুখী** (server→client)। Chat-এর জন্য দুইমুখী করতে হবে |

> **⚠️ একটা bug এখনই ধরা পড়েছে:** `src/middleware/guestOrAuth.js`-এ guest path-টা (`guestId` আছে, token নাই) শুধু `next()` call করে — **কোনো tenant context খোলে না**। `resolveRequestTenant` আগে চলে বলে `x-tenant` header থাকলে context খোলা থাকে এবং কাজ করে। কিন্তু header না থাকলে strict mode-এ cart query throw করবে। মানে guest cart পুরোপুরি `x-tenant` header-এর উপর নির্ভরশীল — এটা Step 2-এ শক্ত করতে হবে।

### ১.৩ Storefront (`frontend/`) — যা আছে

Next.js **16.3.4**, App Router। Route আছে: `/`, `/shop`, `/product/[slug]`, `/cart`, `/checkout`, `/wishlist`, `/track-order`, `/board/[slug]`, `/design-system`, আর `(auth)` group-এ `sign-in`, `sign-up`, `forgot-password`, `verify-otp`, `reset-password`।

### ১.৪ Storefront — যা নাই

- `middleware.ts`/`proxy.ts` — **নাই** (host দেখার কোনো জায়গাই নাই)
- কোনো backend call — `fetch(`/`axios` **শূন্য match**
- কোনো `.env` file, কোনো `process.env` read — **শূন্য**
- `headers()`/`cookies()` — কখনো import হয় না
- `x-tenant` — পুরো `src/`-এ শব্দটাই নাই
- Auth/cart/checkout-এর logic — শুধু markup; `sign-in-form.tsx:11`-এ comment: *"Design only — no action, no validation"*
- socket.io-client / chat — **নাই**

সব data fixture থেকে: `cart-fixture.ts`, `order-fixture.ts`, `wishlist-fixture.ts`, `catalog/products-a.ts` ইত্যাদি।

> **⚠️ Next.js 16-এর জরুরি নোট:** এই version-এ `middleware.ts` **deprecated**, নাম বদলে **`proxy.ts`** হয়েছে (`frontend/node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/middleware.md`)। তাই নিচে সব জায়গায় `proxy.ts` লেখা। কোড লেখার আগে `node_modules/next/dist/docs/` পড়ে নেবেন — `frontend/AGENTS.md` এটাই বলে।

---

## ২. কিভাবে কাজ করবে — আর্কিটেকচার

### ২.১ মূল সিদ্ধান্ত: tenant ঠিক হবে **domain থেকে**, browser-এর বলা কথায় নয়

একটা storefront request-এ tenant ঠিক করার দুইটা রাস্তা থাকতে পারে:

- ❌ **খারাপ:** browser `x-tenant: velor` পাঠাবে। কিন্তু browser-এর পাঠানো header যে কেউ বদলাতে পারে — shopper A তার own browser থেকে `x-tenant: pizzashop` পাঠিয়ে অন্য store-এর data চাইতে পারে (যদিও public data, তবুও এটা tenant boundary-কে client-এর হাতে ছেড়ে দেওয়া)।
- ✅ **ভালো:** **server** request-এর `Host` দেখে tenant ঠিক করবে। `velor.com` → velor-এর tenantId। Browser এতে হাত দিতে পারে না, কারণ Host ঠিক করে DNS + TLS, shopper না।

তাই নিয়ম: **storefront-এর জন্য tenant আসবে Host header থেকে; `x-tenant` থাকবে শুধু dashboard-এর জন্য।**

### ২.২ Request-এর পুরো পথ

```
Shopper velor.com এ order দিল
        │
        ▼
Nginx — velor.com → Next.js storefront (একটাই build, সব tenant-এর জন্য)
        │
        ▼
frontend/src/proxy.ts   ← Host পড়ে ("velor.com")
        │                 x-tenant-host header বসিয়ে দেয়
        ▼
Next.js Server Component / Server Action
        │  server-side fetch → api.velor-platform.com
        │  header: x-tenant-host: velor.com
        ▼
backend: resolveRequestTenant
        │  1) x-tenant-host আছে? → TenantDomain.findOne({ host }) → tenantId
        │  2) না থাকলে x-tenant (dashboard) → Tenant.findOne({ slug })
        ▼
runForTenant(tenantId, handler)
        │
        ▼
Controller → Mongoose → tenantPlugin নিজে থেকেই tenantId বসায়
        │
        ▼
Order velor-এর tenantId নিয়ে save হলো ✅
        │
        ▼
emitToTenant(tenantId, "orderPlaced") → শুধু velor-এর dashboard-এ notification ✅
```

**গুরুত্বপূর্ণ:** Controller-এর কোড বদলাতে হবে না। `tenantPlugin` ইতিমধ্যে সব query-তে `tenantId` বসায়। শুধু context খোলার জায়গাটা বাড়ছে — slug-এর পাশাপাশি এখন domain-ও।

### ২.৩ Live chat কিভাবে কাজ করবে

```
velor.com এ visitor chat খুলল
        │
        ▼
socket.io-client connect, auth: { tenant: "velor", guestId: "<random, localStorage-এ রাখা>" }
        │                        (tenant slug টা proxy.ts থেকে page-এ আসবে)
        ▼
backend socket.js:31 — guest path: slug → tenant, active কিনা check
        │
        ▼
socket.join("tenant:<velorId>:guest:<guestId>")       ← socket.js:51
        │
        ▼
visitor message পাঠাল → ChatMessage save (tenantId plugin বসাবে)
        │
        ▼
emitToTenant(velorId, "chat:message", ...)  → শুধু velor-এর staff room ✅
        │
        ▼
velor dashboard-এ message এল। Staff reply দিল।
        │
        ▼
emitToUserOrGuest(velorId, { guestId }, "chat:reply", ...) → শুধু ঐ visitor ✅
```

pizzashop-এর dashboard এটা **কখনো** পাবে না, কারণ room-এর নামেই tenantId ঢোকানো।

---

## ৩. ধাপে ধাপে প্ল্যান

প্রতিটা step আলাদা PR হিসেবে করা যাবে। "Done when" = কিভাবে বুঝবেন step টা শেষ।

### Step 1 — `TenantDomain` model + domain resolution (ভিত্তি)

**কেন আগে:** এটা ছাড়া বাকি কিছুরই ভিত্তি নাই।

**নতুন ফাইল:** `backend/src/models/platform/tenantDomain.model.js`

| Field | ধরন | নোট |
|---|---|---|
| `tenantId` | ObjectId, ref Tenant, indexed | কোন store |
| `host` | String, **unique**, lowercase | `velor.com`, `www.velor.com`, `velor.myplatform.com` |
| `isPrimary` | Boolean | canonical domain — email/SEO/redirect-এ এটা ব্যবহার হবে |
| `status` | enum: `pending` · `verifying` · `active` · `failed` | |
| `verificationToken` | String | DNS TXT record-এর জন্য |
| `verifiedAt` | Date | |

**Index:** `{ host: 1 }` unique। এক tenant-এর একাধিক domain থাকতে পারে, কিন্তু একটা domain দুই tenant-এর হতে পারবে না।

> এটা **global model** — `Tenant`/`TenantSettings`-এর মতো `tenantPlugin` লাগবে **না**। `backend/src/tenancy/registry.js`-এ global list-এ যোগ করতে হবে, নইলে registry test fail করবে।

**`tenantResolver.js`-এ যোগ করুন:** `getTenantByHost(host)` — `getTenantBySlug`-এর মতোই 30s cache ব্যবহার করে (`tenantResolver.js:5-16`)। দুই query: host → `TenantDomain` → tenantId → `Tenant`।

**`requestTenant.middleware.js` বদলান** — precedence সহ:

```js
// 1. x-tenant-host (storefront, proxy.ts বসিয়েছে) — সবচেয়ে বিশ্বাসযোগ্য
// 2. x-tenant (dashboard slug)
// কোনোটা না থাকলে: আগের মতোই context ছাড়া চলবে, strict mode query-তে ধরবে
```

**⚠️ নিরাপত্তা:** `x-tenant-host` header টা **শুধু** আপনার Nginx/proxy থেকে আসা উচিত। Nginx-এ client-এর পাঠানো `x-tenant-host` মুছে দিতে হবে:
```nginx
proxy_set_header x-tenant-host "";   # client যা পাঠাক, মুছে যাবে
```
নইলে shopper নিজে header পাঠিয়ে tenant spoof করতে পারবে।

**Done when:** `curl -H "x-tenant-host: velor.com" .../product/getproduct` velor-এর product দেয়, আর `pizzashop.com` দিলে pizzashop-এর।

**Test:** দুই tenant, একই product নাম। `x-tenant-host` বদলে দেখুন আলাদা result আসে। ইচ্ছা করে `getTenantByHost` ভেঙে দেখুন test ধরে কিনা।

---

### Step 2 — Guest context bug সারান + public catalog API

**২ক. `guestOrAuth.js`-এর bug:** guest path-এ tenant context খোলে না (উপরে §1.2 দেখুন)। যেহেতু storefront এখন Host দিয়ে tenant দেবে, `guestOrAuth`-কে নিশ্চিত করতে হবে যে context **আগেই** খোলা আছে; না থাকলে পরিষ্কার 400 (`TENANT_CONTEXT_REQUIRED`) দিতে হবে — strict mode-এর অস্পষ্ট error-এর বদলে।

**২খ. Public catalog endpoints:** যেগুলো ইতিমধ্যে auth ছাড়া আছে (`product.api.js:21,23,78,80,84` — `getproduct`, `getproduct/:slug`, `newarrival`, `price-range`, `discount-products`) সেগুলো Host-based context পেলেই কাজ করবে। শুধু যাচাই করুন কোনো staff-only field leak হচ্ছে কিনা (cost price, supplier, stock-এর ভেতরের হিসাব)।

**Done when:** `x-tenant-host` ছাড়া public product call করলে পরিষ্কার 400 আসে, আর header দিলে শুধু ঐ store-এর product আসে।

---

### Step 3 — Shopper auth + public checkout (সবচেয়ে বড় কাজ)

**কেন দরকার:** আজ order-এর সব route staff-only (`order.api.js:7-21`)। Shopper order দিতেই পারে না।

**৩ক. Shopper login/register.** `User` model-এ shopper = role-হীন user। `user.controller.js:158` ইতিমধ্যে dashboard login-এ role-হীন user block করে — এই বিভাজন ঠিক আছে। লাগবে storefront-এর জন্য আলাদা route, যেগুলো tenant পাবে Host থেকে (`workspace` body থেকে নয়):
- `POST /shop/auth/register`, `/login`, `/forgot-password`, `/reset-password`

Token-এ `aud: "shopper"` claim দিন, যাতে shopper token দিয়ে কেউ dashboard API-তে ঢুকতে না পারে।

**৩খ. `POST /shop/order` — public order creation.** `authGuard`-এর বদলে `guestOrAuth`। এখানে যা **অবশ্যই** করতে হবে:
- দাম **server-side** হিসাব করুন। Client-এর পাঠানো দাম/total কখনো বিশ্বাস করবেন না।
- Stock check করুন।
- Coupon server-side validate করুন।
- Order save হবে context-এর tenantId নিয়ে — plugin নিজেই বসাবে।
- `emitToTenant(tenantId, "orderPlaced", ...)` — dashboard-এ notification।

**৩গ. Payment redirect।** `payment.controller.js` এখন JSON return করে, কোনো redirect নাই। SSLCommerz-এর পর shopper-কে তার **নিজের** store-এর domain-এ ফেরত পাঠাতে হবে — `tenant.general.storefrontUrl` (`definitions.js:16`) অথবা primary `TenantDomain` থেকে। হার্ডকোড `FRONTEND_URL` ব্যবহার করলে সব seller-এর customer velor-এ গিয়ে পড়বে।

> Webhook URL ইতিমধ্যে tenant-wise (`settings.service.js:263`) — এটা বদলানো লাগবে না। ✅

**Done when:** দুই tenant-এর storefront থেকে order দিয়ে দেখুন প্রতিটা নিজের dashboard-এ আসে, অন্যটায় আসে না।

---

### Step 4 — Storefront-কে backend-এর সাথে যুক্ত করা

**৪ক. `frontend/src/proxy.ts`** (মনে রাখবেন: Next 16-এ `middleware.ts` নয়):

```ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const headers = new Headers(request.headers);
  headers.set("x-tenant-host", host.toLowerCase().replace(/:\d+$/, ""));
  return NextResponse.next({ request: { headers } });
}

export const config = {
  // static file গুলো বাদ — নইলে CSS/JS/image-ও এর ভেতর দিয়ে যাবে
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

**৪খ. API client** — `frontend/src/lib/api.ts` (নতুন)। `frontend/.claude/rules/scope.md` বলে fixture গুলোর function signature ঠিক রেখে ভেতরটা বদলাতে — সেই নিয়ম মেনে চলুন, তাহলে page গুলো ছুঁতে হবে না।

- Server Component-এ fetch করুন (browser থেকে নয়) — তাহলে `x-tenant-host` server-side থেকেই যাবে, আর CORS-ও লাগবে না।
- `headers()` দিয়ে incoming `x-tenant-host` পড়ে backend call-এ forward করুন।

**৪গ. Env:** `frontend/.env.local` লাগবে — `BACKEND_URL` (server-side, `NEXT_PUBLIC_` ছাড়া, কারণ browser-এ লাগবে না)।

**৪ঘ. Rendering:** এখন সব page static prerender হয় (কোনো dynamic API নাই)। Host দেখা শুরু করলেই route গুলো dynamic হয়ে যাবে — এটাই দরকার, কারণ এক build সব domain-এ আলাদা content দেবে। মনে রাখবেন: **`generateStaticParams` দিয়ে product page prerender করবেন না**, নইলে এক tenant-এর product অন্য tenant-এর domain-এ cache হয়ে যেতে পারে।

> **⚠️ Cache নিয়ে সাবধান:** Next.js-এর data cache tenant চেনে না। `fetch()`-এ cache key-তে host ঢোকান, অথবা storefront data-তে `cache: "no-store"` দিন। নইলে velor-এর product list pizzashop-এর domain-এ serve হতে পারে — dashboard-এ `queryKeyHashFn` দিয়ে যে সমস্যা সারানো হয়েছে, ঠিক সেই একই সমস্যা।

**Done when:** দুই domain locally `/etc/hosts` দিয়ে map করে দেখুন দুইটা আলাদা catalog দেখায়।

---

### Step 5 — CORS + Nginx

**৫ক. CORS।** `cors.config.js:5-12` এখন fixed allowlist। দুইটা রাস্তা:
- **সহজ ও নিরাপদ (সুপারিশ):** storefront সব call **server-side** করবে (Step 4খ)। তাহলে browser থেকে cross-origin call-ই হবে না, CORS-ও লাগবে না। নতুন seller add করলে কিছু বদলাতে হবে না।
- **দরকার হলে:** browser থেকে call করতেই হলে `isOriginAllowed`-কে `TenantDomain` lookup করাতে হবে (active domain হলে allow)। এতে প্রতি request-এ DB hit — cache লাগবে।

**৫খ. Nginx:** wildcard + custom domain, আর client-এর `x-tenant-host` মুছে ফেলা (Step 1-এর warning)।

**৫গ. TLS:** custom domain-এ automatic certificate লাগবে (Caddy on-demand TLS, বা Let's Encrypt + DNS verification)। `TenantDomain.status` এই flow-টার সাথে মিলিয়ে চালাবেন।

---

### Step 6 — Live chat

**৬ক. Model** — `backend/src/models/chatConversation.model.js`, `chatMessage.model.js`। দুইটাতেই `tenantPlugin` apply করতে হবে (নইলে registry test fail করবে — এটাই চাই)।

| Conversation | Message |
|---|---|
| `tenantId` (plugin) | `tenantId` (plugin) |
| `guestId` বা `userId` | `conversationId` |
| `status`, `lastMessageAt` | `body`, `senderType` (guest/staff), `senderId`, `readAt` |

**৬খ. Socket events** — এখানে একটা কাঠামোগত পরিবর্তন লাগবে: আজ socket **একমুখী**, একটাও `socket.on(...)` listener নাই (`socket.js:63-64`)। `joinRooms`-এ inbound handler যোগ করতে হবে (`chat:send` ইত্যাদি)।

তিনটা নিয়ম কড়াভাবে মানবেন:
- Handler-এর ভেতরে tenantId **সবসময়** `socket.data.tenantId` থেকে নেবেন — client-এর পাঠানো payload থেকে **কখনো না**। নইলে visitor নিজে tenantId পাঠিয়ে অন্য store-এ message ঢোকাতে পারবে।
- DB লেখার আগে `runForTenant(socket.data.tenantId, ...)` দিয়ে context খুলতে হবে — socket handler HTTP middleware-এর বাইরে চলে, তাই context আপনা-আপনি খোলে না।
- `emitToTenant` / `emitToUserOrGuest` (`socket.js:84,90`) ইতিমধ্যে আছে, নতুন broadcast function লিখবেন **না**। `io.emit()` কখনো না।

**৬গ. Storefront** — `socket.io-client` add করুন, `guestId` localStorage-এ রাখুন, tenant slug server থেকে page-এ pass করুন।

**৬ঘ. Dashboard** — inbox page, `tenant:<id>` room-এ আসা message দেখাবে।

**Done when:** দুই browser, দুই domain — velor-এ chat করলে শুধু velor dashboard-এ আসে। Test-এ pizzashop-এর socket দিয়ে velor-এর message শোনার চেষ্টা করে দেখুন fail করে।

---

## ৪. ঝুঁকির তালিকা (এগুলোই আসল বিপদ)

| # | ঝুঁকি | কেন বিপজ্জনক | প্রতিকার |
|---|---|---|---|
| ১ | **Header spoofing** | Client নিজে `x-tenant-host` পাঠিয়ে অন্য tenant সাজতে পারে | Nginx-এ header মুছুন (Step 1) |
| ২ | **Next.js data cache tenant চেনে না** | এক store-এর page অন্য store-এর domain-এ serve হতে পারে | cache key-তে host, বা `no-store` (Step 4ঘ) |
| ৩ | **Client-এর পাঠানো দাম বিশ্বাস করা** | Shopper দাম বদলে ১ টাকায় order দিতে পারবে | সব হিসাব server-side (Step 3খ) |
| ৪ | **Guest cart tenant context ছাড়া** | এখনই আছে — `guestOrAuth.js` | Step 2ক |
| ৫ | **Payment-এর পর ভুল domain-এ redirect** | Seller-এর customer অন্য seller-এর site-এ পড়বে | tenant-এর নিজের domain (Step 3গ) |
| ৬ | **Public API-তে staff field leak** | cost price/supplier shopper দেখে ফেলবে | Step 2খ-এ field-by-field যাচাই |
| ৭ | **এক domain দুই tenant-এ** | Tenant ঠিক করা অনিশ্চিত হয়ে যাবে | `host` unique index (Step 1) |
| ৮ | **Shopper token দিয়ে dashboard access** | Shopper staff API-তে ঢুকে যাবে | `aud: "shopper"` claim (Step 3ক) |
| ৯ | **Legacy `/payment/*` route tenant context ছাড়া** | `payment.api.js:8-11` — শুধু `legacyRoute` guard, কোনো tenant middleware নাই। `payment.controller.js:20,53`-এর `Order.findOneAndUpdate({ invoiceId })` shadow mode-এ **সব tenant জুড়ে** চলবে | `TENANCY_MODE=strict` রাখুন (এখন তাই আছে ✅); storefront চালু হলে route গুলো সরিয়ে দিন |
| ১০ | **`API_PUBLIC_URL` unset হলে webhook URL Host থেকে তৈরি** | `settings.service.js:264` fallback `requestOrigin`, যা আসে `settings.controller.js:99`-এর `req.get("host")` থেকে — header-নিয়ন্ত্রিত | production-এ `API_PUBLIC_URL` অবশ্যই set করুন (readiness report-এও এটা বলা আছে) |
| ১১ | **Webhook suspended tenant-ও গ্রহণ করে** | `webhookTenant.middleware.js:10` শুধু `cancelled` reject করে; suspended store-এর order update হয়ে যাবে | ব্যবসায়িক সিদ্ধান্ত — suspend করলে কি চলমান delivery update বন্ধ হবে? |

---

## ৫. কাজের ক্রম (সংক্ষেপে)

| ধাপ | কাজ | কোথায় | নির্ভরশীলতা |
|---|---|---|---|
| 1 | `TenantDomain` + Host resolution | backend | — |
| 2 | guest context bug + public catalog | backend | 1 |
| 3 | Shopper auth + public checkout + redirect | backend | 1, 2 |
| 4 | `proxy.ts` + API client + fixture সরানো | frontend | 1 |
| 5 | CORS + Nginx + TLS | infra | 1, 4 |
| 6 | Live chat (model + socket + UI) | backend + frontend + dashboard | 1, 4 |

**সুপারিশ:** Step 1-2-4 আগে করুন (একটা tenant-এর storefront read-only চলবে), তারপর 3 (order), তারপর 5 (production domain), শেষে 6 (chat)।

---

## ৬. যেসব সিদ্ধান্ত আপনাকে নিতে হবে

| # | প্রশ্ন | সুপারিশ |
|---|---|---|
| ১ | প্রতি seller-এর নিজের domain, নাকি `<slug>.yourplatform.com` subdomain? | দুইটাই support করুন — `TenantDomain` দুইটাই সামলায়। শুরুতে subdomain (TLS সহজ), custom domain পরে |
| ২ | Storefront কি এক Next.js app সব tenant-এর জন্য? | হ্যাঁ — dashboard-এর মতোই এক build। per-tenant build অচল হয়ে যাবে |
| ৩ | Theme/design কি tenant-ভেদে আলাদা হবে? | শুরুতে এক design + per-tenant logo/color/name settings থেকে |
| ৪ | Shopper account কি সব store-এ এক, নাকি store-প্রতি আলাদা? | store-প্রতি আলাদা (architecture doc §13 Q6-এর সিদ্ধান্তের সাথে মিল) |
| ৫ | Chat-এ কি staff-কে online/offline দেখাবেন, offline হলে email? | Phase 2-এ রাখুন; আগে basic chat চালু হোক |

---

## ৭. মূল ডকুমেন্টে যে সংশোধন দরকার

`dashboard-backend-multitenant-architecture.md` কয়েক জায়গায় বাস্তবতার সাথে মেলে না:

| জায়গা | লেখা আছে | আসলে |
|---|---|---|
| §2.1 (line 137) | `tenantDomain.model.js` আছে | **নাই** |
| §2.1 (line 148) | `groq.client.js` | নাই (উপরের banner-এ স্বীকার করা আছে) |
| §1 (line 105) | `worker-embed` pm2 process | নাই (RAG সরানো হয়েছে) |
| §0 (line 73) | "Storefront later" | `frontend/` ইতিমধ্যে আছে (UI shell), শুধু disconnected |
| §5.2 (line 308) | `REFRESH_TOKEN_SECRET` (typo সারানো হবে) | কোডে এখনো `REFRESH_TOKEN_SCCERET` |
| §10 (line 743) | "next → Storefront" | এই ডকুমেন্টটাই সেই পরবর্তী ধাপ |

এগুলো পরে এক PR-এ ঠিক করা যাবে — এই প্ল্যানের কাজ শুরু করতে বাধা নাই।

---

## ৮. শেষ কথা

আপনার multi-user/multi-tenant **ভিত্তি তৈরি এবং শক্ত** — plugin fail-closed, socket tenant-room করা, webhook tenant-wise, settings per-tenant। Storefront-এর জন্য নতুন করে isolation বানাতে হবে না; শুধু **context খোলার একটা নতুন দরজা** (Host → tenantId) আর **storefront-কে backend-এর সাথে যুক্ত করা** বাকি।

সবচেয়ে বড় কাজ Step 3 (public checkout), কারণ এখানে নতুন business logic লিখতে হবে — দাম, stock, coupon সবই server-side। বাকি step গুলো তুলনামূলক যান্ত্রিক।
