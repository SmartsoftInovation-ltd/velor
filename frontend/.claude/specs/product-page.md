# Spec — product detail page

`/product/[slug]` is built against the same in-memory fixtures as the shop
page (`src/lib/catalog/`). `getProduct`, `getReviews` and `getRelatedProducts`
are shaped like the calls that will replace them. **None of the endpoints below
exist yet — this document is the handoff.**

The slug is the product id (`/product/leather-biker-jacket`).

## `GET /api/products/:id`

```jsonc
// 200 — every field from the catalogue row, plus the detail-only ones
{
  "id": "leather-biker-jacket",
  "name": "Leather Biker Jacket",
  "brand": "Harrowgate",
  "price": 3990,                  // BDT, integer
  "compareAtPrice": 7990,         // optional
  "rating": 4.8,
  "reviews": "389",               // pre-formatted count for display
  "stock": "in",                  // "in" | "low" | "out"
  "colors": ["black"],
  "sizes": ["S", "M", "L", "XL"],

  // detail-only
  "sku": "LEA-3990",
  "stockCount": 55,               // drives the quantity cap and "N left"
  "description": "…",
  "highlights": ["…"],
  "specs": [{ "label": "Material", "value": "Cotton blend" }],
  "gallery": [{ "src": "https://…", "alt": "…" }]
}
// 404 when the id is unknown — the page calls notFound()
```

`stockCount` is the real number; `stock` stays as the coarse badge state. The
quantity stepper caps at `min(stockCount, 10)`.

## `GET /api/products/:id/reviews`

```jsonc
// 200
[
  {
    "id": "r1",
    "author": "Tanvir H.",
    "rating": 5,
    "date": "2026-08-21",
    "title": "Exactly as pictured",
    "body": "…"
  }
]
```

Paging, sorting and "verified purchase" flags are not modelled yet. The
fixtures return a fixed pool filtered to be broadly consistent with the
product's headline rating.

## `GET /api/products/:id/related`

Returns up to four products from the same `categoryId`, excluding the current
one. Real relevance (co-purchase, same collection) is out of scope.

## Not implemented — writes

Three forms collect input and **submit nothing**, because none of these
endpoints exist:

| Call site | Payload |
| --- | --- |
| Add to cart / Buy now | `{ productId, size, color, quantity }` |
| Wishlist button (gallery) | `{ productId }` |
| Review form (Reviews tab) | `{ productId, rating, name, title, body }` |

All three should be Server Actions in `src/lib/actions/`, not route handlers,
per `.claude/rules/pages-and-structure.md`: validate, call a plain function,
revalidate the product path.

The review form needs decisions the frontend cannot make on its own:

- **Who may post.** The form says only verified buyers are published, so the
  action has to check an order for that product against the session. Until auth
  exists there is nothing to check against.
- **Moderation.** Whether a review appears immediately or queues for review
  changes what the form does after submitting.
- **Rate limiting.** One review per buyer per product, enforced server-side.

Client-side validation in the form is a convenience only — `rating` is the sole
required field there, and the server must re-validate everything.

## Gallery images

Fixtures carry one photo per product; `buildGallery` re-crops it three ways via
Unsplash's `w`/`h`/`crop` params so the thumbnail rail has distinct framings.
Real product data supplies separate images and that function goes away.
