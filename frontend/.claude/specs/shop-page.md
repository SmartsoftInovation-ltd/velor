# Spec — shop page catalogue

The shop page at `/shop` is built against in-memory fixtures in
`src/lib/catalog/`. `searchProducts` and `getFacetCounts` are shaped like the
HTTP calls that will replace them, so swapping the body of those two functions
is the whole migration. **The endpoints below are not implemented — this
document is the handoff to whoever builds them.**

## State lives in the URL

Every filter is a query parameter, so a filtered view is linkable, shareable
and survives a refresh. The page is a Server Component that reads
`searchParams`; the filter controls are plain links, not client state.

```
/shop?category=outerwear&subcategory=leather&brands=Ashcroft,Harrowgate
     &colors=black&sizes=M,L&availability=in-stock,offer
     &minPrice=1000&maxPrice=5000&rating=4&sort=price-asc&page=2
```

| Param | Shape | Notes |
| --- | --- | --- |
| `category` | single id | one of `CATEGORIES[].id` |
| `subcategory` | single id | only meaningful with `category` |
| `brands` | comma-separated | OR within the facet |
| `colors` | comma-separated | OR within the facet |
| `sizes` | comma-separated | OR within the facet |
| `availability` | comma-separated | `in-stock`, `out-of-stock`, `offer`; OR within the facet |
| `minPrice` / `maxPrice` | integer, BDT | inclusive |
| `rating` | integer 1–4 | "N stars and up" |
| `sort` | enum | `relevance` (default), `price-asc`, `price-desc`, `rating`, `newest` |
| `page` | integer ≥ 1 | `PAGE_SIZE` is 9 |

Facets are **AND** across groups, **OR** within a group. Any filter change
resets `page` to 1.

## `GET /api/products`

Request: the query parameters above, verbatim.

```jsonc
// 200
{
  "products": [
    {
      "id": "leather-biker-jacket",
      "name": "Leather Biker Jacket",
      "brand": "Harrowgate",
      "price": 3990,              // BDT, integer — no minor units
      "compareAtPrice": 7990,     // optional; omit when not discounted
      "rating": 4.8,
      "reviews": "389",           // pre-formatted for display
      "stock": "in",              // "in" | "low" | "out"
      "href": "/product/leather-biker-jacket",
      "image": "https://…",
      "alt": "Man wearing a black leather biker jacket",
      "categoryId": "outerwear",
      "subcategoryId": "leather",
      "colors": ["black"],        // ColorOption ids
      "sizes": ["S", "M", "L", "XL"],
      "createdAt": "2026-09-01"   // ISO date, drives sort=newest
    }
  ],
  "total": 24,                    // matches before paging
  "page": 1,
  "pageCount": 3
}
```

## `GET /api/products/facets`

Same query parameters. Returns the count each facet value **would** yield.

```jsonc
// 200
{
  "categories": {
    "outerwear": 8,
    "outerwear/leather": 3       // "<categoryId>/<subcategoryId>"
  },
  "brands": { "Northwell": 7, "Ashcroft": 6 },
  "availability": { "in-stock": 21, "out-of-stock": 1, "offer": 12 }
}
```

Each facet is counted with every filter applied **except its own** — otherwise
selecting a brand would drop every other brand's count to zero and the user
could never widen the selection without clearing it first.

`availability` is **derived, not stored**: `in-stock` is `stock !== "out"`,
`offer` is `compareAtPrice > price`. The backend should apply the same rule
rather than adding a flag that can drift out of sync with the price.

## Taxonomy

`CATEGORIES`, `BRANDS`, `COLORS`, `SIZES` and `PRICE_BOUNDS` are hard-coded in
`src/lib/catalog/taxonomy.ts`. These should eventually come from the backend
(likely `GET /api/taxonomy`) so a new category does not need a deploy.

## Not covered

Search-by-keyword, in-stock-only filtering, per-variant inventory, and
saved/recent filters. None are wired into the URL contract yet.
