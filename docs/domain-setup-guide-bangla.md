# Seller-এর Domain যোগ ও Server-এ সংযোগ — সহজ গাইড

> তারিখ: ২২ অক্টোবর ২০২৬
> এই ফাইলে আছে: domain কীভাবে কাজ করে, এখন পর্যন্ত কী করা হয়েছে, আর প্রতিটা নতুন seller-এর জন্য ধাপে ধাপে কী করতে হবে।

---

## ১. মূল ধারণা — এক লাইনে

**একটাই software (ECOMPOS), একটাই server, কিন্তু অনেক দোকান।** প্রতিটা দোকান (seller/tenant) নিজের domain-এ খুলবে, আর software domain দেখে বুঝবে কোন দোকানের পণ্য দেখাতে হবে।

```
smartsoft.com   ─┐
colormens.com   ─┼──►  একই server (179.197.243.59)  ──►  ECOMPOS
velor.com       ─┘           │
                             └─ domain দেখে ঠিক দোকান বের করে
```

---

## ২. Domain কাজ করতে তিনটা জিনিস লাগে

একটা ঘরের ঠিকানার মতো ভাবুন:

| # | কী | কাজ | কোথায় করবেন |
|---|---|---|---|
| ১ | **A record** | domain → server-এর IP। "এই ঠিকানায় এই বাড়ি।" এটা না থাকলে browser server-ই খুঁজে পাবে না | Seller-এর DNS panel (satisfyhost, GoDaddy ইত্যাদি) |
| ২ | **TXT record** | প্রমাণ করে domain-টা সত্যিই এই seller-এর। এটা না থাকলে কেউ অন্যের domain নিজের দোকানে বসিয়ে দিতে পারত | Seller-এর DNS panel |
| ৩ | **Server-এ domain যোগ + SSL** | server জানবে এই domain এলে কোন app খুলতে হবে, আর `https://` (তালা চিহ্ন) চালু হবে | Dokploy |

### A আর TXT-এর পার্থক্য

| | A record | TXT record |
|---|---|---|
| কে পড়ে | প্রতিটা ক্রেতার browser, প্রতিবার | শুধু ECOMPOS backend, একবার ("Verify DNS" চাপলে) |
| কী বলে | "server-এর IP এটা" | "এই domain-এর মালিক এই seller" |
| না থাকলে | site খুলবে না | console-এ domain **Active** হবে না |

**শুধু A দিয়ে মালিকানা প্রমাণ হয় না কেন?** সব seller-এর A record একই IP-তে যায়। তাই "domain আমাদের server-এ আসছে" জানা গেলেও **কোন seller-এর** সেটা বোঝা যায় না। TXT-এ প্রতিটা domain-এর জন্য আলাদা গোপন token থাকে, যেটা শুধু ওই seller পেয়েছে।

---

## ৩. একজন ক্রেতা site খুললে কী ঘটে

```
ক্রেতা browser-এ লিখল: mysmartsoftinnovation.com
        │
        ▼
① DNS: A record → 179.197.243.59
        │
        ▼
② Server-এ Traefik (Dokploy-র ভেতরে): এই domain কোন app-এর? → frontend
   + SSL certificate দিয়ে https
        │
        ▼
③ Frontend (Next.js): backend-কে ডাকে, সাথে পাঠায়
   x-tenant-host: mysmartsoftinnovation.com
        │
        ▼
④ Backend: TenantDomain খোঁজে → domain Active? → কোন tenant?
   → "Smartsoft Innovation"
        │
        ▼
⑤ শুধু Smartsoft Innovation-এর পণ্য, দাম, order দেখায়
   (অন্য দোকানের data কখনো মেশে না — tenantPlugin নিশ্চিত করে)
```

---

## ৪. এখন পর্যন্ত কী করা হয়েছে

### ✅ সম্পূর্ণ

| কাজ | কোথায় |
|---|---|
| Domain-এর database model (host, status, primary, token) | `backend/src/models/platform/tenantDomain.model.js` |
| DNS TXT যাচাই | `backend/src/service/domainVerification.service.js` |
| Domain যোগ / verify / primary / মুছে ফেলার API | `backend/src/controller/platform/domain.controller.js` |
| Domain দেখে tenant বের করা | `backend/src/tenancy/tenantResolver.js`, `requestTenant.middleware.js` |
| Payment-এর পর সঠিক domain-এ ফেরত পাঠানো | `backend/src/service/storefrontUrl.service.js` |
| **Platform Console-এ Domains tab** (যোগ, verify, primary, delete) | `dashbaord/src/pages/PlatformConsole/SellerDomainsTab.tsx` |
| Brand নাম velor → **ECOMPOS** (TXT এখন `_ecompos-verify`) | domainVerification service |
| পুরনো database থেকে নতুন database-এ সব data (৪৬৬টা document) | port 27018 → 27030 |
| আপনার domain-এর TXT record — DNS-এ দেখা যাচ্ছে | satisfyhost |

### ❌ এখনো বাকি — এগুলো ছাড়া site খুলবে না

| # | কাজ | কেন দরকার |
|---|---|---|
| ১ | `mysmartsoftinnovation.com`-এর **A record** (`@` → `179.197.243.59`) | এখনো নেই। browser server খুঁজে পাবে না |
| ২ | Console-এ **Verify DNS** চাপা | TXT তৈরি, এখন চাপলেই Active হবে |
| ৩ | **Dokploy-তে domain যোগ** (frontend app-এ) + Let's Encrypt | Traefik না জানলে "404 page not found" দেখাবে (এখন IP-তে গেলে ঠিক এটাই দেখায়) |
| ৪ | **Frontend-কে backend-এর সাথে যুক্ত করা** | ⚠️ বড় কাজ। এখন frontend-এ পণ্য, ক্যাটাগরি সব **নমুনা data** (`frontend/src/lib/*.ts`)। backend-কে একবারও ডাকে না। তাই domain যতই ঠিক থাকুক, সব domain-এ একই নমুনা দোকান দেখাবে |
| ৫ | Backend `.env`-এ `TRUST_TENANT_HOST_HEADER=true` | না থাকলে backend `x-tenant-host` উপেক্ষা করে (নিরাপত্তার জন্য ইচ্ছা করেই বন্ধ রাখা) |
| ৬ | Public API-তে `x-tenant-host` মুছে ফেলা | না হলে যে কেউ সরাসরি API-তে header পাঠিয়ে অন্য দোকান সাজতে পারবে (§৭ দেখুন) |

---

## ৫. নতুন seller-এর domain — ধাপে ধাপে

ধরি seller-এর domain `colormens.com`।

### ধাপ ১ — Console-এ domain যোগ (আপনি)

1. Dashboard → **Platform Console → Sellers** → seller খুলুন
2. **Domains** tab → **Add domain** → `colormens.com` লিখুন
3. প্রথম domain হলে নিজে থেকেই **Primary** হবে
4. Status দেখাবে **Awaiting DNS**, নিচে TXT record-এর Name আর Value থাকবে

### ধাপ ২ — Seller-কে এটা পাঠান (copy করে)

```
আপনার domain-এর DNS panel-এ "Add Record" দিয়ে নতুন দুটো record যোগ করুন:

১) Type: TXT
   Name: _ecompos-verify
   Value: ecompos-verify=<console থেকে copy করা token>

২) Type: A
   Name: @
   Value: 179.197.243.59

পুরনো কোনো record edit করবেন না। www-ও চাইলে:
৩) Type: A   Name: www   Value: 179.197.243.59
```

> 💡 অনেক panel নিজে থেকেই `.colormens.com` যোগ করে দেয়। তাই Name-এ শুধু `_ecompos-verify` লিখবেন, পুরো domain না।

### ধাপ ৩ — DNS ছড়ানোর অপেক্ষা

সাধারণত ৫–৩০ মিনিট, কখনো কয়েক ঘণ্টা। নিজে যাচাই করতে:

```bash
dig +short TXT _ecompos-verify.colormens.com    # token দেখাবে
dig +short A colormens.com                      # 179.197.243.59 দেখাবে
```

### ধাপ ৪ — Verify DNS (আপনি)

Console → Domains → **Verify DNS**।
- ✅ **Active** → এগিয়ে যান
- ❌ **Failed** → লাল লেখায় কারণ দেখাবে। সাধারণত DNS এখনো ছড়ায়নি, কিছুক্ষণ পর আবার চাপুন

### ধাপ ৫ — Dokploy-তে domain যোগ (আপনি)

1. Dokploy → project → **frontend** application → **Domains** → **Add Domain**
2. **Host:** `colormens.com`
3. **Path:** `/`
4. **Container Port:** frontend যে port-এ চলে (Next.js সাধারণত `3000`)
5. **HTTPS:** চালু
6. **Certificate:** Let's Encrypt
7. Save → Deploy

> ⚠️ Let's Encrypt certificate তখনই দেবে যখন A record আগে থেকেই এই server-এ আসছে। তাই ধাপ ২-এর A record আগে, তারপর এই ধাপ।

`www.colormens.com`-ও চাইলে একই ভাবে আরেকটা domain যোগ করুন (console-এ আর Dokploy-তে দুই জায়গাতেই)।

### ধাপ ৬ — পরীক্ষা

`https://colormens.com` খুলুন → তালা চিহ্ন আছে কি না, আর ওই seller-এর দোকান দেখাচ্ছে কি না দেখুন।
(বাকি কাজ #৪ শেষ না হওয়া পর্যন্ত নমুনা দোকান দেখাবে।)

---

## ৬. আপনার domain `mysmartsoftinnovation.com` — এখন কোথায় আছে

| ধাপ | অবস্থা |
|---|---|
| Console-এ যোগ | ✅ হয়েছে (Primary) |
| TXT `_ecompos-verify` | ✅ DNS-এ দেখা যাচ্ছে (1.1.1.1, 8.8.8.8, satisfyhost তিন জায়গাতেই) |
| Verify DNS | ⏳ এখন চাপুন → Active হবে |
| A `@` → `179.197.243.59` | ❌ যোগ করুন (**Add Record** দিয়ে) |
| Dokploy-তে domain | ❌ বাকি |
| পুরনো ভুল TXT `@` = `179.197.243.59` | ⚠️ ক্ষতি নেই, পরে satisfyhost support দিয়ে মুছিয়ে নিন (panel-এর error reference: DNS-5F574056, DNS-FC83CDE3, DNS-F919E523) |

---

## ৭. Server-এ একবারের সেটআপ (সব seller-এর জন্য)

### ৭.১ Backend env

Dokploy → backend application → Environment-এ যোগ করুন, তারপর redeploy:

```
TRUST_TENANT_HOST_HEADER=true
```

### ৭.২ Frontend কীভাবে domain পাঠাবে

Frontend-এর server-side code প্রতিটা request-এর `Host` পড়ে backend-কে `x-tenant-host` হিসেবে পাঠাবে। ক্রেতার browser এটা ঠিক করতে পারবে না, কারণ frontend নিজে বসায়:

```ts
// Next.js Server Component / route handler-এর ভেতরে
import { headers } from "next/headers";

const host = (await headers()).get("host");          // যেমন colormens.com
const res = await fetch(`${process.env.API_URL}/categories`, {
  headers: { "x-tenant-host": host ?? "" },
  cache: "no-store",                                // অথবা cache key-তে host রাখুন
});
```

**দুটো সতর্কতা:**
- Next-এর data cache domain চেনে না। cache key-তে host না থাকলে **এক দোকানের পাতা অন্য দোকানে দেখাবে**।
- `generateStaticParams` দিয়ে product page আগে থেকে বানাবেন না। ওগুলো কোনো একটা দোকানের হয়ে যায়।

### ৭.৩ Public API-তে header মুছে ফেলা (নিরাপত্তা)

`api.…` domain internet-এ খোলা। কেউ সরাসরি API-তে `x-tenant-host: অন্যের-domain.com` পাঠালে backend বিশ্বাস করবে। তাই public API router-এ Traefik দিয়ে header মুছতে হবে:

```yaml
# Dokploy → backend → Advanced → Traefik (বা labels)
http:
  middlewares:
    strip-tenant-host:
      headers:
        customRequestHeaders:
          x-tenant-host: ""      # খালি মান = header মুছে ফেলা
```

Frontend যেন backend-কে **internal network** দিয়ে ডাকে (Docker service name, যেমন `http://backend:5000/api/v1`), public `api.…` দিয়ে না। তাহলে frontend-এর পাঠানো header থাকবে, বাইরের কারো পাঠানো header মুছে যাবে।

---

## ৮. সাধারণ সমস্যা ও সমাধান

| সমস্যা | কারণ | সমাধান |
|---|---|---|
| Console-এ "No TXT record found" | DNS এখনো ছড়ায়নি, বা Name ভুল | `dig` দিয়ে দেখুন। Name-এ শুধু `_ecompos-verify` |
| "does not match the expected value" | Value-তে ভুল/বাড়তি অক্ষর | console থেকে আবার copy করুন, quote ছাড়া |
| Browser: "site can't be reached" | A record নেই | `A @ 179.197.243.59` |
| Browser: "404 page not found" | Dokploy-তে domain যোগ হয়নি | ধাপ ৫ |
| Browser: certificate error | Let's Encrypt পায়নি (A record দেরিতে এসেছে) | A ঠিক হওয়ার পর Dokploy-তে redeploy |
| Site খোলে কিন্তু "Store not found" | Domain console-এ Active না, অথবা `TRUST_TENANT_HOST_HEADER` নেই | Verify DNS + env |
| সব domain-এ একই দোকান | Frontend এখনো নমুনা data দেখায় | বাকি কাজ #৪ |
| DNS panel-এ "record no longer exists" | panel-এর bug, পুরনো row edit করলে হয় | edit না করে **Add Record** দিয়ে নতুন বানান |

---

## ৯. মনে রাখার তালিকা (নতুন seller প্রতি)

```
□ Console → Domains → Add domain
□ Seller-কে TXT + A record পাঠানো
□ dig দিয়ে দুটোই দেখা যাচ্ছে
□ Console → Verify DNS → Active
□ Dokploy → frontend → Domains → Add (HTTPS, Let's Encrypt)
□ https://domain খুলে পরীক্ষা
```

> **নোট:** প্রতিটা seller-এর জন্য Dokploy-তে হাতে domain যোগ করতে হবে। Seller অনেক বেড়ে গেলে এটা স্বয়ংক্রিয় করা যায়: Caddy-র "on-demand TLS" নিজে থেকে certificate নেয়, আর backend-কে জিজ্ঞেস করে domain Active কি না। দরকার হলে পরে করা যাবে।

---

## ১০. Website কীভাবে বোঝে কোন দোকান (এখন তৈরি)

ক্রেতার browser কোনো tenant id পাঠায় না। পাঠালে যে কেউ বদলে অন্য দোকান সাজতে পারত। বরং **Next.js server** নিজে domain পড়ে backend-কে জানায়:

```
ক্রেতা → https://mysmartsoftinnovation.com
          │  Host: mysmartsoftinnovation.com   (DNS + Traefik ঠিক করে, ক্রেতা না)
          ▼
Next.js server (Logo ইত্যাদি Server Component)
          │  storeHostFrom(await headers())  → "mysmartsoftinnovation.com"
          │  fetch(API_URL + "/shop/store", { headers: { "x-tenant-host": ... } })
          ▼
Backend → TenantDomain (Active) → Smartsoft Innovation → { name, logo }
```

| ফাইল | কাজ |
|---|---|
| `frontend/src/lib/store-api.ts` | `storeHostFrom()` Host পড়ে; `apiFetch()` প্রতিটা call-এ `x-tenant-host` বসায়; `getStore()` দোকানের নাম আর logo আনে |
| `frontend/src/components/layout/logo.tsx` | header/footer-এ আসল দোকানের নাম আর logo দেখায় |
| `backend` → `GET /shop/store` | domain অনুযায়ী দোকানের নাম আর logo (login ছাড়াই) |

**নিয়ম:** backend-কে সবসময় **server থেকে** ডাকুন (Server Component বা Server Action)। Client component-এ সরাসরি API ডাকবেন না। তাহলে header বসানোর কাজ browser-এ চলে যাবে।

### Local-এ চালানো

`frontend/.env.local`:
```
API_URL=http://localhost:3000/api/v1
DEV_TENANT_HOST=mysmartsoftinnovation.com   # localhost-এ কোন দোকান দেখাবে
```
`backend/.env`-এ `TRUST_TENANT_HOST_HEADER=true`, তারপর backend restart।

### Production (Dokploy)

- Frontend env: `API_URL=http://<backend-service-name>:3000/api/v1` (internal network, public `api.…` না)
- Backend env: `TRUST_TENANT_HOST_HEADER=true`
- Public API-তে `x-tenant-host` মুছে ফেলার Traefik middleware (§৭.৩)
