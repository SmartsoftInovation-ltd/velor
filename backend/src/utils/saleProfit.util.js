// Sale profit — the one formula behind the dashboard's Total Sale box and the
// invoice profit, product profit, customer invoice profit and top customer
// reports. saleProfitStages gives it per invoice, saleLineProfitStages per line.
// The rules it implements are written down in .claude/rules/profit-calculation.md;
// change them there and here together.
//
//   lineNet  = salesRate × quantity − the line's own discount
//                amount  → discount × quantity      (taka off each unit)
//                percent → salesRate × quantity × discount / 100
//   netSales = Σ lineNet − Σ lineNet × discountPercent / 100 − lessTaka
//   buyPrice = Σ purchasePrice × quantity still with the customer, at the cost
//              stamped on the line when it was sold
//   profit   = netSales − refunds − buyPrice
//
// Every figure is recomputed from salesRate / discount / quantity: the stored
// `subtotal` and `total` are written by the client and are not trusted here.
// VAT, delivery and labour stay out — they are passed on, not margin.

const num = (expr) => ({ $ifNull: [expr, 0] });

// purchasePrice of the looked-up document with this _id, or null
const purchasePriceOf = (docs, id) => ({
  $first: {
    $map: {
      input: { $filter: { input: docs, as: "d", cond: { $eq: ["$$d._id", id] } } },
      as: "d",
      in: "$$d.purchasePrice",
    },
  },
});

// Whether sales-return item $$r is sale line $$line. Mirrors how
// salesReturn.controller.js finds the line: by variant when the return names
// one, by product otherwise.
const isReturnOfLine = {
  $cond: [
    { $ne: [{ $ifNull: ["$$r.variant", null] }, null] },
    { $eq: ["$$r.variant", "$$line.variantId"] },
    {
      $and: [
        { $ne: [{ $ifNull: ["$$r.product", null] }, null] },
        { $eq: ["$$r.product", "$$line.productId"] },
      ],
    },
  ],
};

/**
 * Stages for a pipeline over `sales`. Each sale leaves with:
 *
 *   grossSales          Σ salesRate × quantity of the sold lines
 *   itemDiscountAmount  Σ of the lines' own discounts
 *   discountAmount      the invoice-level cut: discountPercent + lessTaka
 *   totalDiscountAmount itemDiscountAmount + discountAmount
 *   returnAmount        money refunded through sales returns
 *   itemsQty            units sold and not returned
 *   buyPrice            what those units cost
 *   profit              rounded to 2 dp
 */
// Leaves each sale with `soldLines`: one entry per line that counts as sold,
// carrying its quantities, gross, own discount and unit cost.
const soldLineStages = () => [
  // Every variant, product and sales return of the invoice in one lookup each;
  // the per-line values are picked out of these arrays below.
  {
    $lookup: {
      from: "variants",
      localField: "searchItem.variantId",
      foreignField: "_id",
      as: "variantDocs",
      pipeline: [{ $project: { purchasePrice: 1 } }],
    },
  },
  {
    $lookup: {
      from: "products",
      localField: "searchItem.productId",
      foreignField: "_id",
      as: "productDocs",
      pipeline: [{ $project: { purchasePrice: 1 } }],
    },
  },
  {
    $lookup: {
      from: "salesreturns",
      localField: "_id",
      foreignField: "invoiceNumber",
      as: "returnDocs",
      pipeline: [{ $project: { allproduct: 1 } }],
    },
  },
  {
    $addFields: {
      returnedItems: {
        $reduce: {
          input: "$returnDocs",
          initialValue: [],
          in: { $concatArrays: ["$$value", { $ifNull: ["$$this.allproduct", []] }] },
        },
      },
    },
  },
  {
    $addFields: {
      profitLines: {
        $map: {
          input: { $ifNull: ["$searchItem", []] },
          as: "line",
          in: {
            $let: {
              vars: {
                qty: num("$$line.quantity"),
                gross: { $multiply: [num("$$line.salesRate"), num("$$line.quantity")] },
                returnedQty: {
                  $sum: {
                    $map: {
                      input: { $filter: { input: "$returnedItems", as: "r", cond: isReturnOfLine } },
                      as: "r",
                      in: num("$$r.quantity"),
                    },
                  },
                },
              },
              in: {
                status: { $ifNull: ["$$line.salesStatus", "sale"] },
                productId: "$$line.productId",
                variantId: "$$line.variantId",
                barcode: "$$line.barcode",
                productDescription: "$$line.productDescription",
                color: "$$line.color",
                size: "$$line.size",
                salesRate: num("$$line.salesRate"),
                qty: "$$qty",
                gross: "$$gross",
                itemDiscount: {
                  $cond: [
                    { $eq: ["$$line.discountType", "percent"] },
                    { $divide: [{ $multiply: ["$$gross", num("$$line.discount")] }, 100] },
                    { $multiply: [num("$$line.discount"), "$$qty"] },
                  ],
                },
                returnedQty: { $min: ["$$qty", "$$returnedQty"] },
                // The cost stamped on the line when it was sold. Lines saved
                // before that existed read the catalogue: the variant's
                // purchasePrice, falling back to the product's.
                unitCost: {
                  $ifNull: [
                    "$$line.purchasePrice",
                    {
                      $ifNull: [
                        purchasePriceOf("$variantDocs", "$$line.variantId"),
                        num(purchasePriceOf("$productDocs", "$$line.productId")),
                      ],
                    },
                  ],
                },
              },
            },
          },
        },
      },
    },
  },
  {
    $addFields: {
      // A sales return flips the whole line to "return", even when only part
      // of its quantity came back. Such a line was still sold: it keeps its
      // revenue, the refund is taken off below and only the returned units
      // lose their cost. A "return" line with no sales return behind it was
      // never a sale, and neither is an "exchange" line.
      soldLines: {
        $filter: {
          input: "$profitLines",
          as: "l",
          cond: {
            $or: [
              { $eq: ["$$l.status", "sale"] },
              { $and: [{ $eq: ["$$l.status", "return"] }, { $gt: ["$$l.returnedQty", 0] }] },
            ],
          },
        },
      },
    },
  },
  { $unset: ["variantDocs", "productDocs", "returnDocs", "returnedItems", "profitLines"] },
];

const saleProfitStages = () => [
  ...soldLineStages(),
  {
    $addFields: {
      grossSales: { $sum: "$soldLines.gross" },
      itemDiscountAmount: { $sum: "$soldLines.itemDiscount" },
      returnAmount: num("$return"),
      itemsQty: {
        $sum: {
          $map: { input: "$soldLines", as: "l", in: { $subtract: ["$$l.qty", "$$l.returnedQty"] } },
        },
      },
      buyPrice: {
        $sum: {
          $map: {
            input: "$soldLines",
            as: "l",
            in: { $multiply: [{ $subtract: ["$$l.qty", "$$l.returnedQty"] }, "$$l.unitCost"] },
          },
        },
      },
    },
  },
  {
    $addFields: {
      // discountPercent is a share of the lines after their own discounts,
      // the way the sales form works out the bill.
      discountAmount: {
        $add: [
          {
            $divide: [
              {
                $multiply: [
                  { $subtract: ["$grossSales", "$itemDiscountAmount"] },
                  num("$discountPercent"),
                ],
              },
              100,
            ],
          },
          num("$lessTaka"),
        ],
      },
    },
  },
  {
    $addFields: {
      totalDiscountAmount: { $add: ["$itemDiscountAmount", "$discountAmount"] },
      profit: {
        $round: [
          {
            $subtract: [
              { $subtract: ["$grossSales", { $add: ["$itemDiscountAmount", "$discountAmount"] }] },
              { $add: ["$returnAmount", "$buyPrice"] },
            ],
          },
          2,
        ],
      },
    },
  },
  { $unset: ["soldLines"] },
];

/**
 * The same formula one sold line at a time: the pipeline leaves with one
 * document per line, the sale's own fields still on it, the line's position
 * in `lineIndex` and the line itself under `line`:
 *
 *   qty        units sold and not returned (a fully returned line is dropped)
 *   salesRate  price of one unit
 *   total      salesRate × qty
 *   discount   the line's own discount plus its share of the invoice's:
 *              discountPercent on the line's net, lessTaka spread equally
 *              over every unit sold on the invoice
 *   buyPrice   unit cost × qty
 *   profit     total − discount − buyPrice, rounded to 2 dp
 *
 * A sale's line profits add up to its saleProfitStages profit: the units a
 * sales return took back are left out here, where the invoice figure takes
 * the refund off instead.
 */
const saleLineProfitStages = () => [
  ...soldLineStages(),
  { $addFields: { soldUnits: { $sum: "$soldLines.qty" } } },
  { $unwind: { path: "$soldLines", includeArrayIndex: "lineIndex" } },
  {
    $addFields: {
      "soldLines.keptQty": { $subtract: ["$soldLines.qty", "$soldLines.returnedQty"] },
    },
  },
  { $match: { "soldLines.keptQty": { $gt: 0 } } },
  {
    $addFields: {
      // Share of the line still with the customer; qty > 0 is given by keptQty > 0
      keptShare: { $divide: ["$soldLines.keptQty", "$soldLines.qty"] },
    },
  },
  {
    $addFields: {
      lineTotal: { $multiply: ["$soldLines.gross", "$keptShare"] },
      lineItemDiscount: { $multiply: ["$soldLines.itemDiscount", "$keptShare"] },
    },
  },
  {
    $addFields: {
      lineDiscount: {
        $add: [
          "$lineItemDiscount",
          {
            $divide: [
              { $multiply: [{ $subtract: ["$lineTotal", "$lineItemDiscount"] }, num("$discountPercent")] },
              100,
            ],
          },
          {
            $cond: [
              { $gt: ["$soldUnits", 0] },
              { $multiply: [{ $divide: [num("$lessTaka"), "$soldUnits"] }, "$soldLines.keptQty"] },
              0,
            ],
          },
        ],
      },
      lineBuyPrice: { $multiply: ["$soldLines.unitCost", "$soldLines.keptQty"] },
    },
  },
  {
    $addFields: {
      line: {
        productId: "$soldLines.productId",
        variantId: "$soldLines.variantId",
        barcode: "$soldLines.barcode",
        productDescription: "$soldLines.productDescription",
        color: "$soldLines.color",
        size: "$soldLines.size",
        qty: "$soldLines.keptQty",
        salesRate: "$soldLines.salesRate",
        total: { $round: ["$lineTotal", 2] },
        discount: { $round: ["$lineDiscount", 2] },
        buyPrice: { $round: ["$lineBuyPrice", 2] },
        profit: { $round: [{ $subtract: ["$lineTotal", { $add: ["$lineDiscount", "$lineBuyPrice"] }] }, 2] },
      },
    },
  },
  { $unset: ["soldLines", "soldUnits", "keptShare", "lineTotal", "lineItemDiscount", "lineDiscount", "lineBuyPrice", "searchItem"] },
];

module.exports = { saleProfitStages, saleLineProfitStages };
