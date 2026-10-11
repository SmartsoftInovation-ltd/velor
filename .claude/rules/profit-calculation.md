# Profit calculation rules

Apply these whenever touching profit anywhere: the Invoice Profit report, the Customer Invoice Profit and Top Customer reports, the dashboard Total Sale box and overview `grossProfit`, or any new screen that shows profit. This file supersedes `PROFIT_CALCULATION_PLAN.md`.

There is one implementation, in `backend/src/utils/saleProfit.util.js`: `saleProfitStages()` gives profit per invoice and `saleLineProfitStages()` gives it per sold line, both built on the same `soldLineStages()`. Every profit figure comes from these. Never write a second formula; extend that file and update this one together. Tests live in `backend/tests/integration/customerInvoiceProfit.test.js`.

## The formula (per invoice)

```
lineNet  = salesRate × quantity − the line's own discount
             discountType "amount"  → discount × quantity      (taka off each unit)
             discountType "percent" → salesRate × quantity × discount / 100
netSales = Σ lineNet − (Σ lineNet × discountPercent / 100) − lessTaka
buyPrice = Σ purchasePrice × quantity still with the customer
PROFIT   = netSales − refunds − buyPrice
```

A period's profit (dashboard box, report totals row) is the sum of the per-invoice profits. Profit is rounded to 2 decimals per invoice.

## Discount: one level per invoice

An invoice carries **one** discount, never a stack:

1. The product or variant has its own discount → it lands on the sale line, and nothing else can be added.
2. No catalogue discount → the seller may type a discount on the sale line; then no invoice-level discount.
3. No line discount at all → the seller may give an invoice discount: `discountPercent` **or** `lessTaka`, not both.

The rule is enforced where the sale is written, not in the formula:

- API: `enforceSingleDiscount` in `backend/src/controller/sales.controller.js` rejects a create or edit that carries more than one level (400, "Only one discount is allowed").
- Forms: `CreateRetailSalesForm.tsx` and `CreateWholeSalesForm.tsx` lock the other fields, and clear the invoice discount and less-taka the moment a discounted item is in the cart (a customer's `regularDiscountPercent` would otherwise stay behind the locked field).

The formula still subtracts all three fields, so it stays correct for whichever one is set, and for sales saved before the rule was enforced.

The line's discount is read from the stored `searchItem.discount` + `discountType`. Never re-resolve it from the catalogue at report time: the form freezes the catalogue discount onto the line at pick time, so re-resolving would double-count and would re-price old sales when the catalogue changes.

## Buy price

- Each sale line carries its own cost: `searchItem.purchasePrice`, stamped server-side when the sale is saved (`stampPurchasePrices` in `backend/src/utils/saleCost.util.js`). It is never taken from the request, and a line keeps its first stamp through later edits. A later purchase at a new price therefore does not move the profit of old invoices.
- The stamp is the **variant's** `purchasePrice` when the line has a `variantId`, otherwise the **product's**. A missing price counts as 0.
- Lines saved before the field existed have no stamp; profit then reads the catalogue's current price in that same order. Migration `008-backfill-sale-purchase-price` stamps them (`npm run migrate`).

## What counts

- **Every invoice status**: `complete`, `draft` and `pending` all count, and so does every `salesType` (retail, wholesale and the two order types). Do not filter by `invoiceStatus`.
- **Lines**: `salesStatus: "sale"` lines count. `"exchange"` lines never count.
- **Sales returns** reduce the profit of the original invoice, on the invoice's own date:
  - A sales return flips the whole line to `"return"`, even for a partial quantity. A `"return"` line with a `SalesReturn` document behind it was still sold: it keeps its revenue.
  - `sale.return` (the money refunded) is subtracted from revenue. The refund is the returned units at their **net** price — `salesRate` less the line's own discount — less the invoice percent and the units' share of less-taka (`computeReturnAmounts` in `salesReturn.controller.js`).
  - Only the units still with the customer carry cost: `quantity − returned quantity`.
  - A `"return"` line with no `SalesReturn` behind it was never a sale and is left out.
- **Not in profit**: VAT, delivery cost, labour cost and customer advance adjustment. They are passed on or are payments, not margin.

## Never trust stored money fields

`searchItem.subtotal` and `sale.total` are written by the client. Profit is always recomputed from `salesRate`, `discount`, `discountType` and `quantity`.

## Invoice Profit report columns

`POST /report/invoice-profit`, screen `/invoice-profit`.

| Column | Value |
|---|---|
| TOTAL | Σ `salesRate × quantity` of the sold lines, before any discount |
| DISC | the invoice's discount at whichever level it was given (line discounts + `discountPercent` + `lessTaka`) |
| DELIVERY | `deliveryCost` |
| PAYABLE | `payable` (includes VAT, delivery, labour) |
| PAID | `netPaid`, or `paid − changes` on sales saved before `netPaid` existed |
| DUE | `presentDue` |
| PROFIT | TOTAL − DISC − refunds − buy price |

The row also carries `returned` and `buyPrice` in the API response; they are not columns on the sheet.

## Product Profit report columns

`POST /report/product-profit`, screen `/product-profit`, permission `product-profit-report`. One row per sold line.

| Column | Value |
|---|---|
| PRODUCT NAME | the product's name; for a variant line, the name of the **variant's product**. Falls back to the name stored on the sale line. |
| BARCODE / COLOR / SIZE | as stored on the sale line, falling back to the variant, then the product |
| QTY | units sold and not returned; a fully returned line is not listed |
| SALES PRICE | `salesRate`, the price of one unit |
| TOTAL | SALES PRICE × QTY |
| DISC | the line's own discount, or its share of the invoice's: `discountPercent` on the line's net, `lessTaka` spread equally over every unit sold on the invoice |
| PROFIT | TOTAL − DISC − buy price |

Any detail that is missing everywhere is `null` in the API and shown as `N/A`. A sale's rows add up to its Invoice Profit figure; returned units are simply left out here, where the invoice figure subtracts the refund instead.

## Top Sales Product report columns

`POST /report/top-sales-product`, screen `/top-sales-product`, permission `top-sales-product-report`. One row per product or variant sold in the period, ranked by QTY then TOTAL; `top` keeps the first N and the totals row covers only those.

| Column | Value |
|---|---|
| PRODUCT NAME / BARCODE / COLOR / SIZE | same rules as the Product Profit report |
| BUY PRICE | `purchasePrice` of one unit; an average over the units sold if lines carry different stamped costs |
| SALES PRICE | `salesRate` of one unit, averaged the same way |
| QTY | units sold and not returned |
| TOTAL | Σ of the lines' subtotal: `salesRate × quantity` less the line's own discount |
| PROFIT | Σ of the per-line profit (so an invoice discount's share is taken off, though TOTAL does not show it) |

The Customer Invoice Profit and Top Customer reports use the same meaning for SALES TOTAL (gross) and DISCOUNT (every level), and take PROFIT from the same shared stages.

## Date field

Reports and the Total Sale box filter on the sale's `date` (the transaction date the seller set). The dashboard overview's `grossProfit` filters on `createdAt`; a back-dated sale can therefore land in different ranges on the two.
