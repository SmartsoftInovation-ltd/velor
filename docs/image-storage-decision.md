# Image storage decision: Cloudinary vs MinIO vs alternatives

_Written 2026-09-17 on branch `miniocloudfarer2`._

## 1. Where we are now

- Every seller (tenant) puts their **own Cloudinary account** into Store Settings
  (`backend/src/settings/definitions.js` → `cloudinary` section).
- Upload flow: `multer` saves the file to `public/temp` (max 10 MB, jpg/jpeg/png/webp)
  → BullMQ `image.worker.js` → `helpers/cloudinary.js` uploads it → the DB stores `url`, `publicId`, `cloudName`.
- **We upload the original file untouched.** The resize (`w_1024`, `q_auto:low`, `f_auto`) is only
  in the *delivery URL*. So Cloudinary stores the full original, and every resized version it
  serves counts as a transformation.
- **Nothing compresses images before upload today.** The dashboard has no compression library
  and no canvas resize. The backend has no `sharp` and no Cloudinary incoming transformation.
  The only protection is a size cap: products, banners and discount banners allow 5 MB
  (react-dropzone `maxSize`); store and outlet info allow 2 MB; everything else
  (users, customers, site info, …) only has multer's 10 MB cap.
  So today the realistic row in §2 is the **~1–3 MB** one, not ~300 KB.

## 2. How many images fit in the Cloudinary free plan?

The free plan is **25 credits a month**, not 25 GB of storage. One credit is **one** of these:

| 1 credit = | |
|---|---|
| 1 GB of stored files | adds up as the store grows, and is charged against every month |
| 1 GB of bandwidth (images viewed) | rolling 30 days |
| 1,000 transformations | every new resized/format version counts |

Storage, bandwidth and transformations all come out of the same 25 credits. When a seller
goes past the limit, Cloudinary does not bill them. It warns them, and after a while it can
**disable the account**. When that happens, that store's images stop loading.

### 2a. If all 25 credits went to storage (best case, not realistic)

| Size of the file the seller uploads | Images in ~25 GB |
|---|---|
| Phone photo, not compressed (~3 MB) | **~8,500** |
| Compressed JPG (~1 MB) | **~25,000** |
| Web-optimized (~300 KB) | **~85,000** |

### 2b. Realistic case for a live store

Rough monthly use for a store that is actually selling:

- Bandwidth: ~8–10 credits. A 1024px `q_auto:low` image is ~60–120 KB, so 1 GB ≈ 10k image loads.
- Transformations: ~2–3 credits. `f_auto` makes a separate avif/webp/jpg version for each
  kind of browser, so each image is about 2–3 transformations.
- **What's left for storage: ~12 GB**

| Size of the file the seller uploads | Images | Products (thumbnail + ~2 gallery + OG ≈ 4 images) |
|---|---|---|
| ~3 MB phone photo | ~4,000 | ~1,000 |
| ~1 MB | ~12,000 | ~3,000 |
| ~300 KB (compressed before upload) | ~40,000 | ~10,000 |

**Takeaway:** compressing images *before* upload (resize to max ~1600px, webp q≈80) gives each seller
**~10x more room**, whatever storage we end up using. It's a small change inside `image.worker.js`
(using `sharp`), and it's worth doing first.

> Note: Cloudinary's free plan is meant for one account per user. If each seller signs up for their own account, that's fine.
> If **we** create free accounts for sellers, read Cloudinary's terms first.

## 3. Is MinIO a good idea? — **No (as of 2026)**

- In Dec 2025 the MinIO community edition went into maintenance mode. In Feb 2026 it was marked
  **"no longer maintained"**, and the GitHub repo is now **archived** (read-only).
- Since Oct 2025 there are no official community Docker images or binaries. The last community image is
  `RELEASE.2025-09-07T16-13-09Z`. Reports say the `minio` namespace on Docker Hub has also been removed.
- That means **no security patches**. It would be a public-facing file server on the same VPS as
  our DB/backend. The page at `min.io/?platform=docker` now points to their commercial product (AIStor).

**What to use instead.** Everything below speaks the S3 API, so the code change is the same for all of them:

| Option | Type | Cost | Good fit when |
|---|---|---|---|
| **Cloudflare R2** | Managed | 10 GB free, then ~$0.015/GB-month, **no bandwidth (egress) fees** | Recommended. Comes with a CDN, nothing to run on our side |
| **Garage** | Self-host (Rust, light) | VPS disk only | Must stay on our VPS, small or medium scale |
| **SeaweedFS** | Self-host | VPS disk only | Self-host with many files and room to grow |
| MinIO (old image) | Self-host | VPS disk only | ❌ Unmaintained |

## 4. Pros & cons

### Stay on Cloudinary (seller brings their own free account)

**Pros**
- Already built and tested. No work needed.
- CDN, automatic format (avif/webp) and resizing are included.
- The platform pays nothing. Each seller's usage and cost is their own problem.
- One seller running out does not affect the others.

**Cons**
- The limit is 25 **credits**, not 25 GB. A busy store uses them up on bandwidth.
- When over the limit the account can be **disabled**, and every image for that store breaks.
- Onboarding is harder: every seller has to create a Cloudinary account and paste in keys.
- We can't control quotas or see usage from our own dashboard.
- Paid plans are expensive (Plus is ~$89/month).
- If a seller changes Cloudinary account, the old images can't be deleted (see the `cloudName` skip logic).

### Self-hosted S3 on our VPS (MinIO / Garage / SeaweedFS)

**Pros**
- No per-image, per-transformation or bandwidth pricing from a vendor.
- Sellers don't need an account. Upload just works. Better onboarding.
- Full control. We can set a quota per seller (e.g. 5 GB) inside the app.

**Cons**
- **"25 GB per seller" has to be real disk space.** 20 sellers × 25 GB = 500 GB of VPS disk.
- The VPS bandwidth serves every image. Without Cloudflare in front, it will be slow and can go over the VPS traffic cap.
- No resizing when an image is served. We must resize with `sharp` at upload time, or run `imgproxy`.
- We own backups, disk failures, security patches and monitoring. The VPS becomes a single point of failure for DB + API + images.
- MinIO specifically: unmaintained (see §3).

### Cloudflare R2 (managed S3)

**Pros**
- No egress fees. Can be served through Cloudflare CDN on our own domain.
- Cheap: 100 GB ≈ $1.50/month. No servers or disks to manage.
- One platform bucket with a `tenants/<tenantId>/` prefix per seller, and the quota enforced in the app.
- Same S3 code as the self-host options, so we can switch later.

**Cons**
- The platform pays the storage bill, not the seller. We need a plan limit or charge (e.g. 5 GB free, pay for more).
- No resizing when served unless we pay for Cloudflare Images. Use `sharp` at upload time instead.
- Costs are small but not zero. Needs a card on the Cloudflare account.

## 5. Recommendation

1. **Now:** stay on Cloudinary and add `sharp` compression before upload (§2b). Quick win, small risk.
2. **Next:** add a storage driver layer (`storage.upload / storage.delete`) so Cloudinary is just one option.
3. **Then:** add an S3 driver and move to **Cloudflare R2** (or **Garage** if it must be on the VPS).
   Change the product model from "each seller brings Cloudinary" to "the platform gives X GB per plan".
4. **Don't adopt MinIO community edition.**

## 6. What changes when moving to S3 (R2 / Garage / MinIO — same list)

### Backend core
| File | Change |
|---|---|
| `backend/src/helpers/cloudinary.js` | Replace with `helpers/storage.js` using `@aws-sdk/client-s3`. It needs `upload(localPath) → { url, key, provider }` and `delete(key, provider)`. Resize/compress with `sharp` first. `uploadBarcodeToCloudinary` is never used, so remove it |
| `backend/src/integrations/config.js` (`getCloudinaryConfig`, ~L167) | Rename to `getStorageConfig`: endpoint, bucket, access key, secret, public base URL, and a per-tenant prefix. For platform storage, read these from `.env` instead of tenant settings |
| `backend/src/settings/definitions.js` (`cloudinary` section) | Replace with a `storage` section, or remove it if storage is platform-owned |
| `backend/src/settings/testers.js` (`cloudinary.api.ping`) | Replace with an S3 `HeadBucket` check |
| `backend/src/settings/settings.service.js` (~L169 `cloudinary: configured(...)`) | Change the feature flag to `storage`. Make it always true if storage is platform-owned |
| `backend/src/middleware/multer.middleware.js` (`guardUploads`) | Check the storage feature and quota instead of `CLOUDINARY_NOT_CONFIGURED` |
| `backend/src/workers/image.worker.js` | Call the new helper, rename the `delete-cloudinary-image` job, store `provider` instead of `cloudName`, update the per-tenant storage usage counter |
| `backend/src/queues/image.queue.js` | Job names |
| `backend/package.json` | Remove `cloudinary`, add `@aws-sdk/client-s3` and `sharp` |

### Controllers
- They add queue jobs using `publicId`/`cloudName`: `banner`, `discountBanner`, `customer`, `user`, `product`,
  `variant`, `employee`, `category`, `brand`, `storeInformation`, `siteinformation`.
- They call `deleteCloudinaryFile` directly: `brand`, `category`, `storeInformation`, `siteinformation`.
- `outletinformation.controller.js` uploads **directly without the queue** and **works out `publicId` by parsing the Cloudinary URL**
  (~L117–123, L190–196). This needs a rewrite.
- `product.controller.js` / `variant.controller.js`: the delete-by-`publicId` endpoints and `collect*PublicIds`.

### Models (image sub-schema: `url`, `publicId`, `cloudName`, `status`…)
`category`, `brand`, `employee`, `customer`, `banner`, `discountbanner`, `variant`, `product`,
`siteInformation`, `storeInformation`, `user`.
To avoid a schema migration, keep `publicId` and use it as the S3 object key. Keep or rename `cloudName` as `provider`
(`"cloudinary"` / `"r2"`) so old and new images can live side by side while we migrate.

### Migrations
- New migration: copy each Cloudinary asset into the bucket and rewrite `url/publicId/cloudName`.
  It needs each tenant's Cloudinary credentials, **before** we remove them.
- `001-import-env-settings.js` and `004-backfill-cloud-name.js` mention Cloudinary. Leave them as history.

### Dashboard (`dashbaord/`)
- `src/pages/Settings/StoreSettings/integrationMeta.tsx`: remove the Cloudinary card, or turn it into a storage usage/quota card.
- `src/components/routes/FeatureGate.tsx`, `src/context/AuthContext.tsx`: the `cloudinary` feature key.
- `src/components/common/IntegrationNotice.tsx`: the "Cloudinary not configured" message.

### Storefront (`frontend/`)
- `next.config.ts` → add the storage/CDN domain (e.g. `img.yourdomain.com`) to `images.remotePatterns`.

### Tests
Backend: `tests/unit/cloudinaryHelper.test.js`, `tests/integration/{uploadGuard,settingsTesters,integrationConfig,settingsService,migrations,ownerIntegrations,platformSettingsApi,tenantAuth}.test.js`.
Dashboard: `IntegrationGrid.test.tsx`, `StoreSettings.test.tsx`, `SellerDetailPage.test.tsx`, `AuthContext.test.tsx`, `FeatureGate.test.tsx`.

### Infra (self-host only)
- A new service in docker-compose with a persistent volume, and a separate disk if possible.
- A public read-only bucket, or signed URLs.
- Cloudflare (proxy/CDN) in front of `img.yourdomain.com`, and nginx cache headers.
- Backups of the bucket volume, in addition to the Mongo backup cron.
- `.env.docker.sample`: add the new `S3_*` vars.
