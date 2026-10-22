# Plan — cart and wishlist, stored in the browser, per tenant

Status: **draft for review**. Nothing here is built yet. Decisions that need the
owner's call are marked **DECIDE**.

## Goal

- A shopper can add products (or a product variant) to the cart and the
  wishlist from the product card, the shop list row, and the product page.
- Both survive a page reload and a browser restart, signed in or not.
- Each store keeps its own cart and wishlist. A cart made on shop A never shows
  on shop B, even when both are opened in the same browser.
- Checkout still charges what the server computes, never the browser's numbers.

## What exists today

| Piece | State |
|---|---|
| `src/lib/catalog/cart-fixture.ts`, `wishlist-fixture.ts` | Hard-coded design fixtures. No real state anywhere. |
| `/cart`, `/wishlist` pages, `CartLineRow`, `WishlistCard` | Laid out against the fixtures. Buttons do nothing. |
| `CartButton` in the header | Always shows `0` / `৳0.00`. |
| `BuyActions` (product page) | "Add to cart" only shows a toast. |
| `ProductCard`, `ProductRow` | Heart and cart buttons have no handler. |
| `CatalogProduct.id` | The product **slug**. The Mongo `_id` is not carried to the client today. |
| Backend `Cart` model + `/cart/*` | Exists, tenant-scoped, works for guests (`x-guest-id`) and signed-in users (`guestOrAuth`). |
| Backend `POST /shop/order` | Reads the **server** cart (`Cart.findOne({ user } or { guestId })`) and re-prices it. |
| Backend `Wishlist` model + `/wishList/*` | Behind `authGuard` (staff). A shopper token is refused, so it cannot be used from the storefront as is. |
| Backend `/cart/merge` | Behind `authGuard` (staff). Same problem. |

## Storage: localStorage, not IndexedDB

**Recommendation: localStorage.**

| | localStorage | IndexedDB |
|---|---|---|
| Size we need | A cart is < 50 lines, a few KB. Limit is ~5 MB. | Far more than needed. |
| API | Synchronous. Works directly with `useSyncExternalStore`, so the header badge and the cart page read the same value with no loading state. | Asynchronous. Every read is a promise, so the badge renders empty first and then fills in. |
| Cross-tab sync | Free: the `storage` event fires in other tabs. | Needs `BroadcastChannel` on top. |
| Dependencies | None. | A wrapper (`idb`) or hand-written request plumbing. |

IndexedDB earns its cost only for large or binary data (offline catalogue,
images). We store neither. If the cart ever needs to hold more, the store module
below is the only file that changes.

**DECIDE:** localStorage (recommended) or IndexedDB.

## Tenant isolation

Two layers, so a mistake in one does not leak a cart between shops.

1. **Origin.** Browsers already keep localStorage per origin. Every shop runs on
   its own domain (`mysmartsoftinnovation.com`, `rmg.…`), so they cannot read
   each other's storage at all.
2. **Tenant id in the key and in the data.** Origin is not enough on its own:
   on `localhost` the shop is chosen by `DEV_TENANT_HOST`, so switching it
   would show shop A's cart on shop B. A domain moved from one tenant to another
   would do the same. So:
   - Keys are `ecompos:<tenantId>:cart`, `ecompos:<tenantId>:wishlist`,
     `ecompos:<tenantId>:guest`.
   - Each stored document also carries `tenantId`. On read, a document whose
     `tenantId` differs from the current shop is discarded.

### Where the client gets the tenant id

The browser never sees a tenant id today. The store is resolved on the server
from the domain.

- **Option A (recommended): add `id` to `GET /shop/store`.**
  The response becomes `{ id, name, logo }`. The root layout already calls
  `getStore()`, so it passes `store.id` into a small client provider. A tenant
  id is an opaque ObjectId. Exposing it gives a visitor nothing, because the
  API never accepts it from the storefront: the store always comes from the
  domain. **Backend change: one field.**
- Option B: use the resolved host (`storeHostFrom()`) as the key instead. No
  backend change, but a domain that moves to another tenant keeps its old cart,
  and the key is not a tenant id as asked.

**DECIDE:** A or B.

## Data shapes

```ts
// src/lib/cart/types.ts
type CartLine = {
  key: string;            // `${productId}:${variantId ?? "-"}` — one line per product+variant
  productId: string;      // Mongo _id, what the API needs
  variantId: string | null;
  slug: string;           // for the link back to /product/<slug>
  // A snapshot for drawing the line without a network call.
  // Display only: never sent as a price, the server re-prices at checkout.
  name: string;
  image: string;
  optionLabel: string;    // "Black / M", or "" for a product without variants
  unitPrice: number;
  compareAtPrice: number | null;
  maxQuantity: number;    // stock when added; refreshed on the cart page
  quantity: number;
  addedAt: string;        // ISO 8601
};

type StoredCart = { v: 1; tenantId: string; lines: CartLine[]; updatedAt: string };

type WishlistItem = Omit<CartLine, "quantity" | "maxQuantity" | "key"> & { key: string; savedAt: string };
type StoredWishlist = { v: 1; tenantId: string; items: WishlistItem[]; updatedAt: string };
```

- `v` is a schema version. An unknown version is discarded, never half-read.
- Limits: 50 cart lines, 100 wishlist items, quantity 1…`maxQuantity`.
- `CatalogProduct` and `ProductVariant` gain `productId` (the Mongo `_id`) in
  `toCatalogProduct()`. The API already returns `_id`; only the mapping drops it.

## Modules (frontend)

```
src/lib/cart/
  types.ts           shapes above
  storage.ts         read/write one key: JSON parse, version + tenant check,
                     try/catch (private mode, quota, blocked storage → in-memory fallback)
  cart-store.ts      pure functions: addLine, setQuantity, removeLine, clear, totals
  wishlist-store.ts  pure functions: toggle, remove, has, moveToCart
src/components/cart/
  shop-storage-provider.tsx  "use client". Holds tenantId, exposes the stores
                     through useSyncExternalStore, listens to the `storage` event
  use-cart.ts / use-wishlist.ts   hooks over the provider
  add-to-cart-button.tsx          client leaf used by card, row and product page
  wishlist-toggle.tsx             client leaf (filled heart when saved)
  cart-count.tsx                  client leaf inside the header CartButton
```

- Server Components stay server. Only the buttons, the header count, and the
  cart and wishlist page bodies become client leaves.
- `useSyncExternalStore` gets a server snapshot of "empty". The server renders
  0, and the browser fills in after hydration, with no hydration mismatch.
- Pure functions in `lib/` stay framework-free, per `pages-and-structure.md`.

## Flows

### Add to cart
1. The button calls `addLine()` with the product or variant snapshot.
2. If the same product+variant is already there, quantity is increased, capped
   at `maxQuantity`.
3. The toast says "Added to cart", and the header count updates in every open tab.

### Cart page
1. Renders from storage at once.
2. Then refreshes: a Server Action fetches the current products by id from the
   API and updates the price, stock and name of each line. A product that is gone
   or out of stock is flagged on its line ("No longer available"), not silently
   dropped.
3. Quantity +/−, Remove, and "Save for later" (moves the line to the wishlist)
   all work locally.

### Wishlist
- The heart toggles the item. `/wishlist` lists items from storage, and
  "Move to bag" calls `addLine()` then removes the item.
- The header wishlist count reads the same store.

### Checkout (needs the server cart)
`POST /shop/order` prices the **server** cart, so the local cart must be sent up
first:

1. The checkout Server Action reads the local cart lines (ids + quantities only),
   and the guest id from `ecompos:<tenantId>:guest` (a `crypto.randomUUID()`,
   created once per shop).
2. It replaces the server cart with those lines, as the signed-in shopper
   (bearer token from the `shop_session` cookie) or as the guest (`x-guest-id`).
3. It calls `POST /shop/order`. The server re-prices and validates stock.
4. On success the local cart is cleared.

Step 2 is best as **one** call. Today's API only has `/cart/add` per item plus
`/cart/clear`, which is N+1 requests and can leave a half-written cart. Proposed
backend endpoint:

```
PUT /shop/cart          guestOrAuth, tenant from the domain
body: { items: [{ productId, variantId|null, quantity }] }   // max 50
200:  { cart }          // server-priced; unknown or unavailable items listed in `rejected`
```

**DECIDE:** new `PUT /shop/cart` (recommended), or loop over the existing
`/cart/clear` + `/cart/add` for a first version.

### Sign in / sign out
- The cart and wishlist are keyed by tenant, not by user, so they are kept across
  sign-in. That matches what shoppers expect ("I added things, then logged in").
- **DECIDE:** on sign-out, clear both lists (safer on a shared computer) or keep
  them (friendlier)? Recommendation: clear the wishlist, keep the cart.

## Not in phase 1 (and why)

- **The same cart on two devices.** That needs the server to be the source of
  truth for signed-in shoppers, plus a merge on login. `/cart/merge` and the
  wishlist routes sit behind the staff guard today. Phase 2 would add
  `/shop/wishlist` and `/shop/cart/merge` behind `shopperGuard`.
- **Coupons and delivery charge in the cart summary.** These come from checkout.

## Backend changes this plan needs

The frontend scope rule says backend changes are a handoff, so they are listed
here, not done silently:

| # | Change | Needed for |
|---|---|---|
| 1 | `GET /shop/store` returns `id` (tenant id) | Tenant key, Option A |
| 2 | `GET /shop/products?ids=…` (or reuse the existing list) | Refreshing cart lines |
| 3 | `PUT /shop/cart` bulk replace | Checkout |
| 4 | (phase 2) `/shop/wishlist`, `/shop/cart/merge` behind `shopperGuard` | Cross-device |

## Build order

1. `productId` on catalogue types. Storage + pure store functions. Provider + hooks.
2. Header count, add-to-cart on product page, card and row. Wishlist heart.
3. `/cart` and `/wishlist` pages on real state. Remove the two fixtures.
4. Cart refresh against the API.
5. Backend `id` on `/shop/store` and `PUT /shop/cart`. Checkout wiring.

## How it will be checked

- Add from all three places; reload; close and reopen the browser: lines kept.
- Two tabs: adding in one updates the count in the other.
- Switch `DEV_TENANT_HOST` to another shop: empty cart; switch back: original cart.
- Tamper with localStorage (bad JSON, wrong `tenantId`, `v: 99`): the page
  starts empty instead of crashing.
- Private window or storage blocked: the cart works for the session, nothing crashes.
- Price changed in the dashboard: the cart page shows the new price after refresh,
  and checkout charges the server price.
- `npm run build` and `npm run lint` pass (150-line cap), and the page works at 360px.
