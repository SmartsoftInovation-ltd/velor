// Shared low-stock logic for the dashboard widget and the low stock report.
//
// A multi-variant product contributes one row per active variant; a single
// variant product is its own row. Each row is low when its stock is at or
// below its alert quantity (the "Stock Amount" entered on the product or
// variant). An empty Stock Amount means 0, so the row turns up once it is out
// of stock.

const DEFAULT_ALERT_QTY = 0;

// Stages that expand products into `stockRows` and keep only the low ones.
// Each surviving document carries `rowStock`, `rowAlertQty` and `rowShortfall`.
const buildLowStockStages = (match) => [
  { $match: match },
  {
    $lookup: {
      from: "variants",
      localField: "_id",
      foreignField: "product",
      as: "variants",
      pipeline: [
        { $match: { isActive: { $ne: false } } },
        {
          $project: {
            variantName: 1,
            barCode: 1,
            sku: 1,
            size: 1,
            color: 1,
            purchasePrice: 1,
            retailPrice: 1,
            wholesalePrice: 1,
            stockVariant: 1,
            unit: 1,
            groupUnit: 1,
            groupUnitQuantity: 1,
            alertQuantity: 1,
            alertVariantStock: 1,
          },
        },
      ],
    },
  },
  {
    $addFields: {
      stockRows: {
        $cond: [
          { $gt: [{ $size: "$variants" }, 0] },
          {
            $map: {
              input: "$variants",
              as: "v",
              in: {
                variantId: "$$v._id",
                variantName: "$$v.variantName",
                barcode: { $ifNull: ["$$v.barCode", { $ifNull: ["$$v.sku", "$barCode"] }] },
                size: { $ifNull: ["$$v.size", "$size"] },
                color: { $ifNull: ["$$v.color", "$color"] },
                buyRate: { $ifNull: ["$$v.purchasePrice", "$purchasePrice"] },
                wsPrice: { $ifNull: ["$$v.wholesalePrice", "$wholesalePrice"] },
                retailPrice: { $ifNull: ["$$v.retailPrice", "$retailPrice"] },
                unit: { $ifNull: ["$$v.unit", "$unit"] },
                groupUnit: { $ifNull: ["$$v.groupUnit", "$groupUnit"] },
                groupUnitQuantity: { $ifNull: ["$$v.groupUnitQuantity", "$groupUnitQuantity"] },
                stock: { $ifNull: ["$$v.stockVariant", 0] },
                // The variant's own Stock Amount wins over the product's.
                alertQty: {
                  $ifNull: [
                    "$$v.alertQuantity",
                    {
                      $ifNull: [
                        "$$v.alertVariantStock",
                        { $ifNull: ["$alertQuantity", DEFAULT_ALERT_QTY] },
                      ],
                    },
                  ],
                },
              },
            },
          },
          {
            $cond: [
              // A multi-variant product with no variants yet has nothing to sell.
              { $eq: ["$variantType", "multipleVariant"] },
              [],
              [
                {
                  variantId: null,
                  variantName: "Single",
                  barcode: { $ifNull: ["$barCode", "$sku"] },
                  size: "$size",
                  color: "$color",
                  buyRate: "$purchasePrice",
                  wsPrice: "$wholesalePrice",
                  retailPrice: "$retailPrice",
                  unit: "$unit",
                  groupUnit: "$groupUnit",
                  groupUnitQuantity: "$groupUnitQuantity",
                  stock: { $ifNull: ["$stock", 0] },
                  alertQty: { $ifNull: ["$alertQuantity", DEFAULT_ALERT_QTY] },
                },
              ],
            ],
          },
        ],
      },
    },
  },
  { $unwind: "$stockRows" },
  {
    $addFields: {
      rowStock: { $ifNull: ["$stockRows.stock", 0] },
      rowAlertQty: { $ifNull: ["$stockRows.alertQty", DEFAULT_ALERT_QTY] },
      rowBuyRate: { $ifNull: ["$stockRows.buyRate", 0] },
    },
  },
  { $match: { $expr: { $lte: ["$rowStock", "$rowAlertQty"] } } },
  { $addFields: { rowShortfall: { $subtract: ["$rowAlertQty", "$rowStock"] } } },
];

module.exports = { DEFAULT_ALERT_QTY, buildLowStockStages };
