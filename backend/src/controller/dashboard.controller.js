const { asynchandeler } = require("../lib/asyncHandeler");
const { apiResponse } = require("../utils/apiResponse");
const { statusCodes } = require("../constant/constant");
const {
  getCache,
  setCache,
  buildCacheKey,
} = require("@/utils/cache.util");
const salesModel = require("../models/sales.model");
const productModel = require("../models/product.model");
const variantModel = require("../models/variant.model");
const { buildLowStockStages } = require("../utils/lowStock.util");
const { customerModel, customerPaymentRecived, customerAdvancePaymentModel } = require("../models/customer.model");
const { SupplierModel, SupplierDuePayment } = require("../models/supplier.model");
const employeeModel = require("../models/employee.model");
const crateTransactionModel = require("../models/crateTransaction.model");
const purchaseModel = require("../models/purchase.model");
const { employeeAdvancePayment } = require("../models/advancePayment.model");
const DailyCashSummary = require("../models/dailyCashSummary.model");
const Account = require("../models/account.model");
const stockAdjustModel = require("../models/stockadjust.model");
const purchaseReturnModel = require("../models/purchaseReturn.model");
const salesReturnModel = require("../models/salesReturn.model");

const NS = "dashboard";
const CACHE_TTL = 2 * 60; // 2 minutes — dashboard tolerates slight staleness

// Resolve the requested window (?range=today|7d|30d|90d|12m|all). Defaults to 30d.
// An explicit ?startDate/&endDate (YYYY-MM-DD) wins over ?range when present —
// callers that expose a custom date picker pass these instead of a preset key.
const resolveRange = (range, startDate, endDate) => {
  if (startDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = endDate ? new Date(endDate) : new Date(startDate);
    end.setHours(23, 59, 59, 999);
    return { start, end, key: `${startDate}:${endDate || startDate}` };
  }

  const now = new Date();
  const start = new Date(now);
  switch (range) {
    case "today":
      start.setHours(0, 0, 0, 0);
      break;
    case "7d":
      start.setDate(now.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      break;
    case "90d":
      start.setDate(now.getDate() - 89);
      start.setHours(0, 0, 0, 0);
      break;
    case "12m":
      start.setMonth(now.getMonth() - 11, 1);
      start.setHours(0, 0, 0, 0);
      break;
    case "all":
      return { start: null, end: now, key: "all" };
    case "30d":
    default:
      start.setDate(now.getDate() - 29);
      start.setHours(0, 0, 0, 0);
      return { start, end: now, key: "30d" };
  }
  return { start, end: now, key: range };
};

// Profit pipeline, shared by the Total Sale box and the dashboard overview so
// the two can never disagree.
//
// Profit is revenue actually earned minus what the goods cost, per line:
//
//   grossLine    = salesRate × quantity
//   lineDiscount = discountType "amount" ? discount × quantity   (taka/unit)
//                                        : grossLine × discount% (percent)
//   netLine      = grossLine − lineDiscount
//   invoiceCut   = netLine × sale.discountPercent / 100
//   lessCut      = sale.lessTaka ÷ (number of lines on the sale)
//   profit      += (netLine − invoiceCut − lessCut) − purchasePrice × quantity
//
// Notes on the choices here:
//   - The line's own discount is read from the stored searchItem, NOT re-resolved
//     from the catalogue. The sales form resolves a product/variant/category
//     discount at pick time and freezes it onto the line, so re-resolving would
//     double-count and would also re-price historical sales whenever the
//     catalogue changes. What the customer was charged is what profit uses.
//   - "amount" discounts are per unit, mirroring the sales form's
//     (salesRate − discount) × quantity.
//   - discountPercent applies to the already-discounted netLine, matching how
//     the form computes the invoice total.
//   - lessTaka is split equally across the sale's lines (60 over 3 lines = 20
//     each), so a whole-invoice reduction lands proportionally on profit.
//   - VAT, delivery and labour are excluded: VAT is passed through to the
//     government and the other two are cost recovery, not margin.
//   - Only salesStatus "sale" lines count; returns and exchanges are not sales.
//   - subtotal is deliberately NOT trusted — it is written by the client. Every
//     figure is recomputed here from salesRate/discount/quantity.
const buildProfitPipeline = (dateMatch) => [
  { $match: dateMatch },
  // Captured before $unwind — once unwound the array length is gone, and
  // lessTaka cannot be divided across the sale's lines without it.
  { $addFields: { lineCount: { $size: { $ifNull: ["$searchItem", []] } } } },
  { $unwind: "$searchItem" },
  { $match: { "searchItem.salesStatus": "sale" } },
  {
    $lookup: {
      from: "products",
      localField: "searchItem.productId",
      foreignField: "_id",
      as: "productDoc",
    },
  },
  {
    $lookup: {
      from: "variants",
      localField: "searchItem.variantId",
      foreignField: "_id",
      as: "variantDoc",
    },
  },
  {
    $addFields: {
      grossLine: {
        $multiply: [
          { $ifNull: ["$searchItem.salesRate", 0] },
          { $ifNull: ["$searchItem.quantity", 0] },
        ],
      },
      unitCost: {
        $ifNull: [
          { $first: "$variantDoc.purchasePrice" },
          { $ifNull: [{ $first: "$productDoc.purchasePrice" }, 0] },
        ],
      },
    },
  },
  {
    $addFields: {
      netLine: {
        $subtract: [
          "$grossLine",
          {
            $cond: [
              { $eq: ["$searchItem.discountType", "percent"] },
              {
                $divide: [
                  {
                    $multiply: [
                      "$grossLine",
                      { $ifNull: ["$searchItem.discount", 0] },
                    ],
                  },
                  100,
                ],
              },
              {
                $multiply: [
                  { $ifNull: ["$searchItem.discount", 0] },
                  { $ifNull: ["$searchItem.quantity", 0] },
                ],
              },
            ],
          },
        ],
      },
    },
  },
  {
    $addFields: {
      netRevenue: {
        $subtract: [
          {
            $subtract: [
              "$netLine",
              {
                $divide: [
                  {
                    $multiply: [
                      "$netLine",
                      { $ifNull: ["$discountPercent", 0] },
                    ],
                  },
                  100,
                ],
              },
            ],
          },
          // Guard against a zero lineCount: $unwind already proves at least one
          // line exists, but a divide-by-zero would poison the whole sum.
          {
            $cond: [
              { $gt: ["$lineCount", 0] },
              { $divide: [{ $ifNull: ["$lessTaka", 0] }, "$lineCount"] },
              0,
            ],
          },
        ],
      },
    },
  },
  {
    $group: {
      _id: null,
      // Kept at full precision; rounded once by the caller. Rounding per line
      // would drift across a large invoice count.
      profit: {
        $sum: {
          $subtract: [
            "$netRevenue",
            { $multiply: ["$unitCost", { $ifNull: ["$searchItem.quantity", 0] }] },
          ],
        },
      },
    },
  },
];

// @desc  aggregated dashboard overview — one call, many widgets
exports.getOverview = asynchandeler(async (req, res) => {
  const { start, end, key } = resolveRange(
    req.query.range,
    req.query.startDate,
    req.query.endDate,
  );

  const cacheKey = await buildCacheKey(NS, `overview:${key}`);
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(res, statusCodes.OK, "Dashboard fetched", {
      ...cached,
      fromCache: true,
    });
  }

  // Match filter for time-bounded sales queries
  const dateMatch = start ? { createdAt: { $gte: start, $lte: end } } : {};

  // "Today" window — independent of the range selector (summary cards below)
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayMatch = { createdAt: { $gte: todayStart } };

  const [
    salesAgg,
    salesByType,
    paymentSplit,
    dailySeries,
    recentSales,
    catalogCounts,
    stockValueAgg,
    variantStockAgg,
    lowStockProducts,
    customerCount,
    duesAgg,
    supplierCount,
    employeeCount,
    salesTodayAgg,
    cashTodayAgg,
    supplierDuesAgg,
    invoiceStatusAgg,
    accountsPayableAgg,
    accountsReceivableAgg,
    accountsBalanceAgg,
    purchaseItemsAgg,
    productActiveInactive,
    variantActiveInactive,
    supplierPaymentAgg,
    customerDuePaymentAgg,
    inflowTransactions,
    outflowTransactions,
    grossProfitAgg,
    stockOutCount,
    employeeAdvanceAgg,
  ] = await Promise.all([
    // 1. Headline sales KPIs within range
    salesModel.aggregate([
      { $match: dateMatch },
      {
        $group: {
          _id: null,
          revenue: { $sum: "$payable" },
          // Cash actually kept: netPaid excludes change handed back. Sales
          // written before that field existed fall back to paid - changes.
          collected: {
            $sum: {
              $ifNull: [
                "$netPaid",
                {
                  $max: [
                    0,
                    { $subtract: [{ $ifNull: ["$paid", 0] }, { $ifNull: ["$changes", 0] }] },
                  ],
                },
              ],
            },
          },
          dues: { $sum: "$presentDue" },
          orders: { $sum: 1 },
          itemsSold: { $sum: { $sum: "$searchItem.quantity" } },
        },
      },
    ]),

    // 2. Sales grouped by type (retail / wholesale / orders)
    salesModel.aggregate([
      { $match: dateMatch },
      {
        $group: {
          _id: "$salesType",
          revenue: { $sum: "$payable" },
          count: { $sum: 1 },
        },
      },
    ]),

    // 3. Payment status split — `amount` reflects what the status name
    // means: for "paid" it's the collected total (payable, since a paid
    // invoice's due is 0); for "due"/"partial" it's the outstanding balance
    // (presentDue), not the full invoice value, so the card shows how much
    // money is actually owed rather than restating the bill total on every row.
    salesModel.aggregate([
      { $match: dateMatch },
      {
        $group: {
          _id: "$paymentStatus",
          count: { $sum: 1 },
          payableAmount: { $sum: "$payable" },
          dueAmount: { $sum: "$presentDue" },
        },
      },
    ]),

    // 4. Daily revenue series for the trend chart
    salesModel.aggregate([
      { $match: dateMatch },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          revenue: { $sum: "$payable" },
          orders: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),

    // 6. Recent sales feed
    salesModel
      .find(dateMatch)
      .sort({ createdAt: -1 })
      .limit(8)
      .select(
        "invoiceNumber payable paid presentDue paymentStatus salesType customerType createdAt",
      )
      .lean(),

    // 7. Catalog counts (not range-bound)
    Promise.all([
      productModel.countDocuments({ isActive: true }),
      productModel.countDocuments({}),
    ]),

    // 8. Product-level inventory valuation (single-variant products)
    productModel.aggregate([
      {
        $group: {
          _id: null,
          units: { $sum: "$stock" },
          retailValue: {
            $sum: { $multiply: ["$stock", { $ifNull: ["$retailPrice", 0] }] },
          },
          wholesaleValue: {
            $sum: {
              $multiply: ["$stock", { $ifNull: ["$wholesalePrice", 0] }],
            },
          },
          costValue: {
            $sum: { $multiply: ["$stock", { $ifNull: ["$purchasePrice", 0] }] },
          },
        },
      },
    ]),

    // 9. Variant-level inventory valuation
    variantModel.aggregate([
      {
        $group: {
          _id: null,
          units: { $sum: "$stockVariant" },
          retailValue: {
            $sum: {
              $multiply: ["$stockVariant", { $ifNull: ["$retailPrice", 0] }],
            },
          },
          wholesaleValue: {
            $sum: {
              $multiply: [
                "$stockVariant",
                { $ifNull: ["$wholesalePrice", 0] },
              ],
            },
          },
          costValue: {
            $sum: {
              $multiply: ["$stockVariant", { $ifNull: ["$purchasePrice", 0] }],
            },
          },
        },
      },
    ]),

    // 10. Low-stock items: each product or variant at or below its own
    // Stock Amount, emptiest first.
    productModel.aggregate([
      ...buildLowStockStages({ isActive: { $ne: false } }),
      { $sort: { rowStock: 1, rowShortfall: -1, name: 1 } },
      { $limit: 8 },
      {
        $project: {
          name: 1,
          variantName: "$stockRows.variantName",
          stock: "$rowStock",
          alertQty: "$rowAlertQty",
          retailPrice: "$stockRows.retailPrice",
          barCode: "$stockRows.barcode",
          color: "$stockRows.color",
          size: "$stockRows.size",
        },
      },
    ]),

    // 11. Total customers
    customerModel.countDocuments({}),

    // 12. Outstanding customer dues across all sales (not range-bound).
    // Listed customers only: a walking customer has no account to owe against,
    // so their unpaid amount is not a receivable the shop can collect.
    salesModel.aggregate([
      { $match: { "customerType.type": "listed" } },
      {
        $group: {
          _id: null,
          totalDue: { $sum: "$presentDue" },
        },
      },
    ]),

    // 13. Total suppliers (not soft-deleted)
    SupplierModel.countDocuments({ deletedAt: null }),

    // 14. Total employees
    employeeModel.countDocuments({}),

    // 15. Today's sales breakdown (payable / paid / due)
    salesModel.aggregate([
      { $match: todayMatch },
      {
        $group: {
          _id: null,
          totalSales: { $sum: "$payable" },
          cashSales: {
            $sum: {
              $ifNull: [
                "$netPaid",
                {
                  $max: [
                    0,
                    { $subtract: [{ $ifNull: ["$paid", 0] }, { $ifNull: ["$changes", 0] }] },
                  ],
                },
              ],
            },
          },
          duesSales: { $sum: "$presentDue" },
        },
      },
    ]),

    // 16. Today's cash transactions grouped by type
    crateTransactionModel.aggregate([
      { $match: todayMatch },
      {
        $group: {
          _id: "$transactionType",
          amount: { $sum: "$amount" },
        },
      },
    ]),

    // 17. Overall supplier dues (opening + purchase due)
    SupplierModel.aggregate([
      { $match: { deletedAt: null } },
      {
        $group: {
          _id: null,
          totalDue: {
            $sum: {
              $add: [
                { $ifNull: ["$openingDues", 0] },
                { $ifNull: ["$totalPurchaseDue", 0] },
              ],
            },
          },
        },
      },
    ]),

    // 18. Invoice status split (complete / pending / draft) within range
    salesModel.aggregate([
      { $match: dateMatch },
      {
        $group: {
          _id: "$invoiceStatus",
          count: { $sum: 1 },
        },
      },
    ]),

    // 19. Payable — total due owed to all suppliers
    SupplierModel.aggregate([
      { $match: { deletedAt: null } },
      { $group: { _id: null, total: { $sum: "$openingDues" } } },
    ]),

    // 20. Receivable — total due from customers, only those with a due > 0
    customerModel.aggregate([
      { $match: { openingDues: { $gt: 0 } } },
      { $group: { _id: null, total: { $sum: "$openingDues" } } },
    ]),

    // 20b. Accounts Balance — live sum across every account's balance
    Account.aggregate([
      { $group: { _id: null, total: { $sum: "$balance" } } },
    ]),

    // 21. Purchase items — invoices + quantity/subtotal within range
    purchaseModel.aggregate([
      { $match: dateMatch },
      { $unwind: "$allproduct" },
      {
        $group: {
          _id: null,
          invoices: { $addToSet: "$_id" },
          quantity: { $sum: "$allproduct.quantity" },
          subtotal: { $sum: "$allproduct.subTotal" },
        },
      },
      {
        $project: {
          _id: 0,
          invoiceCount: { $size: "$invoices" },
          quantity: 1,
          subtotal: 1,
        },
      },
    ]),

    // 22. Product active/inactive counts
    productModel.aggregate([
      { $group: { _id: "$isActive", count: { $sum: 1 } } },
    ]),

    // 23. Variant active/inactive counts
    variantModel.aggregate([
      { $group: { _id: "$isActive", count: { $sum: 1 } } },
    ]),

    // 24. Supplier payments made within range
    SupplierDuePayment.aggregate([
      { $match: { ...dateMatch, deletedAt: null } },
      {
        $group: {
          _id: null,
          amount: { $sum: "$paidAmount" },
          count: { $sum: 1 },
        },
      },
    ]),

    // 25. Customer due payments received within range
    customerPaymentRecived.aggregate([
      { $match: { ...dateMatch, deletedAt: null } },
      {
        $group: {
          _id: null,
          amount: { $sum: "$paidAmount" },
          count: { $sum: 1 },
        },
      },
    ]),

    // 26. Today's inflow (cash received) transactions feed
    crateTransactionModel
      .find({ ...todayMatch, transactionType: "cash recived" })
      .sort({ createdAt: -1 })
      .limit(8)
      .select("transactionSerialId transactionDescription amount createdAt")
      .lean(),

    // 27. Today's outflow (cash payment) transactions feed
    crateTransactionModel
      .find({ ...todayMatch, transactionType: "cash payment" })
      .sort({ createdAt: -1 })
      .limit(8)
      .select("transactionSerialId transactionDescription amount createdAt")
      .lean(),

    // 28. Gross profit within range — line revenue after every discount,
    // minus each line's actual purchase-price cost. See buildProfitPipeline.
    salesModel.aggregate(buildProfitPipeline(dateMatch)),

    // 29. Total out-of-stock (0 units) active products — uncapped count
    productModel.countDocuments({ isActive: true, stock: 0 }),

    // 30. Employee advance payments within range
    employeeAdvancePayment.aggregate([
      { $match: { ...dateMatch, isActive: true } },
      {
        $group: {
          _id: null,
          amount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const s = salesAgg[0] || {
    revenue: 0,
    collected: 0,
    dues: 0,
    orders: 0,
    itemsSold: 0,
  };
  const pv = stockValueAgg[0] || {
    units: 0,
    retailValue: 0,
    wholesaleValue: 0,
    costValue: 0,
  };
  const vv = variantStockAgg[0] || {
    units: 0,
    retailValue: 0,
    wholesaleValue: 0,
    costValue: 0,
  };

  const payload = {
    range: key,
    kpis: {
      revenue: Math.round(s.revenue || 0),
      collected: Math.round(s.collected || 0),
      dues: Math.round(s.dues || 0),
      orders: s.orders || 0,
      itemsSold: s.itemsSold || 0,
      avgOrderValue: s.orders ? Math.round((s.revenue || 0) / s.orders) : 0,
      totalCustomers: customerCount || 0,
      activeProducts: catalogCounts[0] || 0,
      totalProducts: catalogCounts[1] || 0,
      inventoryUnits: (pv.units || 0) + (vv.units || 0),
      inventoryRetailValue: Math.round(
        (pv.retailValue || 0) + (vv.retailValue || 0),
      ),
      inventoryWholesaleValue: Math.round(
        (pv.wholesaleValue || 0) + (vv.wholesaleValue || 0),
      ),
      inventoryCostValue: Math.round(
        (pv.costValue || 0) + (vv.costValue || 0),
      ),
      outstandingDues: Math.round(duesAgg[0]?.totalDue || 0),
      grossProfit: round2(grossProfitAgg[0]?.profit || 0),
      stockOutCount: stockOutCount || 0,
    },
    summary: (() => {
      const st = salesTodayAgg[0] || {
        totalSales: 0,
        cashSales: 0,
        duesSales: 0,
      };
      const cashReceive = Math.round(
        cashTodayAgg.find((c) => c._id === "cash recived")?.amount || 0,
      );
      const cashPayment = Math.round(
        cashTodayAgg.find((c) => c._id === "cash payment")?.amount || 0,
      );
      const supplierDues = Math.round(supplierDuesAgg[0]?.totalDue || 0);
      const customerDues = Math.round(duesAgg[0]?.totalDue || 0);
      return {
        profile: {
          totalCustomer: customerCount || 0,
          totalSupplier: supplierCount || 0,
          totalEmployee: employeeCount || 0,
        },
        salesToday: {
          totalSales: Math.round(st.totalSales || 0),
          cashSales: Math.round(st.cashSales || 0),
          duesSales: Math.round(st.duesSales || 0),
        },
        cashToday: {
          cashReceive,
          cashPayment,
          cashBalance: cashReceive - cashPayment,
        },
        overallBalance: {
          supplierDues,
          customerDues,
          liabilityBalance: supplierDues - customerDues,
        },
      };
    })(),
    salesByType: salesByType.map((t) => ({
      type: t._id || "unknown",
      revenue: Math.round(t.revenue || 0),
      count: t.count || 0,
    })),
    paymentSplit: paymentSplit.map((p) => ({
      status: p._id || "unknown",
      count: p.count || 0,
      amount: Math.round(p._id === "paid" ? p.payableAmount || 0 : p.dueAmount || 0),
    })),
    dailySeries: dailySeries.map((d) => ({
      date: d._id,
      revenue: Math.round(d.revenue || 0),
      orders: d.orders || 0,
    })),
    recentSales: recentSales.map((r) => ({
      invoiceNumber: r.invoiceNumber,
      payable: Math.round(r.payable || 0),
      paid: Math.round(r.paid || 0),
      presentDue: Math.round(r.presentDue || 0),
      paymentStatus: r.paymentStatus,
      salesType: r.salesType,
      customerName:
        r.customerType?.walking?.customerName ||
        (r.customerType?.type === "listed" ? "Listed customer" : "Walking"),
      createdAt: r.createdAt,
    })),
    lowStock: lowStockProducts.map((p) => {
      // "N/A" is the schema placeholder for an unset size/color.
      const attr = (v) => (v && v !== "N/A" ? String(v) : "");
      return {
        name: p.name,
        variantName: p.variantName && p.variantName !== "Single" ? p.variantName : "",
        stock: p.stock ?? 0,
        alertQty: p.alertQty ?? 0,
        retailPrice: Math.round(p.retailPrice || 0),
        barCode: p.barCode || "",
        color: attr(p.color),
        size: attr(p.size),
      };
    }),
    invoices: (() => {
      const byStatus = { complete: 0, pending: 0, draft: 0 };
      invoiceStatusAgg.forEach((r) => {
        if (r._id in byStatus) byStatus[r._id] = r.count;
      });
      return {
        total: byStatus.complete + byStatus.pending + byStatus.draft,
        complete: byStatus.complete,
        pending: byStatus.pending,
        draft: byStatus.draft,
      };
    })(),
    accountsBalance: {
      balance: Math.round(accountsBalanceAgg[0]?.total || 0),
      payable: Math.round(accountsPayableAgg[0]?.total || 0),
      receivable: Math.round(accountsReceivableAgg[0]?.total || 0),
    },
    purchaseItems: {
      invoiceCount: purchaseItemsAgg[0]?.invoiceCount || 0,
      quantity: purchaseItemsAgg[0]?.quantity || 0,
      total: Math.round(purchaseItemsAgg[0]?.subtotal || 0),
    },
    soldItems: {
      invoiceCount: s.orders || 0,
      quantity: s.itemsSold || 0,
      total: Math.round(s.revenue || 0),
    },
    productStatus: (() => {
      const p = { active: 0, inactive: 0 };
      productActiveInactive.forEach((r) => {
        if (r._id === true) p.active += r.count;
        else p.inactive += r.count;
      });
      const v = { active: 0, inactive: 0 };
      variantActiveInactive.forEach((r) => {
        if (r._id === true) v.active += r.count;
        else v.inactive += r.count;
      });
      return {
        active: p.active + v.active,
        inactive: p.inactive + v.inactive,
        total: p.active + v.active + p.inactive + v.inactive,
      };
    })(),
    supplierPayment: {
      amount: Math.round(supplierPaymentAgg[0]?.amount || 0),
      count: supplierPaymentAgg[0]?.count || 0,
    },
    customerDuePayment: {
      amount: Math.round(customerDuePaymentAgg[0]?.amount || 0),
      count: customerDuePaymentAgg[0]?.count || 0,
    },
    inflowTransactions: inflowTransactions.map((t) => ({
      serialId: t.transactionSerialId || "",
      description: t.transactionDescription || "",
      amount: Math.round(t.amount || 0),
      createdAt: t.createdAt,
    })),
    outflowTransactions: outflowTransactions.map((t) => ({
      serialId: t.transactionSerialId || "",
      description: t.transactionDescription || "",
      amount: Math.round(t.amount || 0),
      createdAt: t.createdAt,
    })),
    employeeAdvance: {
      amount: Math.round(employeeAdvanceAgg[0]?.amount || 0),
      count: employeeAdvanceAgg[0]?.count || 0,
    },
  };

  await setCache(cacheKey, payload, CACHE_TTL);

  return apiResponse.sendSuccess(res, statusCodes.OK, "Dashboard fetched", {
    ...payload,
    fromCache: false,
  });
});

// @desc  Total Invoices box — count + complete/pending/draft split, range-filtered
exports.getInvoiceStats = asynchandeler(async (req, res) => {
  const { start, end, key } = resolveRange(
    req.query.range,
    req.query.startDate,
    req.query.endDate,
  );

  const cacheKey = await buildCacheKey(NS, `invoices:${key}`);
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(res, statusCodes.OK, "Invoice stats fetched", {
      ...cached,
      fromCache: true,
    });
  }

  const dateMatch = start ? { date: { $gte: start, $lte: end } } : {};

  const invoiceStatusAgg = await salesModel.aggregate([
    { $match: dateMatch },
    {
      $group: {
        _id: "$invoiceStatus",
        count: { $sum: 1 },
      },
    },
  ]);

  const byStatus = { complete: 0, pending: 0, draft: 0 };
  invoiceStatusAgg.forEach((r) => {
    if (r._id in byStatus) byStatus[r._id] = r.count;
  });

  const payload = {
    range: key,
    invoices: {
      total: byStatus.complete + byStatus.pending + byStatus.draft,
      complete: byStatus.complete,
      pending: byStatus.pending,
      draft: byStatus.draft,
    },
  };

  await setCache(cacheKey, payload, CACHE_TTL);

  return apiResponse.sendSuccess(res, statusCodes.OK, "Invoice stats fetched", {
    ...payload,
    fromCache: false,
  });
});

// @desc  Total Sale box — total sale amount, received, due, gross profit — range-filtered
exports.getSalesSummary = asynchandeler(async (req, res) => {
  const { start, end, key } = resolveRange(
    req.query.range,
    req.query.startDate,
    req.query.endDate,
  );

  const cacheKey = await buildCacheKey(NS, `sales-summary:${key}`);
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(res, statusCodes.OK, "Sales summary fetched", {
      ...cached,
      fromCache: true,
    });
  }

  // Filtered on the sale's own `date` field (the transaction date the seller
  // set), not `createdAt` (when the record was saved) — this box answers
  // "what sold on this date", which can differ from when it was entered.
  const dateMatch = start ? { date: { $gte: start, $lte: end } } : {};

  const [salesAgg, grossProfitAgg] = await Promise.all([
    salesModel.aggregate([
      { $match: dateMatch },
      {
        $group: {
          _id: null,
          revenue: { $sum: "$payable" },
          // Cash actually kept: netPaid excludes change handed back. Sales
          // written before that field existed fall back to paid - changes.
          collected: {
            $sum: {
              $ifNull: [
                "$netPaid",
                {
                  $max: [
                    0,
                    { $subtract: [{ $ifNull: ["$paid", 0] }, { $ifNull: ["$changes", 0] }] },
                  ],
                },
              ],
            },
          },
          dues: { $sum: "$presentDue" },
          orders: { $sum: 1 },
        },
      },
    ]),

    // Profit after every discount level — see buildProfitPipeline.
    salesModel.aggregate(buildProfitPipeline(dateMatch)),
  ]);

  const s = salesAgg[0] || { revenue: 0, collected: 0, dues: 0, orders: 0 };

  const payload = {
    range: key,
    sales: {
      total: Math.round(s.revenue || 0),
      received: Math.round(s.collected || 0),
      due: Math.round(s.dues || 0),
      // Profit keeps 2 decimals — line discounts and percentage cuts rarely
      // land on whole taka, and rounding to integers hid real money.
      profit: round2(grossProfitAgg[0]?.profit || 0),
      orders: s.orders || 0,
    },
  };

  await setCache(cacheKey, payload, CACHE_TTL);

  return apiResponse.sendSuccess(res, statusCodes.OK, "Sales summary fetched", {
    ...payload,
    fromCache: false,
  });
});

// Round to 2 decimal places without losing exact figures (no whole-number rounding)
const round2 = (n) => Math.round((n || 0) * 100) / 100;

// @desc  Total Transaction box — combined inflow, payment, and balance across
// account/customer/sales/purchase/supplier modules — range-filtered
exports.getTransactionSummary = asynchandeler(async (req, res) => {
  const { start, end, key } = resolveRange(
    req.query.range,
    req.query.startDate,
    req.query.endDate,
  );

  const cacheKey = await buildCacheKey(NS, `transaction-summary:${key}`);
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(res, statusCodes.OK, "Transaction summary fetched", {
      ...cached,
      fromCache: true,
    });
  }

  const dateMatch = start ? { date: { $gte: start, $lte: end } } : {};

  const [
    cashRecivedAgg,
    cashPaymentAgg,
    customerPaymentAgg,
    salesPaidAgg,
    purchasePaidAgg,
    supplierPaidAgg,
  ] = await Promise.all([
    // Account module — cash recived transactions
    crateTransactionModel.aggregate([
      { $match: { ...dateMatch, transactionType: "cash recived" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),

    // Account module — cash payment transactions
    crateTransactionModel.aggregate([
      { $match: { ...dateMatch, transactionType: "cash payment" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),

    // Customer module — payment recived, net of less amount and cashback
    customerPaymentRecived.aggregate([
      { $match: { ...dateMatch, deletedAt: null } },
      {
        $group: {
          _id: null,
          total: {
            $sum: {
              $subtract: [
                { $subtract: ["$paidAmount", "$lessAmount"] },
                "$cashBack",
              ],
            },
          },
        },
      },
    ]),

    // Sales module — cash kept (netPaid, excludes change handed back)
    salesModel.aggregate([
      { $match: dateMatch },
      {
        $group: {
          _id: null,
          total: {
            $sum: {
              $ifNull: [
                "$netPaid",
                {
                  $max: [
                    0,
                    { $subtract: [{ $ifNull: ["$paid", 0] }, { $ifNull: ["$changes", 0] }] },
                  ],
                },
              ],
            },
          },
        },
      },
    ]),

    // Purchase module — paid amount
    purchaseModel.aggregate([
      { $match: dateMatch },
      { $group: { _id: null, total: { $sum: "$paid" } } },
    ]),

    // Supplier module — due payment paid amount
    SupplierDuePayment.aggregate([
      { $match: { ...dateMatch, deletedAt: null } },
      { $group: { _id: null, total: { $sum: "$paidAmount" } } },
    ]),
  ]);

  const totalTransaction =
    (cashRecivedAgg[0]?.total || 0) +
    (customerPaymentAgg[0]?.total || 0) +
    (salesPaidAgg[0]?.total || 0);

  const totalPayment =
    (purchasePaidAgg[0]?.total || 0) +
    (supplierPaidAgg[0]?.total || 0) +
    (cashPaymentAgg[0]?.total || 0);

  const payload = {
    range: key,
    transaction: {
      totalTransaction: round2(totalTransaction),
      totalPayment: round2(totalPayment),
      totalBalance: round2(totalTransaction - totalPayment),
    },
  };

  await setCache(cacheKey, payload, CACHE_TTL);

  return apiResponse.sendSuccess(res, statusCodes.OK, "Transaction summary fetched", {
    ...payload,
    fromCache: false,
  });
});

// @desc  Inflow Transaction box — actual cash inflow received in the selected
// window, combining: wholesale sales, retail sales, wholesale orders, retail
// sales orders (all four are `sales` docs split by salesType, summed on the
// `paid` field so only cash actually collected counts — not the invoice
// total), customer payment received (net of less-amount and cashback),
// customer advance payment (net of cashback), and manual cash-received
// transactions logged against accounts. Range-filtered like every other box.
exports.getInflowTransactionSummary = asynchandeler(async (req, res) => {
  const { start, end, key } = resolveRange(
    req.query.range,
    req.query.startDate,
    req.query.endDate,
  );

  const cacheKey = await buildCacheKey(NS, `inflow-transaction-summary:${key}`);
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(res, statusCodes.OK, "Inflow transaction summary fetched", {
      ...cached,
      fromCache: true,
    });
  }

  const dateMatch = start ? { date: { $gte: start, $lte: end } } : {};

  const [
    salesByTypeAgg,
    customerPaymentAgg,
    customerAdvancePaymentAgg,
    cashReceivedTxns,
    salesInvoiceDocs,
    customerDuePaymentDocs,
    customerAdvancePaymentDocs,
    purchaseReturnDocs,
  ] = await Promise.all([
      // 1-4. Sales module — cash actually collected (netPaid, so change given
      // back at the counter is excluded), grouped by salesType
      salesModel.aggregate([
        { $match: dateMatch },
        {
          $group: {
            _id: "$salesType",
            amount: {
              $sum: {
                $ifNull: [
                  "$netPaid",
                  {
                    $max: [
                      0,
                      { $subtract: [{ $ifNull: ["$paid", 0] }, { $ifNull: ["$changes", 0] }] },
                    ],
                  },
                ],
              },
            },
            count: { $sum: 1 },
          },
        },
      ]),

      // 5. Customer payment received — net of less amount and cashback
      customerPaymentRecived.aggregate([
        { $match: { ...dateMatch, deletedAt: null } },
        {
          $group: {
            _id: null,
            paidAmount: { $sum: "$paidAmount" },
            lessAmount: { $sum: "$lessAmount" },
            cashBack: { $sum: "$cashBack" },
            count: { $sum: 1 },
          },
        },
      ]),

      // 6. Customer advance payment — net of cashback (this model has no
      // less-amount field, so only paidAmount and advanceCashBack apply)
      customerAdvancePaymentModel.aggregate([
        { $match: { ...dateMatch, deletedAt: null } },
        {
          $group: {
            _id: null,
            paidAmount: { $sum: "$paidAmount" },
            cashBack: { $sum: "$advanceCashBack" },
            count: { $sum: 1 },
          },
        },
      ]),

      // 7. Manual cash-received transactions from All Accounts (Add Transaction).
      //
      // Sales, customer due payments and customer advance payments each write
      // their own "cash recived" transaction automatically (see
      // applySalePayments in sales.controller.js), so counting every such
      // transaction here on top of sources 1-6 double-counts the same money.
      // Only transactions with no originating reference are genuinely manual
      // entries, and only those belong in this source.
      crateTransactionModel
        .find({
          ...dateMatch,
          transactionType: "cash recived",
          saleReference: null,
          customerPaymentReference: null,
          customerAdvancePaymentReference: null,
          // A purchase return writes its own refund transaction and is already
          // counted by the Purchase Return source below, so counting it here
          // too would double the same money.
          purchaseReturnReference: null,
        })
        .sort({ createdAt: -1 })
        .populate("transactionCategory", "name")
        .select("transactionSerialId transactionDescription amount transactionCategory createdAt")
        .lean(),

      // 8. Per-invoice sales rows — drives the "Sales Invoice" list in the
      // Inflow card, one row per invoice. Walking customers are included:
      // their cash is received all the same, and excluding them made the box
      // disagree with the sales total above. `netPaid` is the cash the shop
      // actually kept (change handed back already deducted), which is what
      // source 1-4 sums, so the rows and the source total agree.
      salesModel
        .find(dateMatch)
        .sort({ createdAt: -1 })
        .populate("customerType.customerId", "fullName customerId")
        .select("invoiceNumber paid changes netPaid total customerType createdAt")
        .lean(),

      // 9. Per-payment customer due-payment rows — net of less amount and cashback.
      customerPaymentRecived
        .find({ ...dateMatch, deletedAt: null })
        .sort({ createdAt: -1 })
        .populate("customer", "fullName customerId")
        .select("paymentId customer paidAmount lessAmount cashBack createdAt")
        .lean(),

      // 10. Per-payment customer advance-payment rows — net of cashback.
      customerAdvancePaymentModel
        .find({ ...dateMatch, deletedAt: null })
        .sort({ createdAt: -1 })
        .populate("customer", "fullName customerId")
        .select("paymentId customer paidAmount advanceCashBack createdAt")
        .lean(),

      // 11. Purchase returns — value coming back from suppliers, listed by the
      // return's own serial ("PURR-VR-05"). This model dates its rows on
      // `returnDate`, not `date`, so it needs its own match: the shared
      // dateMatch would never hit. Each return also writes a "cash recived"
      // refund transaction, which source 7 filters out by
      // purchaseReturnReference so the refund is not counted twice.
      purchaseReturnModel
        .find(
          start
            ? { returnDate: { $gte: start, $lte: end } }
            : {},
        )
        .sort({ createdAt: -1 })
        .populate("supplier", "supplierName")
        .select("serial supplier totalReturnAmount returnDate createdAt")
        .lean(),
    ]);

  const byType = (type) =>
    salesByTypeAgg.find((s) => s._id === type) || { amount: 0, count: 0 };

  const wholesaleSales = byType("wholesale");
  const retailSales = byType("retailsale");
  const wholesaleOrders = byType("wholesaleorder");
  const retailSalesOrders = byType("retailsaleorder");

  const cp = customerPaymentAgg[0] || {
    paidAmount: 0,
    lessAmount: 0,
    cashBack: 0,
    count: 0,
  };
  const customerPaymentNet = round2(
    (cp.paidAmount || 0) - (cp.lessAmount || 0) - (cp.cashBack || 0),
  );

  const cap = customerAdvancePaymentAgg[0] || {
    paidAmount: 0,
    cashBack: 0,
    count: 0,
  };
  const customerAdvancePaymentNet = round2((cap.paidAmount || 0) - (cap.cashBack || 0));

  const cashAccountTotal = round2(
    cashReceivedTxns.reduce((sum, t) => sum + (t.amount || 0), 0),
  );

  const purchaseReturns = purchaseReturnDocs.map((p) => ({
    serial: p.serial || "",
    supplierName: p.supplier?.supplierName || "",
    amount: round2(p.totalReturnAmount || 0),
    returnDate: p.returnDate,
    createdAt: p.createdAt,
  }));
  const purchaseReturnsTotal = round2(
    purchaseReturns.reduce((sum, p) => sum + p.amount, 0),
  );

  const sources = [
    {
      key: "wholesaleSales",
      label: "Wholesale Sales",
      amount: round2(wholesaleSales.amount),
      count: wholesaleSales.count || 0,
    },
    {
      key: "retailSales",
      label: "Retail Sales",
      amount: round2(retailSales.amount),
      count: retailSales.count || 0,
    },
    {
      key: "wholesaleOrders",
      label: "Wholesale Orders",
      amount: round2(wholesaleOrders.amount),
      count: wholesaleOrders.count || 0,
    },
    {
      key: "retailSalesOrders",
      label: "Retail Sales Orders",
      amount: round2(retailSalesOrders.amount),
      count: retailSalesOrders.count || 0,
    },
    {
      key: "customerPaymentReceived",
      label: "Customer Payment Received",
      amount: customerPaymentNet,
      count: cp.count || 0,
    },
    {
      key: "customerAdvancePayment",
      label: "Customer Advance Payment",
      amount: customerAdvancePaymentNet,
      count: cap.count || 0,
    },
    {
      key: "cashReceivedAccounts",
      label: "Cash Received (All Accounts)",
      amount: cashAccountTotal,
      count: cashReceivedTxns.length,
    },
    {
      key: "purchaseReturns",
      label: "Purchase Return",
      amount: purchaseReturnsTotal,
      count: purchaseReturns.length,
    },
  ];

  const grandTotal = round2(sources.reduce((sum, s) => sum + s.amount, 0));

  const salesInvoices = salesInvoiceDocs.map((s) => ({
    invoiceNumber: s.invoiceNumber || "",
    // Walking customers have no Customer document to populate — fall back to
    // the name typed on the sale, then to a generic label.
    customerName:
      s.customerType?.customerId?.fullName ||
      s.customerType?.walking?.customerName ||
      "",
    customerId: s.customerType?.customerId?.customerId || "",
    // Cash the shop kept. Sales written before `netPaid` existed fall back to
    // paid - changes, matching how sources 1-4 sum the same figure.
    amount: round2(
      s.netPaid ?? Math.max(0, (s.paid || 0) - (s.changes || 0)),
    ),
    total: round2(s.total || 0),
    createdAt: s.createdAt,
  }));
  const salesInvoicesTotal = round2(salesInvoices.reduce((sum, s) => sum + s.amount, 0));

  const customerDuePayments = customerDuePaymentDocs.map((p) => ({
    paymentId: p.paymentId || "",
    customerName: p.customer?.fullName || "",
    customerId: p.customer?.customerId || "",
    amount: round2((p.paidAmount || 0) - (p.lessAmount || 0) - (p.cashBack || 0)),
    createdAt: p.createdAt,
  }));
  const customerDuePaymentsTotal = round2(
    customerDuePayments.reduce((sum, p) => sum + p.amount, 0),
  );

  const customerAdvancePayments = customerAdvancePaymentDocs.map((p) => ({
    paymentId: p.paymentId || "",
    customerName: p.customer?.fullName || "",
    customerId: p.customer?.customerId || "",
    amount: round2((p.paidAmount || 0) - (p.advanceCashBack || 0)),
    createdAt: p.createdAt,
  }));
  const customerAdvancePaymentsTotal = round2(
    customerAdvancePayments.reduce((sum, p) => sum + p.amount, 0),
  );

  const payload = {
    range: key,
    sources,
    accountTransactions: cashReceivedTxns.map((t) => ({
      transactionId: t.transactionSerialId || "",
      categoryName: t.transactionCategory?.name || "",
      description: t.transactionDescription || "",
      amount: round2(t.amount || 0),
      createdAt: t.createdAt,
    })),
    salesInvoices,
    salesInvoicesTotal,
    customerDuePayments,
    customerDuePaymentsTotal,
    customerAdvancePayments,
    customerAdvancePaymentsTotal,
    purchaseReturns,
    purchaseReturnsTotal,
    breakdown: {
      customerPaymentReceived: {
        paidAmount: round2(cp.paidAmount),
        lessAmount: round2(cp.lessAmount),
        cashBack: round2(cp.cashBack),
        netAmount: customerPaymentNet,
      },
      customerAdvancePayment: {
        paidAmount: round2(cap.paidAmount),
        cashBack: round2(cap.cashBack),
        netAmount: customerAdvancePaymentNet,
      },
    },
    grandTotal,
  };

  await setCache(cacheKey, payload, CACHE_TTL);

  return apiResponse.sendSuccess(res, statusCodes.OK, "Inflow transaction summary fetched", {
    ...payload,
    fromCache: false,
  });
});

// @desc  Outflow Transaction box — actual cash outflow paid in the selected
// window, combining: purchase payments (net of less-amount and cashback —
// neither field exists on the purchase model, so this reduces to `paid`),
// supplier due payments (net of less-amount — this model has no cashback
// field), and manual cash-payment transactions logged against accounts.
// Range-filtered like every other box.
exports.getOutflowTransactionSummary = asynchandeler(async (req, res) => {
  const { start, end, key } = resolveRange(
    req.query.range,
    req.query.startDate,
    req.query.endDate,
  );

  const cacheKey = await buildCacheKey(NS, `outflow-transaction-summary:${key}`);
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(res, statusCodes.OK, "Outflow transaction summary fetched", {
      ...cached,
      fromCache: true,
    });
  }

  const dateMatch = start ? { date: { $gte: start, $lte: end } } : {};

  const [
    purchasePaymentAgg,
    supplierPaymentAgg,
    cashPaymentTxns,
    purchaseDocs,
    supplierPaymentDocs,
    salesReturnDocs,
  ] = await Promise.all([
    // 1. Purchase payments — the purchase model has no less-amount/cashback
    // fields, so net payment reduces to the `paid` field.
    purchaseModel.aggregate([
      { $match: dateMatch },
      {
        $group: {
          _id: null,
          paidAmount: { $sum: "$paid" },
          count: { $sum: 1 },
        },
      },
    ]),

    // 2. Supplier due payments — net of less amount (no cashback field on
    // this model, since suppliers don't receive cashback)
    SupplierDuePayment.aggregate([
      { $match: { ...dateMatch, deletedAt: null } },
      {
        $group: {
          _id: null,
          paidAmount: { $sum: "$paidAmount" },
          lessAmount: { $sum: "$lessAmount" },
          count: { $sum: 1 },
        },
      },
    ]),

    // 3. Manual cash-payment transactions from All Accounts (Add Transaction).
    //
    // Purchase payments, supplier payments and sales returns each write their
    // own "cash payment" transaction, and each is already counted by its own
    // source above — so counting them here too would double the same money.
    // Only rows with no originating reference are genuinely manual entries,
    // which is exactly how the Inflow box selects its own.
    crateTransactionModel
      .find({
        ...dateMatch,
        transactionType: "cash payment",
        purchaseReference: null,
        supplierPaymentReference: null,
        salesReturnReference: null,
      })
      .sort({ createdAt: -1 })
      .populate("transactionCategory", "name")
      .select("transactionSerialId transactionDescription amount transactionCategory createdAt")
      .lean(),

    // 4. Per-invoice purchase rows — drives the "Purchase Payment" list.
    purchaseModel
      .find(dateMatch)
      .sort({ createdAt: -1 })
      .populate("supplierId", "supplierName supplierId")
      .select("serial paid supplierId createdAt")
      .lean(),

    // 5. Per-payment supplier due-payment rows. supplierId here is the
    // supplier's mobile-number string (not an ObjectId), so it cannot be
    // populated — resolved via a manual lookup map below.
    SupplierDuePayment.find({ ...dateMatch, deletedAt: null })
      .sort({ createdAt: -1 })
      .select("supplierPaymentSerialId supplierId paidAmount lessAmount createdAt")
      .lean(),

    // 6. Per-return sales return rows — money refunded to customers, the
    // outflow mirror of the purchase returns in the Inflow box. Each return
    // also writes its own "cash payment" transaction, so those are filtered
    // out of source 3 to keep the same money from being counted twice.
    salesReturnModel
      .find(dateMatch)
      .sort({ createdAt: -1 })
      .populate("invoiceNumber", "invoiceNumber")
      .select("returnId invoiceNumber totalReturnAmount transaction date createdAt")
      .lean(),
  ]);

  const pp = purchasePaymentAgg[0] || { paidAmount: 0, count: 0 };
  const purchasePaymentNet = round2(pp.paidAmount || 0);

  const sp = supplierPaymentAgg[0] || { paidAmount: 0, lessAmount: 0, count: 0 };
  const supplierPaymentNet = round2((sp.paidAmount || 0) - (sp.lessAmount || 0));

  const salesReturns = salesReturnDocs.map((doc) => ({
    returnId: doc.returnId || "",
    invoiceNumber: doc.invoiceNumber?.invoiceNumber || "",
    amount: round2(doc.totalReturnAmount || 0),
    date: doc.date,
    createdAt: doc.createdAt,
  }));
  const salesReturnsTotal = round2(
    salesReturns.reduce((sum, s) => sum + s.amount, 0),
  );

  // Returns created before CrateTransaction carried salesReturnReference still
  // have a "cash payment" row that the query above could not filter out. Each
  // return points at its own transaction, so drop those ids here — otherwise an
  // old refund is counted twice.
  const salesReturnTxnIds = new Set(
    salesReturnDocs.map((doc) => String(doc.transaction || "")).filter(Boolean),
  );
  const manualCashPaymentTxns = salesReturnTxnIds.size
    ? cashPaymentTxns.filter((t) => !salesReturnTxnIds.has(String(t._id)))
    : cashPaymentTxns;

  const cashAccountTotal = round2(
    manualCashPaymentTxns.reduce((sum, t) => sum + (t.amount || 0), 0),
  );

  const sources = [
    {
      key: "purchasePayment",
      label: "Purchase Payment",
      amount: purchasePaymentNet,
      count: pp.count || 0,
    },
    {
      key: "supplierPayment",
      label: "Supplier Payment",
      amount: supplierPaymentNet,
      count: sp.count || 0,
    },
    {
      key: "salesReturns",
      label: "Sales Return",
      amount: salesReturnsTotal,
      count: salesReturns.length,
    },
    {
      key: "cashPaymentAccounts",
      label: "Cash Payment (All Accounts)",
      amount: cashAccountTotal,
      count: manualCashPaymentTxns.length,
    },
  ];

  const grandTotal = round2(sources.reduce((sum, s) => sum + s.amount, 0));

  const purchasePayments = purchaseDocs.map((doc) => ({
    invoiceNumber: doc.serial || "",
    supplierName: doc.supplierId?.supplierName || "",
    supplierId: doc.supplierId?.supplierId || "",
    amount: round2(doc.paid || 0),
    createdAt: doc.createdAt,
  }));
  const purchasePaymentsTotal = round2(
    purchasePayments.reduce((sum, p) => sum + p.amount, 0),
  );

  // supplierId on SupplierDuePayment is the supplier's mobile string, not an
  // ObjectId, so resolve names via a manual lookup instead of populate().
  const supplierMobiles = [...new Set(supplierPaymentDocs.map((d) => d.supplierId).filter(Boolean))];
  const supplierDocs = supplierMobiles.length
    ? await SupplierModel.find({ supplierId: { $in: supplierMobiles } })
        .select("supplierId supplierName")
        .lean()
    : [];
  const supplierNameByMobile = new Map(supplierDocs.map((s) => [s.supplierId, s.supplierName]));

  const supplierPayments = supplierPaymentDocs.map((doc) => ({
    paymentId: doc.supplierPaymentSerialId || "",
    supplierName: supplierNameByMobile.get(doc.supplierId) || "",
    supplierId: doc.supplierId || "",
    amount: round2((doc.paidAmount || 0) - (doc.lessAmount || 0)),
    createdAt: doc.createdAt,
  }));
  const supplierPaymentsTotal = round2(
    supplierPayments.reduce((sum, p) => sum + p.amount, 0),
  );

  const payload = {
    range: key,
    sources,
    accountTransactions: manualCashPaymentTxns.map((t) => ({
      transactionId: t.transactionSerialId || "",
      categoryName: t.transactionCategory?.name || "",
      description: t.transactionDescription || "",
      amount: round2(t.amount || 0),
      createdAt: t.createdAt,
    })),
    purchasePayments,
    purchasePaymentsTotal,
    supplierPayments,
    supplierPaymentsTotal,
    salesReturns,
    salesReturnsTotal,
    breakdown: {
      purchasePayment: {
        paidAmount: round2(pp.paidAmount),
        lessAmount: 0,
        cashBack: 0,
        netAmount: purchasePaymentNet,
      },
      supplierPayment: {
        paidAmount: round2(sp.paidAmount),
        lessAmount: round2(sp.lessAmount),
        cashBack: 0,
        netAmount: supplierPaymentNet,
      },
    },
    grandTotal,
  };

  await setCache(cacheKey, payload, CACHE_TTL);

  return apiResponse.sendSuccess(res, statusCodes.OK, "Outflow transaction summary fetched", {
    ...payload,
    fromCache: false,
  });
});

// @desc  Day Cash Summary box — today's opening balance (yesterday's closing),
// total received today, total paid today, and today's closing balance.
// Persisted per-day in DailyCashSummary so tomorrow's opening balance is a
// lookup, not a recomputation: each day's row is lazily created on first
// request, seeding its openingBalance from the most recent prior day's
// closingBalance, then kept in sync with today's live totals on every call.
exports.getDayCashSummary = asynchandeler(async (req, res) => {
  const { start: todayStart, end: todayEnd } = resolveRange("today");
  // `date` — the day the money actually moved — not `createdAt`, which is when
  // the row was typed. The Inflow and Outflow boxes range on `date`, so using
  // `createdAt` here made a backdated entry land on a different day than the
  // feed showed it on.
  const dateMatch = { date: { $gte: todayStart, $lte: todayEnd } };

  const [
    salesPaidAgg,
    customerPaymentAgg,
    customerAdvancePaymentAgg,
    cashReceivedAgg,
    purchasePaidAgg,
    supplierPaymentAgg,
    cashPaymentAgg,
    purchaseReturnAgg,
    salesReturnAgg,
  ] = await Promise.all([
    salesModel.aggregate([
      { $match: dateMatch },
      {
        $group: {
          _id: null,
          // netPaid: cash kept, change handed back excluded.
          amount: {
            $sum: {
              $ifNull: [
                "$netPaid",
                {
                  $max: [
                    0,
                    { $subtract: [{ $ifNull: ["$paid", 0] }, { $ifNull: ["$changes", 0] }] },
                  ],
                },
              ],
            },
          },
        },
      },
    ]),
    customerPaymentRecived.aggregate([
      { $match: { ...dateMatch, deletedAt: null } },
      {
        $group: {
          _id: null,
          paidAmount: { $sum: "$paidAmount" },
          lessAmount: { $sum: "$lessAmount" },
          cashBack: { $sum: "$cashBack" },
        },
      },
    ]),
    customerAdvancePaymentModel.aggregate([
      { $match: { ...dateMatch, deletedAt: null } },
      {
        $group: {
          _id: null,
          paidAmount: { $sum: "$paidAmount" },
          cashBack: { $sum: "$advanceCashBack" },
        },
      },
    ]),
    // Manual cash received only. Sales, customer payments and purchase returns
    // each write their own "cash recived" row and are counted by their own
    // source above, so counting these here too would double the same money —
    // the Inflow box filters them out the same way.
    crateTransactionModel.aggregate([
      {
        $match: {
          ...dateMatch,
          transactionType: "cash recived",
          saleReference: null,
          customerPaymentReference: null,
          customerAdvancePaymentReference: null,
          purchaseReturnReference: null,
        },
      },
      { $group: { _id: null, amount: { $sum: "$amount" } } },
    ]),
    purchaseModel.aggregate([
      { $match: dateMatch },
      { $group: { _id: null, amount: { $sum: "$paid" } } },
    ]),
    SupplierDuePayment.aggregate([
      { $match: { ...dateMatch, deletedAt: null } },
      {
        $group: {
          _id: null,
          paidAmount: { $sum: "$paidAmount" },
          lessAmount: { $sum: "$lessAmount" },
        },
      },
    ]),
    // Manual cash payments only — same reasoning as the receive side: purchase
    // payments, supplier payments and sales returns are already counted by
    // their own source, exactly as the Outflow box filters them.
    crateTransactionModel.aggregate([
      {
        $match: {
          ...dateMatch,
          transactionType: "cash payment",
          purchaseReference: null,
          supplierPaymentReference: null,
          salesReturnReference: null,
        },
      },
      { $group: { _id: null, amount: { $sum: "$amount" } } },
    ]),

    // Purchase returns — money back from suppliers, counted by the Inflow box.
    // This model dates its rows on `returnDate`, not `createdAt`.
    purchaseReturnModel.aggregate([
      { $match: { returnDate: { $gte: todayStart, $lte: todayEnd } } },
      { $group: { _id: null, amount: { $sum: "$totalReturnAmount" } } },
    ]),

    // Sales returns — money refunded to customers, counted by the Outflow box.
    salesReturnModel.aggregate([
      { $match: { date: { $gte: todayStart, $lte: todayEnd } } },
      { $group: { _id: null, amount: { $sum: "$totalReturnAmount" } } },
    ]),
  ]);

  const cp = customerPaymentAgg[0] || { paidAmount: 0, lessAmount: 0, cashBack: 0 };
  const cap = customerAdvancePaymentAgg[0] || { paidAmount: 0, cashBack: 0 };
  const sp = supplierPaymentAgg[0] || { paidAmount: 0, lessAmount: 0 };

  // These two must equal the Inflow and Outflow boxes' grand totals for the
  // same day: same sources, same de-duplication. A source added to one of those
  // boxes has to be added here too, or the day's cash disagrees with the feed
  // the operator is looking at right above it.
  const totalReceive = round2(
    (salesPaidAgg[0]?.amount || 0) +
      ((cp.paidAmount || 0) - (cp.lessAmount || 0) - (cp.cashBack || 0)) +
      ((cap.paidAmount || 0) - (cap.cashBack || 0)) +
      (cashReceivedAgg[0]?.amount || 0) +
      (purchaseReturnAgg[0]?.amount || 0),
  );

  const totalPayment = round2(
    (purchasePaidAgg[0]?.amount || 0) +
      ((sp.paidAmount || 0) - (sp.lessAmount || 0)) +
      (cashPaymentAgg[0]?.amount || 0) +
      (salesReturnAgg[0]?.amount || 0),
  );

  // Seed today's opening balance from the most recent prior day's closing
  // balance the first time today's row is requested; leave it untouched on
  // every later call so backfilled/edited transactions don't retroactively
  // shift an already-fixed opening balance.
  let today = await DailyCashSummary.findOne({ date: todayStart });
  if (!today) {
    const previous = await DailyCashSummary.findOne({ date: { $lt: todayStart } }).sort({
      date: -1,
    });
    today = await DailyCashSummary.create({
      date: todayStart,
      openingBalance: previous?.closingBalance || 0,
      totalReceive,
      totalPayment,
      closingBalance: round2((previous?.closingBalance || 0) + totalReceive - totalPayment),
    });
  } else {
    today.totalReceive = totalReceive;
    today.totalPayment = totalPayment;
    today.closingBalance = round2(today.openingBalance + totalReceive - totalPayment);
    await today.save();
  }

  return apiResponse.sendSuccess(res, statusCodes.OK, "Day cash summary fetched", {
    date: todayStart,
    openingBalance: round2(today.openingBalance),
    totalReceive,
    totalPayment,
    closingBalance: today.closingBalance,
  });
});

// @desc  Accounts Balance widget — every account's live balance + grand total.
// Not cached: every transaction (sales, purchase, supplier/customer payments,
// manual transactions) mutates Account.balance directly, so this must always
// read live rather than risk showing a stale figure.
exports.getAccountsBalanceSummary = asynchandeler(async (req, res) => {
  const accounts = await Account.find({})
    .select("name slug balance isActive")
    .sort({ name: 1 })
    .lean();

  const totalBalance = round2(
    accounts.reduce((sum, a) => sum + Number(a.balance || 0), 0),
  );

  return apiResponse.sendSuccess(res, statusCodes.OK, "Accounts balance summary fetched", {
    accounts: accounts.map((a) => ({
      _id: a._id,
      name: a.name,
      slug: a.slug,
      isActive: a.isActive,
      balance: round2(a.balance || 0),
    })),
    totalBalance,
  });
});

// @desc  Inventory Items box — live stock across products + variants, and
// range-bound stock-out (total quantity sold via sales in the selected window)
exports.getInventorySummary = asynchandeler(async (req, res) => {
  const { start, end, key } = resolveRange(
    req.query.range,
    req.query.startDate,
    req.query.endDate,
  );

  const cacheKey = await buildCacheKey(NS, `inventory-summary:${key}`);
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(res, statusCodes.OK, "Inventory summary fetched", {
      ...cached,
      fromCache: true,
    });
  }

  const dateMatch = start ? { createdAt: { $gte: start, $lte: end } } : {};

  const [
    productAgg,
    variantAgg,
    stockOutAgg,
    productInitialAgg,
    variantInitialAgg,
    purchaseQtyAgg,
    stockAdjustAddAgg,
  ] = await Promise.all([
    productModel.aggregate([
      { $group: { _id: null, stock: { $sum: "$stock" } } },
    ]),
    variantModel.aggregate([
      { $group: { _id: null, stock: { $sum: "$stockVariant" } } },
    ]),

    // Stock out — total quantity actually sold (excludes return/exchange lines)
    salesModel.aggregate([
      { $match: dateMatch },
      { $unwind: "$searchItem" },
      { $match: { "searchItem.salesStatus": "sale" } },
      {
        $group: {
          _id: null,
          quantity: { $sum: "$searchItem.quantity" },
        },
      },
    ]),

    // Cumulative entry counter (never decreases) — how many units have ever
    // been entered into the system across product/variant creation, purchase,
    // and stock-adjust "add" operations.
    productModel.aggregate([
      { $group: { _id: null, qty: { $sum: "$initialStock" } } },
    ]),
    variantModel.aggregate([
      { $group: { _id: null, qty: { $sum: "$initialStock" } } },
    ]),
    purchaseModel.aggregate([
      { $unwind: "$allproduct" },
      { $group: { _id: null, qty: { $sum: "$allproduct.quantity" } } },
    ]),
    stockAdjustModel.aggregate([
      { $group: { _id: null, qty: { $sum: "$increaseQuantity" } } },
    ]),
  ]);

  const p = productAgg[0] || { stock: 0 };
  const v = variantAgg[0] || { stock: 0 };

  const totalStock = (p.stock || 0) + (v.stock || 0);
  const stockOut = stockOutAgg[0]?.quantity || 0;

  // Total ever entered = initial stock at creation + every purchase + every
  // manual "add" adjustment. Sales/returns/stock-out never subtract from this.
  const totalEntered =
    (productInitialAgg[0]?.qty || 0) +
    (variantInitialAgg[0]?.qty || 0) +
    (purchaseQtyAgg[0]?.qty || 0) +
    (stockAdjustAddAgg[0]?.qty || 0);

  const payload = {
    range: key,
    inventory: {
      totalStock: totalEntered,
      inStock: totalStock,
      stockOut,
      balance: totalStock - stockOut,
    },
  };

  await setCache(cacheKey, payload, CACHE_TTL);

  return apiResponse.sendSuccess(res, statusCodes.OK, "Inventory summary fetched", {
    ...payload,
    fromCache: false,
  });
});

// @desc  Customer box — customer count and outstanding due balance, range-filtered
exports.getCustomerSummary = asynchandeler(async (req, res) => {
  const { start, end, key } = resolveRange(req.query.range);

  const cacheKey = await buildCacheKey(NS, `customer-summary:${key}`);
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(res, statusCodes.OK, "Customer summary fetched", {
      ...cached,
      fromCache: true,
    });
  }

  // Total customer count and outstanding due are live snapshots — not
  // bound to the selected range, the same way "Total Stock" isn't. A
  // customer created outside the window still counts; range-scoping this
  // count was making it read 0 whenever the only customer predates the
  // selected window.
  const [customerCount, duesAgg] = await Promise.all([
    customerModel.countDocuments({}),

    // Listed customers only. A walking customer has no account to owe against —
    // their unpaid amount is written off at the counter, not carried as a
    // receivable — so counting it here overstated what the shop can collect.
    salesModel.aggregate([
      { $match: { "customerType.type": "listed" } },
      { $group: { _id: null, totalDue: { $sum: "$presentDue" } } },
    ]),
  ]);

  const payload = {
    range: key,
    customer: {
      totalCustomer: customerCount || 0,
      totalDue: Math.round(duesAgg[0]?.totalDue || 0),
    },
  };

  await setCache(cacheKey, payload, CACHE_TTL);

  return apiResponse.sendSuccess(res, statusCodes.OK, "Customer summary fetched", {
    ...payload,
    fromCache: false,
  });
});

// @desc  Supplier box — supplier count and outstanding due balance, range-filtered
exports.getSupplierSummary = asynchandeler(async (req, res) => {
  const { start, end, key } = resolveRange(
    req.query.range,
    req.query.startDate,
    req.query.endDate,
  );

  const cacheKey = await buildCacheKey(NS, `supplier-summary:${key}`);
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(res, statusCodes.OK, "Supplier summary fetched", {
      ...cached,
      fromCache: true,
    });
  }

  const dateMatch = start ? { createdAt: { $gte: start, $lte: end } } : {};

  const [supplierCount, duesAgg] = await Promise.all([
    SupplierModel.countDocuments({ ...dateMatch, deletedAt: null }),

    SupplierModel.aggregate([
      { $match: { ...dateMatch, deletedAt: null } },
      {
        $group: {
          _id: null,
          totalDue: {
            $sum: {
              $add: [
                { $ifNull: ["$openingDues", 0] },
                { $ifNull: ["$totalPurchaseDue", 0] },
              ],
            },
          },
        },
      },
    ]),
  ]);

  const payload = {
    range: key,
    supplier: {
      totalSupplier: supplierCount || 0,
      totalDue: Math.round(duesAgg[0]?.totalDue || 0),
    },
  };

  await setCache(cacheKey, payload, CACHE_TTL);

  return apiResponse.sendSuccess(res, statusCodes.OK, "Supplier summary fetched", {
    ...payload,
    fromCache: false,
  });
});

// @desc  Employee box — employee count and advance payment total, range-filtered
exports.getEmployeeSummary = asynchandeler(async (req, res) => {
  const { start, end, key } = resolveRange(
    req.query.range,
    req.query.startDate,
    req.query.endDate,
  );

  const cacheKey = await buildCacheKey(NS, `employee-summary:${key}`);
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(res, statusCodes.OK, "Employee summary fetched", {
      ...cached,
      fromCache: true,
    });
  }

  const dateMatch = start ? { createdAt: { $gte: start, $lte: end } } : {};

  const [employeeCount, advanceAgg] = await Promise.all([
    employeeModel.countDocuments(dateMatch),

    employeeAdvancePayment.aggregate([
      { $match: { ...dateMatch, isActive: true } },
      { $group: { _id: null, amount: { $sum: "$amount" } } },
    ]),
  ]);

  const payload = {
    range: key,
    employee: {
      totalEmployee: employeeCount || 0,
      advancePayment: Math.round(advanceAgg[0]?.amount || 0),
    },
  };

  await setCache(cacheKey, payload, CACHE_TTL);

  return apiResponse.sendSuccess(res, statusCodes.OK, "Employee summary fetched", {
    ...payload,
    fromCache: false,
  });
});

// @desc  Purchase Items box — total quantity, purchase value, and invoice
// count (one purchase document = one invoice), range-filtered
exports.getPurchaseSummary = asynchandeler(async (req, res) => {
  const { start, end, key } = resolveRange(
    req.query.range,
    req.query.startDate,
    req.query.endDate,
  );

  const cacheKey = await buildCacheKey(NS, `purchase-summary:${key}`);
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(res, statusCodes.OK, "Purchase summary fetched", {
      ...cached,
      fromCache: true,
    });
  }

  const dateMatch = start ? { date: { $gte: start, $lte: end } } : {};

  const [invoiceCount, itemsAgg, paymentAgg] = await Promise.all([
    purchaseModel.countDocuments(dateMatch),

    purchaseModel.aggregate([
      { $match: dateMatch },
      { $unwind: "$allproduct" },
      {
        $group: {
          _id: null,
          quantity: { $sum: "$allproduct.quantity" },
          value: {
            $sum: {
              $multiply: ["$allproduct.purchasePrice", "$allproduct.quantity"],
            },
          },
        },
      },
    ]),

    // Document-level payable/paid — one row per purchase, not per line item,
    // so this is a separate (unwind-free) aggregate from itemsAgg above.
    purchaseModel.aggregate([
      { $match: dateMatch },
      {
        $group: {
          _id: null,
          payable: { $sum: "$payable" },
          paid: { $sum: "$paid" },
        },
      },
    ]),
  ]);

  const payload = {
    range: key,
    purchase: {
      invoiceCount: invoiceCount || 0,
      quantity: itemsAgg[0]?.quantity || 0,
      value: Math.round(itemsAgg[0]?.value || 0),
      payable: Math.round(paymentAgg[0]?.payable || 0),
      paid: Math.round(paymentAgg[0]?.paid || 0),
    },
  };

  await setCache(cacheKey, payload, CACHE_TTL);

  return apiResponse.sendSuccess(res, statusCodes.OK, "Purchase summary fetched", {
    ...payload,
    fromCache: false,
  });
});

// @desc  Sold Items box — total quantity sold, sales invoice count, and the
// net sales amount (after item AND invoice discounts), in total and split by
// wholesale vs retail, range-filtered
exports.getSoldItemsSummary = asynchandeler(async (req, res) => {
  const { start, end, key } = resolveRange(
    req.query.range,
    req.query.startDate,
    req.query.endDate,
  );

  // v2: amounts became net of invoice discount; old cached payloads lack totalAmount.
  const cacheKey = await buildCacheKey(NS, `sold-items-summary:v2:${key}`);
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(res, statusCodes.OK, "Sold items summary fetched", {
      ...cached,
      fromCache: true,
    });
  }

  const dateMatch = start ? { date: { $gte: start, $lte: end } } : {};

  const [invoiceCount, quantityAgg, amountBySalesType] = await Promise.all([
    salesModel.countDocuments(dateMatch),

    salesModel.aggregate([
      { $match: dateMatch },
      { $unwind: "$searchItem" },
      { $match: { "searchItem.salesStatus": "sale" } },
      { $group: { _id: null, quantity: { $sum: "$searchItem.quantity" } } },
    ]),

    // Net sales per invoice, grouped wholesale (wholesale/wholesaleorder) vs
    // retail (retailsale/retailsaleorder). searchItem.subtotal already carries
    // the item discount; on top of that the invoice discountPercent and
    // lessTaka are taken off, the same way the sale forms build payable.
    // lessTaka is spread over all lines, so only the sale lines' share of it
    // counts here. VAT, delivery and labour are not sales price and stay out.
    salesModel.aggregate([
      { $match: dateMatch },
      {
        $project: {
          salesType: 1,
          saleSubtotal: {
            $reduce: {
              input: { $ifNull: ["$searchItem", []] },
              initialValue: 0,
              in: {
                $add: [
                  "$$value",
                  {
                    $cond: [
                      { $eq: [{ $ifNull: ["$$this.salesStatus", "sale"] }, "sale"] },
                      { $ifNull: ["$$this.subtotal", 0] },
                      0,
                    ],
                  },
                ],
              },
            },
          },
          allSubtotal: {
            $reduce: {
              input: { $ifNull: ["$searchItem", []] },
              initialValue: 0,
              in: { $add: ["$$value", { $ifNull: ["$$this.subtotal", 0] }] },
            },
          },
          discountPercent: { $ifNull: ["$discountPercent", 0] },
          lessTaka: { $ifNull: ["$lessTaka", 0] },
        },
      },
      {
        $project: {
          salesType: 1,
          net: {
            $max: [
              0,
              {
                $subtract: [
                  {
                    $multiply: [
                      "$saleSubtotal",
                      { $subtract: [1, { $divide: ["$discountPercent", 100] }] },
                    ],
                  },
                  {
                    $cond: [
                      { $gt: ["$allSubtotal", 0] },
                      {
                        $multiply: [
                          "$lessTaka",
                          { $divide: ["$saleSubtotal", "$allSubtotal"] },
                        ],
                      },
                      0,
                    ],
                  },
                ],
              },
            ],
          },
        },
      },
      {
        $group: {
          _id: {
            $cond: [
              { $in: ["$salesType", ["wholesale", "wholesaleorder"]] },
              "wholesale",
              "retail",
            ],
          },
          amount: { $sum: "$net" },
        },
      },
    ]),
  ]);

  const wholesaleAmount =
    amountBySalesType.find((r) => r._id === "wholesale")?.amount || 0;
  const retailAmount =
    amountBySalesType.find((r) => r._id === "retail")?.amount || 0;

  const payload = {
    range: key,
    soldItems: {
      invoiceCount: invoiceCount || 0,
      quantity: quantityAgg[0]?.quantity || 0,
      totalAmount: Math.round(wholesaleAmount + retailAmount),
      wholesaleAmount: Math.round(wholesaleAmount),
      retailAmount: Math.round(retailAmount),
    },
  };

  await setCache(cacheKey, payload, CACHE_TTL);

  return apiResponse.sendSuccess(res, statusCodes.OK, "Sold items summary fetched", {
    ...payload,
    fromCache: false,
  });
});

// @desc  Inventory Value box — live stock units and retail/wholesale
// valuation across products + variants. Stock is a current snapshot, not
// range-bound — the range param is accepted for API consistency but does
// not affect these numbers.
exports.getInventoryValueSummary = asynchandeler(async (req, res) => {
  const { key } = resolveRange(req.query.range);

  const cacheKey = await buildCacheKey(NS, `inventory-value-summary:${key}`);
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(res, statusCodes.OK, "Inventory value summary fetched", {
      ...cached,
      fromCache: true,
    });
  }

  const [productAgg, variantAgg] = await Promise.all([
    productModel.aggregate([
      {
        $group: {
          _id: null,
          units: { $sum: "$stock" },
          retailValue: {
            $sum: { $multiply: ["$stock", { $ifNull: ["$retailPrice", 0] }] },
          },
          wholesaleValue: {
            $sum: {
              $multiply: ["$stock", { $ifNull: ["$wholesalePrice", 0] }],
            },
          },
        },
      },
    ]),
    variantModel.aggregate([
      {
        $group: {
          _id: null,
          units: { $sum: "$stockVariant" },
          retailValue: {
            $sum: {
              $multiply: ["$stockVariant", { $ifNull: ["$retailPrice", 0] }],
            },
          },
          wholesaleValue: {
            $sum: {
              $multiply: [
                "$stockVariant",
                { $ifNull: ["$wholesalePrice", 0] },
              ],
            },
          },
        },
      },
    ]),
  ]);

  const p = productAgg[0] || { units: 0, retailValue: 0, wholesaleValue: 0 };
  const v = variantAgg[0] || { units: 0, retailValue: 0, wholesaleValue: 0 };

  const payload = {
    range: key,
    inventoryValue: {
      units: (p.units || 0) + (v.units || 0),
      retailValue: Math.round((p.retailValue || 0) + (v.retailValue || 0)),
      wholesaleValue: Math.round(
        (p.wholesaleValue || 0) + (v.wholesaleValue || 0),
      ),
    },
  };

  await setCache(cacheKey, payload, CACHE_TTL);

  return apiResponse.sendSuccess(res, statusCodes.OK, "Inventory value summary fetched", {
    ...payload,
    fromCache: false,
  });
});

// @desc  Stock Cost Value box — live stock valued at purchase price across
// products + variants. Stock is a current snapshot, not range-bound — the
// range param is accepted for API consistency but does not affect this number.
exports.getStockCostSummary = asynchandeler(async (req, res) => {
  const { key } = resolveRange(req.query.range);

  const cacheKey = await buildCacheKey(NS, `stock-cost-summary:${key}`);
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(res, statusCodes.OK, "Stock cost summary fetched", {
      ...cached,
      fromCache: true,
    });
  }

  const [productAgg, variantAgg] = await Promise.all([
    productModel.aggregate([
      {
        $group: {
          _id: null,
          costValue: {
            $sum: { $multiply: ["$stock", { $ifNull: ["$purchasePrice", 0] }] },
          },
        },
      },
    ]),
    variantModel.aggregate([
      {
        $group: {
          _id: null,
          costValue: {
            $sum: {
              $multiply: ["$stockVariant", { $ifNull: ["$purchasePrice", 0] }],
            },
          },
        },
      },
    ]),
  ]);

  const p = productAgg[0] || { costValue: 0 };
  const v = variantAgg[0] || { costValue: 0 };

  const payload = {
    range: key,
    stockCost: {
      costValue: round2((p.costValue || 0) + (v.costValue || 0)),
    },
  };

  await setCache(cacheKey, payload, CACHE_TTL);

  return apiResponse.sendSuccess(res, statusCodes.OK, "Stock cost summary fetched", {
    ...payload,
    fromCache: false,
  });
});

// @desc  Total Products box — live stock sum across products + variants, and
// active/inactive document counts. Live snapshot, not range-bound — the
// range param is accepted for API consistency but does not affect these numbers.
exports.getProductStatusSummary = asynchandeler(async (req, res) => {
  const { key } = resolveRange(req.query.range);

  const cacheKey = await buildCacheKey(NS, `product-status-summary:${key}`);
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(res, statusCodes.OK, "Product status summary fetched", {
      ...cached,
      fromCache: true,
    });
  }

  const [productStockAgg, variantStockAgg, productActiveInactive, variantActiveInactive] =
    await Promise.all([
      productModel.aggregate([
        { $group: { _id: null, stock: { $sum: "$stock" } } },
      ]),
      variantModel.aggregate([
        { $group: { _id: null, stock: { $sum: "$stockVariant" } } },
      ]),
      productModel.aggregate([
        { $group: { _id: "$isActive", count: { $sum: 1 } } },
      ]),
      variantModel.aggregate([
        { $group: { _id: "$isActive", count: { $sum: 1 } } },
      ]),
    ]);

  const stockSum =
    (productStockAgg[0]?.stock || 0) + (variantStockAgg[0]?.stock || 0);

  const p = { active: 0, inactive: 0 };
  productActiveInactive.forEach((r) => {
    if (r._id === true) p.active += r.count;
    else p.inactive += r.count;
  });
  const v = { active: 0, inactive: 0 };
  variantActiveInactive.forEach((r) => {
    if (r._id === true) v.active += r.count;
    else v.inactive += r.count;
  });

  const payload = {
    range: key,
    productStatus: {
      totalStock: stockSum,
      active: p.active + v.active,
      inactive: p.inactive + v.inactive,
    },
  };

  await setCache(cacheKey, payload, CACHE_TTL);

  return apiResponse.sendSuccess(res, statusCodes.OK, "Product status summary fetched", {
    ...payload,
    fromCache: false,
  });
});

// @desc  Supplier Payment box — paid minus less amount, and payment invoice
// count, range-filtered
exports.getSupplierPaymentSummary = asynchandeler(async (req, res) => {
  const { start, end, key } = resolveRange(
    req.query.range,
    req.query.startDate,
    req.query.endDate,
  );

  const cacheKey = await buildCacheKey(NS, `supplier-payment-summary:${key}`);
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(res, statusCodes.OK, "Supplier payment summary fetched", {
      ...cached,
      fromCache: true,
    });
  }

  const dateMatch = start ? { date: { $gte: start, $lte: end } } : {};

  const [invoiceCount, paymentAgg] = await Promise.all([
    SupplierDuePayment.countDocuments({ ...dateMatch, deletedAt: null }),

    SupplierDuePayment.aggregate([
      { $match: { ...dateMatch, deletedAt: null } },
      {
        $group: {
          _id: null,
          paid: { $sum: "$paidAmount" },
          less: { $sum: "$lessAmount" },
        },
      },
    ]),
  ]);

  const paid = paymentAgg[0]?.paid || 0;
  const less = paymentAgg[0]?.less || 0;

  const payload = {
    range: key,
    supplierPayment: {
      invoiceCount: invoiceCount || 0,
      paid: round2(paid),
      less: round2(less),
      amount: round2(paid - less),
    },
  };

  await setCache(cacheKey, payload, CACHE_TTL);

  return apiResponse.sendSuccess(res, statusCodes.OK, "Supplier payment summary fetched", {
    ...payload,
    fromCache: false,
  });
});

// @desc  Customer Due Payment box — payment received amount/count, and count
// of distinct listed customers with an outstanding due, range-filtered
exports.getCustomerDuePaymentSummary = asynchandeler(async (req, res) => {
  const { start, end, key } = resolveRange(
    req.query.range,
    req.query.startDate,
    req.query.endDate,
  );

  const cacheKey = await buildCacheKey(NS, `customer-due-payment-summary:${key}`);
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(res, statusCodes.OK, "Customer due payment summary fetched", {
      ...cached,
      fromCache: true,
    });
  }

  // Filtered on the payment's own `date` field (the transaction date set on
  // /customer-payment-receive), not `createdAt` — matches the amount and
  // count shown to what was actually recorded for the selected range.
  const dateMatch = start ? { date: { $gte: start, $lte: end } } : {};

  const [paymentAgg] = await Promise.all([
    customerPaymentRecived.aggregate([
      { $match: { ...dateMatch, deletedAt: null } },
      {
        $group: {
          _id: null,
          paid: { $sum: "$paidAmount" },
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const paid = paymentAgg[0]?.paid || 0;
  const count = paymentAgg[0]?.count || 0;

  const payload = {
    range: key,
    customerDuePayment: {
      amount: round2(paid),
      count,
    },
  };

  await setCache(cacheKey, payload, CACHE_TTL);

  return apiResponse.sendSuccess(res, statusCodes.OK, "Customer due payment summary fetched", {
    ...payload,
    fromCache: false,
  });
});

// Windows the Top Selling Products box offers, in months of 30 days each.
const TOP_SELLING_MONTHS = [1, 2, 3];

// @desc  Top Selling Products box — best sellers by quantity over the last
// 1, 2 or 3 months (?months=, rolling 30-day months, default 1). It has its own
// window and ignores the dashboard's range. Each variant is its own row; a
// single-variant product is one row.
exports.getTopSellingProducts = asynchandeler(async (req, res) => {
  const requested = Number(req.query.months);
  const months = TOP_SELLING_MONTHS.includes(requested) ? requested : 1;

  const cacheKey = await buildCacheKey(NS, `top-selling-products:${months}m`);
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(res, statusCodes.OK, "Top selling products fetched", {
      ...cached,
      fromCache: true,
    });
  }

  const end = new Date();
  const start = new Date(end.getTime() - months * 30 * 24 * 60 * 60 * 1000);

  const rows = await salesModel.aggregate([
    { $match: { createdAt: { $gte: start, $lte: end } } },
    { $unwind: "$searchItem" },
    {
      $group: {
        // A line without a product reference falls back to its own description.
        _id: {
          $ifNull: [
            "$searchItem.variantId",
            { $ifNull: ["$searchItem.productId", "$searchItem.productDescription"] },
          ],
        },
        productId: { $first: "$searchItem.productId" },
        variantId: { $first: "$searchItem.variantId" },
        description: { $first: "$searchItem.productDescription" },
        size: { $first: "$searchItem.size" },
        color: { $first: "$searchItem.color" },
        quantity: { $sum: "$searchItem.quantity" },
        revenue: { $sum: "$searchItem.subtotal" },
      },
    },
    { $sort: { quantity: -1 } },
    { $limit: 7 },
    {
      $lookup: {
        from: "products",
        localField: "productId",
        foreignField: "_id",
        as: "product",
        pipeline: [{ $project: { name: 1 } }],
      },
    },
    {
      $lookup: {
        from: "variants",
        localField: "variantId",
        foreignField: "_id",
        as: "variant",
        pipeline: [{ $project: { variantName: 1, size: 1, color: 1 } }],
      },
    },
  ]);

  // "N/A" is the schema placeholder for an unset size/color.
  const attr = (v) => (v && v !== "N/A" ? String(v) : "");
  const rowName = (r) => {
    const productName = r.product?.[0]?.name;
    if (!productName) return r.description || "Unnamed";
    if (!r.variantId) return productName;
    const v = r.variant?.[0] || {};
    const label =
      attr(v.variantName) ||
      [attr(v.size) || attr(r.size), attr(v.color) || attr(r.color)].filter(Boolean).join(" · ");
    return label ? `${productName} · ${label}` : productName;
  };

  const payload = {
    months,
    topProducts: rows.map((r) => ({
      name: rowName(r),
      quantity: r.quantity || 0,
      revenue: Math.round(r.revenue || 0),
    })),
  };

  await setCache(cacheKey, payload, CACHE_TTL);

  return apiResponse.sendSuccess(res, statusCodes.OK, "Top selling products fetched", {
    ...payload,
    fromCache: false,
  });
});
