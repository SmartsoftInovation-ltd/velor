# Profit Calculation — Dashboard "Total Sale" box

Status: **implemented and verified.** Decisions below are the ones you approved.

Changed: `backend/src/controller/dashboard.controller.js` (one file).
Consumed unchanged by
`dashbaord/src/components/ecommerce/dashboard/InteractiveDashboard.tsx:421`
via `sales.profit` — no frontend edit needed.

---

## Decisions applied

| Item | Decision |
|---|---|
| Brand discount | **Skipped** — no schema support (see §3) |
| `lessTaka` | **Split equally across the sale's lines** |
| Scope | Only `profit` / `grossProfit`. `received` / `due` logic untouched |
| Range filter | today / 7d / 30d / 90d / 12m / all — already wired, now feeds profit |
| VAT, delivery, labour | Excluded from profit |
| Overview `grossProfit` | Fixed with the same shared pipeline |

---

## The formula

Per line, for every sale in range, `salesStatus === "sale"` only:

```
grossLine    = salesRate × quantity
lineDiscount = discountType "amount" ? discount × quantity      (taka per unit)
                                     : grossLine × discount / 100 (percent)
netLine      = grossLine − lineDiscount
invoiceCut   = netLine × sale.discountPercent / 100
lessCut      = sale.lessTaka ÷ (number of lines on that sale)
netRevenue   = netLine − invoiceCut − lessCut
cost         = (variant.purchasePrice ?? product.purchasePrice ?? 0) × quantity

profit = round( Σ (netRevenue − cost) )
```

Retail and wholesale flow through the identical pipeline — the only difference
is which price the form recorded into `salesRate`, already stored per line.

Rounding happens **once**, on the final sum. Per-line rounding would drift
across many invoices.

---

## Three defects this fixed

The previous code was `Σ subtotal − Σ (purchasePrice × qty)`, which:

1. **Ignored `discountPercent`** — 3 of the 5 live sales carry it, so profit was
   overstated on most real invoices.
2. **Ignored `lessTaka`** entirely.
3. **Counted `return` and `exchange` lines as sales.** Other aggregations in the
   same file already guard with `salesStatus: "sale"` (lines 1666, 1965, 1974);
   these two did not.

---

## Why the catalogue is NOT re-walked at report time

The original request asked profit to walk product → subcategory → category to
find a discount. That would be **wrong**, and it is deliberately not done.

The sales form resolves the catalogue discount at pick time
(`CreateRetailSalesForm.tsx:733-741`) and freezes it onto the line at save
(`:854-857`). Separately, `discountAssignment.service.js` already pushes
category and subCategory discounts **down onto the Product and Variant
documents** (`applyCategoryDiscount` / `applySubCategoryDiscount` both call
`Product.updateMany` and `Variant.updateMany`). So a category discount has
already become the product's own discount before the sale is even saved.

Re-resolving at report time would therefore (a) double-count, and (b) re-price
historical sales whenever the catalogue changes. **Profit reflects what the
customer was actually charged**, read from the stored `searchItem.discount` +
`discountType`. This covers discount logic 1 and 2 together, because they are
the same stored field.

`subtotal` is deliberately *not* trusted — it is written by the client. Every
figure is recomputed server-side from `salesRate` / `discount` / `quantity`.

---

## §3 — Brand discount: skipped, as agreed

Not implementable without schema work:

- `discount.model.js:47` — `discountPlan` enum is
  `["flat","category","product","subCategory","variant"]`. No `brand`.
- `brand.model.js` — no `discount` field at all.
- `discountAssignment.service.js` — no brand branch.

Not a reporting gap: if a brand discount existed it would land on the product
doc and would already be inside `searchItem.discount`.

---

## Verification — all passed

Real data checked by hand-computing every line from raw documents in plain JS,
then comparing against the aggregation:

```
REAL DATA   hand=6043  pipeline=6043  MATCH
```

Live data covers none of the interesting branches (no `lessTaka`, no wholesale,
no line discounts), so four synthetic sales were inserted, asserted, and dropped:

```
T1 amount-discount    (500−50)×2                  expected 900  got 900  PASS
T2 lessTaka-split     60 over 3 lines, 100 each   expected 240  got 240  PASS
T3 wholesale+pct      1000 −10% −5%               expected 855  got 855  PASS
T4 return-excluded    return line ignored         expected 200  got 200  PASS
```

T2 confirms the split: **60 ÷ 3 lines = 20 each**, so each 100 line becomes 80
and the sale totals 240. (Your message said "30 tk kore" — the arithmetic is 20.)

Test collection dropped afterwards; production data untouched.

---

## Known issues left alone (flagging, not fixing)

1. **Discount validity dates are never enforced.** `discountValidFrom` /
   `discountValidTo` are validated on create but **no read path anywhere checks
   them** — only `isActive` gates a discount. An expired discount still applies.
   Separate bug, separate fix.

2. **Overview and Total Sale box filter on different date fields.**
   `getOverview` matches on `createdAt` (line 234); `getSalesSummary` matches on
   `date` (line 901). `date` is the transaction date the seller set; `createdAt`
   is when the row was written. For a sale back-dated by the seller these differ,
   so the two widgets can show different profit for the same selected range.
   Not changed — aligning them would alter `getOverview`'s other widgets too.
   **Tell me if you want them aligned on `date`.**

3. **Missing purchase price reads as zero cost**, silently inflating profit.
   The `?? 0` fallback matches existing behaviour and avoids nulls poisoning the
   sum, but a "N items missing purchase price" warning would be worth adding.
