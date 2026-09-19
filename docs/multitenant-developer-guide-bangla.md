# Multi-tenant Developer Guide (বাংলা)

এই ডকুমেন্টটি একটি নির্দিষ্ট বিভ্রান্তির উত্তর:

> "সুপার অ্যাডমিন দিয়ে লগইন করলাম, কিন্তু যে প্রোডাক্টগুলো দেখাচ্ছে সেগুলো কোন সেলারের বুঝতে পারছি না। নতুন ফিচার বানালে বা বাগ ফিক্স করলে সেটা কি সব সেলারের কাছে যাবে? ডেভেলপমেন্ট কোথা থেকে শুরু করব?"

সংক্ষিপ্ত উত্তর আগে, তারপর কোড ধরে ধরে ব্যাখ্যা।

---

## ১. এক লাইনের উত্তর

**আপনি এখন যা দেখছেন সেটা `smartsoftinovation` নামের স্টোরের ডেটা** — কোনো "সব সেলারের মিলিত ডেটা" নয়।

**কোড সব সেলারের জন্য এক** (একটাই কোডবেস, একটাই ডেপ্লয়মেন্ট)। তাই নতুন ফিচার বা বাগ ফিক্স ডেপ্লয় করলে সেটা **সাথে সাথে সব সেলার পেয়ে যাবে**।

**ডেটা প্রত্যেক সেলারের আলাদা**। এক সেলারের প্রোডাক্ট, অর্ডার, ইউজার আরেক সেলার কখনো দেখতে পাবে না — এটা ডাটাবেস লেভেলে জোর করে আটকানো আছে।

মানে: **কোড = শেয়ার্ড। ডেটা = আলাদা।**

---

## ২. "সুপার অ্যাডমিন" শব্দটাই আসল বিভ্রান্তির কারণ

এই সিস্টেমে **দুইটা সম্পূর্ণ আলাদা ধরনের অ্যাডমিন** আছে। নাম শুনে মনে হয় একই জিনিস, কিন্তু না।

### ক) স্টোর ওনার / সুপার অ্যাডমিন (আপনি যেটা দিয়ে লগইন করেছেন)

- এটা `users` কালেকশনের একটা সাধারণ row, যার `tenantId` আছে।
- রোল: `owner` (আগে এর slug ছিল `superadmin`, মাইগ্রেশন `005-owner-role` এটাকে `owner` করে দিয়েছে)।
- ক্ষমতা: **নিজের স্টোরের ভেতরে সব কিছু**। পারমিশন চেক বাইপাস করে — কিন্তু শুধু নিজের স্টোরে।
- কোড: `backend/src/middleware/checkPermission.middleware.js:33`

```js
// The store owner bypasses permission checks — only inside their own store
const isSuperAdminUser = (user) => {
  const owner = (user?.roles || []).some((role) => OWNER_ROLE_SLUGS.includes(role?.slug));
  if (!owner) return false;
  const tenantId = getTenantId();
  return !tenantId || !user.tenantId || tenantId.equals(user.tenantId);
};
```

শেষ লাইনটাই মূল কথা — ownership শুধু তখনই কাজ করে যখন রিকোয়েস্টের tenant আর ইউজারের tenant এক।

### খ) প্ল্যাটফর্ম অপারেটর (আপনি = প্ল্যাটফর্মের মালিক)

- এটা সম্পূর্ণ আলাদা কালেকশন: `platformusers`। কোনো `tenantId` নেই।
- লগইনও আলাদা: `POST /platform/auth/login` → ইমেইল/পাসওয়ার্ড → শুধু OTP চ্যালেঞ্জ ফেরত দেয় → `POST /platform/auth/verify-otp` এ ৬ ডিজিটের SMS কোড → তবেই platform token।
- ক্ষমতা: সেলার তৈরি করা, সেলারের ইন্টিগ্রেশন সেট করা, সাসপেন্ড করা। **সেলারের প্রোডাক্ট/অর্ডার ব্রাউজ করার জন্য নয়।**
- ডাটাবেসে এখন আছে: ১ জন।

**আপনার এখনকার অবস্থা:** আপনি স্টোর সুপার অ্যাডমিন হিসেবে `smartsoftinovation` স্টোরে ঢুকেছেন, প্ল্যাটফর্ম অপারেটর হিসেবে নয়। তাই `smartsoftinovation`-এর ১৪টা প্রোডাক্ট দেখছেন।

---

## ৩. এখন ডাটাবেসে আসলে কী আছে

লাইভ ডাটাবেস (`jahir`) থেকে গোনা:

| Tenant | slug | Users | Products | Roles |
|---|---|---|---|---|
| Velor (প্ল্যাটফর্ম ওয়ার্কস্পেস) | `smartsoftinovation` | 4 | 14 | 6 |
| Montaha Cosmetics | `montaha-cosmetics` | 1 | 0 | 1 |

ইউজারগুলো:

| স্টোর | ইমেইল | রোল |
|---|---|---|
| smartsoftinovation | `superadmin@baig.com` | owner |
| smartsoftinovation | `karif9632@gmail.com` | owner |
| smartsoftinovation | `real4ndsharif@gmail.com` | admin |
| smartsoftinovation | `bdvelor@gmail.com` | cashier |
| montaha-cosmetics | `taufikislam172@gmail.com` | owner |

**তাই যে ১৪টা প্রোডাক্ট দেখছেন, সেগুলো ১০০% `smartsoftinovation` স্টোরের।** `montaha-cosmetics`-এ এখনো একটাও প্রোডাক্ট নেই — ওই স্টোরে লগইন করলে প্রোডাক্ট লিস্ট খালি দেখাবে।

---

## ৪. সিস্টেম কীভাবে বুঝে কোন স্টোরের ডেটা দেখাবে

প্রতিটা রিকোয়েস্টে চারটা ধাপ ঘটে।

### ধাপ ১ — ড্যাশবোর্ড হেডারে স্টোর জানায়

লগইনের সময় আপনি **workspace** (স্টোরের slug) দেন। সেটা localStorage-এ থাকে, আর প্রতিটা API কলে `x-tenant` হেডারে যায়।

`dashbaord/src/hooks/useAxiosSecure.tsx` এটা পাঠায়।

### ধাপ ২ — ব্যাকএন্ড slug থেকে tenant বের করে

`backend/src/middleware/requestTenant.middleware.js:51`

```js
const slug = req.headers["x-tenant"];
if (!slug) return next();

const tenant = await getTenantBySlug(slug);
if (!tenant) throw new customError("Store not found", ...);
assertTenantActive(tenant, statusCodes.FORBIDDEN);

req.tenant = tenant;
runForTenant(tenant._id, () => next());
```

`runForTenant()` একটা AsyncLocalStorage স্কোপ খুলে দেয় — এর ভেতরের সব কোড "আমি এই tenant-এ আছি" জানে।

### ধাপ ৩ — টোকেনের tenant মিলিয়ে দেখা হয়

হেডার নকল করে অন্য স্টোরে ঢোকা যাবে না। `backend/src/middleware/authMiddleware.js:58`

```js
const requestTenant = getTenantId();
if (requestTenant && !requestTenant.equals(tenant._id)) {
  throw unauthorized("This session belongs to a different store");
}
```

JWT-তে `tid` (tenant id) claim থাকে। হেডারে অন্য slug দিলে রিকোয়েস্ট ৪০১ হয়ে যায়।

### ধাপ ৪ — প্রতিটা ডাটাবেস কোয়েরি অটোমেটিক ফিল্টার হয়

এটাই সবচেয়ে গুরুত্বপূর্ণ অংশ। `backend/src/tenancy/tenantPlugin.js` প্রত্যেকটা মডেলে লাগানো। কন্ট্রোলার `Product.find()` লিখলেও ডাটাবেসে আসলে যায় `Product.find({ tenantId: <current tenant> })`।

তাই কন্ট্রোলারে tenantId নিয়ে ভাবার দরকারই নেই — প্লাগইন নিজে জুড়ে দেয়।

আর `.env`-এ আছে:

```
TENANCY_MODE=strict
```

`strict` মানে — tenant context ছাড়া কোনো কোয়েরি চালালে সেটা **থ্রো করবে**, চুপচাপ সব tenant-এর ডেটা ফেরত দেবে না। অর্থাৎ ভুল করলে ধরা পড়বে, লিক হবে না।

---

## ৫. আপনার আসল প্রশ্ন: ফিচার বানালে সব সেলার পাবে কি?

**হ্যাঁ, পাবে — এবং সেটাই উদ্দেশ্য।**

এটা একটা **single-codebase multi-tenant SaaS**। একটাই ব্যাকএন্ড প্রসেস, একটাই ড্যাশবোর্ড বিল্ড, একটাই ডাটাবেস — সব সেলার সেখানেই চলে।

| জিনিস | শেয়ার্ড না আলাদা |
|---|---|
| ব্যাকএন্ড কোড | শেয়ার্ড — সবাই একই কোড চালায় |
| ড্যাশবোর্ড কোড | শেয়ার্ড — একটাই বিল্ড সব স্টোরকে সার্ভ করে |
| ডাটাবেস কালেকশন | শেয়ার্ড কালেকশন, কিন্তু `tenantId` দিয়ে আলাদা করা row |
| প্রোডাক্ট, অর্ডার, কাস্টমার, রোল, সেটিংস | সম্পূর্ণ আলাদা প্রতি সেলারে |
| ইন্টিগ্রেশন (SMS, পেমেন্ট, কুরিয়ার) | আলাদা — প্রতি সেলারের নিজের API key |

তাই:

- আপনি যে "Order From" ফিচারটা আজ বানালেন — ডেপ্লয়ের পর **smartsoftinovation আর montaha-cosmetics দুইজনেই** পাবে।
- বাগ ফিক্স করলে **সব সেলারের বাগ একসাথে ফিক্স** হবে।
- কোনো এক সেলারের জন্য আলাদা করে কোড লেখার দরকার নেই, লেখাও উচিত নয়।

### কিন্তু একটা ব্যতিক্রম: ডেটা মাইগ্রেশন

কোড সবার জন্য এক, কিন্তু **পুরনো ডেটা** ঠিক করতে হলে সেটা প্রতি tenant-এ আলাদা করে চালাতে হয়:

```bash
npm run migrate -- --tenant smartsoftinovation
npm run migrate -- --tenant montaha-cosmetics
```

`src/migrations/runner.js` প্রতিটা মাইগ্রেশন প্রতি tenant-এ একবার চালায় এবং `migrations` কালেকশনে রেকর্ড রাখে।

---

## ৬. তাহলে ডেভেলপমেন্ট কোথা থেকে করব?

### নিয়ম: যেকোনো একটা স্টোরে লগইন করে কাজ করুন

কোড শেয়ার্ড, তাই **যে স্টোরে ডেটা আছে সেখানেই ডেভেলপ করুন**। এখন সেটা `smartsoftinovation` — ১৪টা প্রোডাক্ট, ৪ জন ইউজার, রোল সব সেট করা আছে।

`montaha-cosmetics` খালি, তাই ওখানে প্রোডাক্ট লিস্ট, অর্ডার — কিছুই টেস্ট করতে পারবেন না।

**সুপারিশ:**

| কাজ | কোথায় করবেন |
|---|---|
| সাধারণ ফিচার / বাগ ফিক্স | `smartsoftinovation` স্টোরে লগইন করে |
| "নতুন সেলারের কাছে কেমন দেখায়" টেস্ট | `montaha-cosmetics` স্টোরে লগইন করে |
| সেলার তৈরি, ইন্টিগ্রেশন কনফিগার | Platform Console (`/platform/sellers`) |

### দুইটা স্টোর সুইচ করবেন কীভাবে

সাইন-ইন ফর্মে workspace slug লিখুন:

- `smartsoftinovation` → ডেটাওয়ালা স্টোর (প্ল্যাটফর্ম ওয়ার্কস্পেস)
- `montaha-cosmetics` → খালি স্টোর

অথবা URL-এ: `http://localhost:5173/signin?workspace=montaha-cosmetics`

### নতুন ফিচার বানানোর সময় একটাই নিয়ম মনে রাখবেন

**নতুন মডেল বানালে অবশ্যই `tenantPlugin` লাগাতে হবে।**

```js
const { tenantPlugin } = require("../tenancy/tenantPlugin");
// ... schema ...
mySchema.plugin(tenantPlugin);   // ← এটা ভুলবেন না
```

না লাগালে সেই মডেলের ডেটা সব সেলারের মধ্যে মিশে যাবে — একজনের ডেটা আরেকজন দেখে ফেলবে।

ভালো খবর: **টেস্ট এটা ধরে ফেলে।** `tests/integration/tenancyRegistry.test.js` চেক করে যে প্রত্যেক মডেলে প্লাগইন আছে, অথবা ইচ্ছাকৃতভাবে `src/tenancy/registry.js`-এর `GLOBAL_MODELS` লিস্টে আছে।

আজকের `OrderSource` মডেলটাও এই নিয়ম মেনেই বানানো — তাই smartsoftinovation-এ "TikTok" সোর্স যোগ করলে montaha-cosmetics সেটা দেখবে না।

---

## ৭. Platform Console কোথায়, কেন দেখছেন না

সাইডবারে Platform Console (Sellers, Store Settings, Operators) দেখা যায় শুধু তখনই, যখন:

1. আপনি `VITE_PLATFORM_WORKSPACES`-এ লিস্ট করা কোনো workspace-এর **owner**, এবং
2. আপনি ওই workspace-এ লগইন করা।

`dashbaord/.env`-এ সেট করা আছে:

```
VITE_PLATFORM_WORKSPACES=smartsoftinovation
```

তাই `smartsoftinovation`-এ owner হিসেবে লগইন করলে Platform Console দেখবেন; `montaha-cosmetics`-এ লগইন করলে দেখবেন না।

কোড: `dashbaord/src/platform/visibility.ts:11`

> খেয়াল রাখবেন: এই সেটিংটা শুধু **সাইডবার দেখা-না-দেখা** নিয়ন্ত্রণ করে, এবং এটা সম্পূর্ণভাবে ফ্রন্টএন্ডের ব্যাপার — ব্যাকএন্ড `PLATFORM_WORKSPACES` পড়েই না। আসল নিরাপত্তা সার্ভারে: Platform Console-এর API গুলো চালাতে আলাদা platform token লাগে (`platformGuard` মিডলওয়্যার), যেটা পেতে ইমেইল+পাসওয়ার্ড **এবং** SMS OTP দুইটাই লাগে।

---

## ৮. এক নজরে চিট শিট

```
প্ল্যাটফর্ম অপারেটর (platformusers কালেকশন, tenantId নেই)
  └── সেলার তৈরি/সাসপেন্ড/ইন্টিগ্রেশন সেট করে
        │
        ├── Tenant: smartsoftinovation  (6aab9206...)
        │     ├── users 4 (owner, admin, cashier)
        │     ├── products 14
        │     └── settings, roles, orders — সব আলাদা
        │
        └── Tenant: montaha-cosmetics  (6aaeb6cd...)
              ├── users 1 (owner: taufikislam172@gmail.com)
              ├── products 0
              └── settings, roles, orders — সব আলাদা

কোড: একটাই, সবার জন্য এক  →  ডেপ্লয় = সব সেলার আপডেট
ডেটা: tenantId দিয়ে আলাদা  →  কেউ কারো ডেটা দেখে না
```

**মনে রাখার তিনটা লাইন:**

1. এখন যা দেখছেন = `smartsoftinovation` স্টোরের ডেটা, "সবার মিলিত" কিছু নয়।
2. ফিচার/বাগ ফিক্স ডেপ্লয় করলে সব সেলার সাথে সাথে পাবে — এটাই ঠিক আচরণ।
3. `smartsoftinovation`-এ লগইন করে ডেভেলপ করুন (ওখানেই ডেটা আছে), নতুন মডেলে `tenantPlugin` লাগাতে ভুলবেন না।

---

## আরও পড়ুন

- `docs/multitenant-sprints.md` — মাল্টিটেন্যান্ট বাস্তবায়নের নোট ও প্রোডাকশন কাটওভার চেকলিস্ট
- `backend/CLAUDE.md` — কমান্ড ও এনভায়রনমেন্ট রেফারেন্স
- `backend/src/tenancy/` — context, plugin, resolver, registry-র সোর্স
