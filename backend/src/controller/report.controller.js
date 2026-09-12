const mongoose = require("mongoose");
const { asynchandeler } = require("../lib/asyncHandeler");
const { customError } = require("../lib/CustomError");
const { apiResponse } = require("../utils/apiResponse");
const { statusCodes } = require("../constant/constant");
const Purchase = require("../models/purchase.model");
const PurchaseReturn = require("../models/purchaseReturn.model");
const Sales = require("../models/sales.model");
const SalesReturn = require("../models/salesReturn.model");
const { customerModel: Customer } = require("../models/customer.model");
const Employee = require("../models/employee.model");
const Supplier = require("../models/supplier.model").SupplierModel;
const StoreInformation = require("../models/storeInformation.model");
const Product = require("../models/product.model");
const { getCache, setCache, buildCacheKey } = require("@/utils/cache.util");

// Shares invalidation with purchase.controller.js (bumpNsVersion("purchase")
// already runs on create/update/delete there) and storeInformation.controller.js
// (bumpNsVersion("storeinformation") on save) — no extra invalidation wiring needed.
const PURCHASE_NS = "purchase";
const SALES_NS = "sales";
const STORE_NS = "storeinformation";
const PRODUCT_NS = "product";
const REPORT_CACHE_TTL = 60 * 5; // 5 minutes
const STORE_CACHE_TTL = 60 * 60; // 1 hour

async function getStoreHeader() {
  const cacheKey = await buildCacheKey(STORE_NS, "report-header");
  const cached = await getCache(cacheKey);
  if (cached) return cached;

  const store = await StoreInformation.findOne()
    .select("storeName phone secondaryPhone email adress image")
    .lean();

  const header = store
    ? {
        storeName: store.storeName,
        phone: store.phone,
        secondaryPhone: store.secondaryPhone || "",
        email: store.email || "",
        address: store.adress,
        logo: store.image?.url || "",
      }
    : null;

  await setCache(cacheKey, header, STORE_CACHE_TTL);
  return header;
}

// $lookup + $unwind stage pair shared by every purchase-based report that needs
// the supplier's display name (Purchase only stores supplierId).
function supplierLookupStages() {
  return [
    {
      $lookup: {
        from: "suppliers",
        localField: "supplierId",
        foreignField: "_id",
        as: "supplier",
        pipeline: [{ $project: { supplierName: 1 } }],
      },
    },
    { $unwind: { path: "$supplier", preserveNullAndEmptyArrays: true } },
  ];
}

// Free-text supplier-name search runs after the lookup (it's matching the joined
// field), so it can only be added once. Returns [] when no search term is given.
function supplierNameFilterStage(supplierName) {
  if (!supplierName || supplierName.trim() === "") return [];
  return [
    {
      $match: {
        "supplier.supplierName": { $regex: supplierName.trim(), $options: "i" },
      },
    },
  ];
}

// Category/subCategory/brand live on the Product, which a purchase-return line
// reaches either directly or through its variant's parent product. Both paths
// are resolved into lineCategory/lineSubCategory/lineBrand before this runs, so
// the filter matches whichever one the line used.
function returnClassificationFilterStages({ category, subCategory, brand }) {
  const match = {};
  const add = (field, value, label) => {
    if (!value) return;
    if (!mongoose.Types.ObjectId.isValid(value)) {
      throw new customError(`Invalid ${label}`, statusCodes.BAD_REQUEST);
    }
    match[field] = new mongoose.Types.ObjectId(value);
  };
  add("lineCategory", category, "category");
  add("lineSubCategory", subCategory, "subCategory");
  add("lineBrand", brand, "brand");
  return Object.keys(match).length > 0 ? [{ $match: match }] : [];
}

// Product filter matches a purchase line item, so it can only run after the
// allproduct $unwind. Returns [] when no product is selected.
function productLineFilterStage(productId) {
  if (!productId) return [];
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    throw new customError("Invalid productId", statusCodes.BAD_REQUEST);
  }
  return [{ $match: { "allproduct.product": new mongoose.Types.ObjectId(productId) } }];
}

function parsePagination(req) {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
  return { page, limit, skip: (page - 1) * limit };
}

function paginationMeta(total, page, limit, skip) {
  return {
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    hasNextPage: skip + limit < total,
  };
}

function castObjectIdFilter(match, field, value) {
  if (!value) return;
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new customError(`Invalid ${field}`, statusCodes.BAD_REQUEST);
  }
  match[field] = new mongoose.Types.ObjectId(value);
}

// @desc Purchase invoice report — one row per purchase invoice, date range +
// optional supplier / payment-status filter, paginated. Mirrors the sales
// invoice report's payload shape so both reports share one frontend layout.
exports.getPurchaseInvoiceReport = asynchandeler(async (req, res) => {
  const { startDate, endDate, supplierId, supplierName, paymentStatus } = req.body || {};
  const { page, limit, skip } = parsePagination(req);

  if (!startDate || !endDate) {
    throw new customError("startDate and endDate are required", statusCodes.BAD_REQUEST);
  }

  const match = { date: { $gte: new Date(startDate), $lte: new Date(endDate) } };
  castObjectIdFilter(match, "supplierId", supplierId);

  // Purchase has no stored payment status — derive it from paid vs payable.
  const status = (paymentStatus || "").trim();
  const statusStages = [];
  if (status === "paid") {
    statusStages.push({ $match: { $expr: { $lte: ["$dueamount", 0] } } });
  } else if (status === "due") {
    statusStages.push({ $match: { $expr: { $lte: ["$paid", 0] } } });
  } else if (status === "partial") {
    statusStages.push({
      $match: { $expr: { $and: [{ $gt: ["$paid", 0] }, { $gt: ["$dueamount", 0] }] } },
    });
  }

  const cacheKey = await buildCacheKey(
    PURCHASE_NS,
    `report:purchase-invoice:${startDate}:${endDate}:${supplierId || "all"}:${(supplierName || "").trim().toLowerCase()}:${status || "all"}:p${page}:l${limit}`,
  );
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Purchase invoice report fetched successfully",
      { ...cached, fromCache: true },
    );
  }

  // Single indexed $match narrows the working set before the supplier lookup,
  // then one $facet pass produces the page rows + full-range totals together
  // — no per-line-item unwind/lookup since this report is invoice-level only.
  const pipeline = [
    { $match: match },
    ...supplierLookupStages(),
    ...supplierNameFilterStage(supplierName),
    ...statusStages,
    {
      $facet: {
        rows: [
          { $sort: { date: -1 } },
          { $skip: skip },
          { $limit: limit },
          {
            $project: {
              _id: 1,
              date: 1,
              purchaseId: "$serial",
              supplierInvoice: "$invoiceNumber",
              supplierName: { $ifNull: ["$supplier.supplierName", "-"] },
              total: "$subTotal",
              // The purchase form's "commission" field is what the report shows
              // as Discount; shipping is what it shows as Delivery.
              discount: "$commission",
              delivery: "$shipping",
              payable: 1,
              paid: 1,
              due: "$dueamount",
              paymentStatus: {
                $switch: {
                  branches: [
                    { case: { $lte: ["$dueamount", 0] }, then: "paid" },
                    { case: { $lte: ["$paid", 0] }, then: "due" },
                  ],
                  default: "partial",
                },
              },
            },
          },
        ],
        totals: [
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              totalAmount: { $sum: "$subTotal" },
              totalDiscount: { $sum: "$commission" },
              totalDelivery: { $sum: "$shipping" },
              totalPayable: { $sum: "$payable" },
              totalPaid: { $sum: "$paid" },
              totalDue: { $sum: "$dueamount" },
            },
          },
        ],
      },
    },
  ];

  const [result] = await Purchase.aggregate(pipeline);
  const rows = result?.rows || [];
  const totals = result?.totals?.[0] || {
    count: 0,
    totalAmount: 0,
    totalDiscount: 0,
    totalDelivery: 0,
    totalPayable: 0,
    totalPaid: 0,
    totalDue: 0,
  };

  const header = await getStoreHeader();

  const payload = {
    header,
    filters: {
      startDate,
      endDate,
      supplierId: supplierId || null,
      supplier: supplierName?.trim() || (supplierId ? "Selected supplier" : "ALL"),
      paymentStatus: status || "ALL",
    },
    rows,
    totals: {
      count: totals.count,
      totalAmount: totals.totalAmount,
      totalDiscount: totals.totalDiscount,
      totalDelivery: totals.totalDelivery,
      totalPayable: totals.totalPayable,
      totalPaid: totals.totalPaid,
      totalDue: totals.totalDue,
    },
    pagination: paginationMeta(totals.count, page, limit, skip),
    generatedAt: new Date(),
  };

  await setCache(cacheKey, payload, REPORT_CACHE_TTL);

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Purchase invoice report fetched successfully",
    { ...payload, fromCache: false },
  );
});

// @desc Purchase product report — one row per product/variant line item across purchases,
// filterable by date range, supplier, category, subCategory, brand. Paginated.
exports.getPurchaseProductReport = asynchandeler(async (req, res) => {
  const {
    startDate,
    endDate,
    supplierId,
    supplierName,
    productId,
    category,
    subCategory,
    brand,
  } = req.body || {};
  const { page, limit, skip } = parsePagination(req);

  if (!startDate || !endDate) {
    throw new customError("startDate and endDate are required", statusCodes.BAD_REQUEST);
  }

  const match = { date: { $gte: new Date(startDate), $lte: new Date(endDate) } };
  castObjectIdFilter(match, "supplierId", supplierId);
  castObjectIdFilter(match, "category", category);
  castObjectIdFilter(match, "subCategory", subCategory);
  castObjectIdFilter(match, "brand", brand);

  const cacheKey = await buildCacheKey(
    PURCHASE_NS,
    `report:purchase-product:${startDate}:${endDate}:${supplierId || "all"}:${(supplierName || "").trim().toLowerCase()}:${productId || "-"}:${category || "-"}:${subCategory || "-"}:${brand || "-"}:p${page}:l${limit}`,
  );
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Purchase product report fetched successfully",
      { ...cached, fromCache: true },
    );
  }

  // category/subCategory/brand live directly on the Purchase document (not on
  // each line item), so they filter via the same indexed top-level $match as
  // date/supplier — no product-level lookup needed just to apply these filters.
  const pipeline = [
    { $match: match },
    ...supplierLookupStages(),
    ...supplierNameFilterStage(supplierName),
    { $unwind: "$allproduct" },
    ...productLineFilterStage(productId),
    {
      $lookup: {
        from: "products",
        localField: "allproduct.product",
        foreignField: "_id",
        as: "productInfo",
        pipeline: [
          {
            $project: {
              name: 1,
              barCode: 1,
              purchasePrice: 1,
              retailPrice: 1,
              wholesalePrice: 1,
            },
          },
        ],
      },
    },
    { $unwind: { path: "$productInfo", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "variants",
        localField: "allproduct.variant",
        foreignField: "_id",
        as: "variantInfo",
        pipeline: [
          {
            $project: {
              barCode: 1,
              product: 1,
              size: 1,
              color: 1,
              purchasePrice: 1,
              retailPrice: 1,
              wholesalePrice: 1,
            },
          },
          {
            $lookup: {
              from: "products",
              localField: "product",
              foreignField: "_id",
              as: "variantProduct",
              pipeline: [{ $project: { name: 1 } }],
            },
          },
          { $unwind: { path: "$variantProduct", preserveNullAndEmptyArrays: true } },
        ],
      },
    },
    { $unwind: { path: "$variantInfo", preserveNullAndEmptyArrays: true } },
    // Buy/WS/RS rates are the variant's own prices (falling back to the parent
    // product for items purchased without a variant, then to the price recorded
    // on the purchase line). Buy Total is always qty x buy rate.
    {
      $addFields: {
        lineProductName: { $ifNull: ["$variantInfo.variantProduct.name", "$productInfo.name"] },
        lineBarcode: { $ifNull: ["$variantInfo.barCode", "$productInfo.barCode"] },
        lineColor: {
          $ifNull: [
            { $cond: [{ $in: ["$allproduct.color", ["", null, "N/A"]] }, null, "$allproduct.color"] },
            "$variantInfo.color",
          ],
        },
        lineSize: {
          $ifNull: [
            { $cond: [{ $in: ["$allproduct.size", ["", null, "N/A"]] }, null, "$allproduct.size"] },
            "$variantInfo.size",
          ],
        },
        lineBuyRate: {
          $ifNull: [
            "$variantInfo.purchasePrice",
            { $ifNull: ["$productInfo.purchasePrice", { $ifNull: ["$allproduct.purchasePrice", 0] }] },
          ],
        },
        lineWsPrice: {
          $ifNull: [
            "$variantInfo.wholesalePrice",
            { $ifNull: ["$productInfo.wholesalePrice", { $ifNull: ["$allproduct.wholesalePrice", 0] }] },
          ],
        },
        lineRsPrice: {
          $ifNull: [
            "$variantInfo.retailPrice",
            { $ifNull: ["$productInfo.retailPrice", { $ifNull: ["$allproduct.retailPrice", 0] }] },
          ],
        },
      },
    },
    {
      $addFields: {
        lineBuyTotal: {
          $multiply: ["$lineBuyRate", { $ifNull: ["$allproduct.quantity", 0] }],
        },
      },
    },
    {
      $facet: {
        rows: [
          { $sort: { date: -1 } },
          { $skip: skip },
          { $limit: limit },
          {
            $project: {
              _id: 1,
              date: 1,
              purchaseId: "$serial",
              supplierInvoice: "$invoiceNumber",
              supplierName: { $ifNull: ["$supplier.supplierName", "-"] },
              productName: { $ifNull: ["$lineProductName", "-"] },
              barcode: { $ifNull: ["$lineBarcode", "-"] },
              color: { $ifNull: ["$lineColor", "-"] },
              size: { $ifNull: ["$lineSize", "-"] },
              buyRate: "$lineBuyRate",
              qty: "$allproduct.quantity",
              wsPrice: "$lineWsPrice",
              rsPrice: "$lineRsPrice",
              buyTotal: "$lineBuyTotal",
            },
          },
        ],
        totals: [
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              totalBuyRate: { $sum: "$lineBuyRate" },
              totalQty: { $sum: "$allproduct.quantity" },
              totalWsPrice: { $sum: "$lineWsPrice" },
              totalRsPrice: { $sum: "$lineRsPrice" },
              totalBuyTotal: { $sum: "$lineBuyTotal" },
            },
          },
        ],
      },
    },
  ];

  const [result] = await Purchase.aggregate(pipeline);
  const rows = result?.rows || [];
  const totals = result?.totals?.[0] || {
    count: 0,
    totalBuyRate: 0,
    totalQty: 0,
    totalWsPrice: 0,
    totalRsPrice: 0,
    totalBuyTotal: 0,
  };

  const header = await getStoreHeader();

  const payload = {
    header,
    filters: {
      startDate,
      endDate,
      supplier: supplierName?.trim() || (supplierId ? "Selected supplier" : "ALL"),
      productId: productId || null,
      category: category || "ALL",
      subCategory: subCategory || "ALL",
      brand: brand || "ALL",
    },
    rows,
    totals: {
      count: totals.count,
      totalBuyRate: totals.totalBuyRate,
      totalQty: totals.totalQty,
      totalWsPrice: totals.totalWsPrice,
      totalRsPrice: totals.totalRsPrice,
      totalBuyTotal: totals.totalBuyTotal,
    },
    pagination: paginationMeta(totals.count, page, limit, skip),
    generatedAt: new Date(),
  };

  await setCache(cacheKey, payload, REPORT_CACHE_TTL);

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Purchase product report fetched successfully",
    { ...payload, fromCache: false },
  );
});

// @desc Purchase summary report — one row per product across the whole date
// range. A product bought many times at different rates collapses into a single
// row whose AVG BUY RATE is the simple average of every purchase line's own
// price (sum of prices / number of lines), matching how the printed sheet is
// read. WS/RS prices come from the same purchase lines and average the same
// way. BUY TOTAL is that average rate multiplied by the summed quantity.
exports.getPurchaseSummaryReport = asynchandeler(async (req, res) => {
  const {
    startDate,
    endDate,
    supplierId,
    supplierName,
    productId,
    category,
    subCategory,
    brand,
  } = req.body || {};
  const { page, limit, skip } = parsePagination(req);

  if (!startDate || !endDate) {
    throw new customError("startDate and endDate are required", statusCodes.BAD_REQUEST);
  }

  const match = { date: { $gte: new Date(startDate), $lte: new Date(endDate) } };
  castObjectIdFilter(match, "supplierId", supplierId);
  castObjectIdFilter(match, "category", category);
  castObjectIdFilter(match, "subCategory", subCategory);
  castObjectIdFilter(match, "brand", brand);

  const cacheKey = await buildCacheKey(
    PURCHASE_NS,
    `report:purchase-summary:${startDate}:${endDate}:${supplierId || "all"}:${(supplierName || "").trim().toLowerCase()}:${productId || "-"}:${category || "-"}:${subCategory || "-"}:${brand || "-"}:p${page}:l${limit}`,
  );
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Purchase summary report fetched successfully",
      { ...cached, fromCache: true },
    );
  }

  const pipeline = [
    { $match: match },
    ...supplierLookupStages(),
    ...supplierNameFilterStage(supplierName),
    { $unwind: "$allproduct" },
    ...productLineFilterStage(productId),
    {
      $lookup: {
        from: "products",
        localField: "allproduct.product",
        foreignField: "_id",
        as: "productInfo",
        pipeline: [{ $project: { name: 1, barCode: 1 } }],
      },
    },
    { $unwind: { path: "$productInfo", preserveNullAndEmptyArrays: true } },
    // A line may reference a variant instead of a product; the variant carries
    // the parent product, which is what rows group by.
    {
      $lookup: {
        from: "variants",
        localField: "allproduct.variant",
        foreignField: "_id",
        as: "variantInfo",
        pipeline: [
          { $project: { barCode: 1, product: 1 } },
          {
            $lookup: {
              from: "products",
              localField: "product",
              foreignField: "_id",
              as: "variantProduct",
              pipeline: [{ $project: { name: 1, barCode: 1 } }],
            },
          },
          { $unwind: { path: "$variantProduct", preserveNullAndEmptyArrays: true } },
        ],
      },
    },
    { $unwind: { path: "$variantInfo", preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        groupProductId: {
          $ifNull: ["$allproduct.product", "$variantInfo.product"],
        },
        lineProductName: {
          $ifNull: ["$productInfo.name", "$variantInfo.variantProduct.name"],
        },
        lineBarcode: {
          $ifNull: [
            "$productInfo.barCode",
            { $ifNull: ["$variantInfo.variantProduct.barCode", "$variantInfo.barCode"] },
          ],
        },
        lineColor: {
          $cond: [{ $in: ["$allproduct.color", ["", null, "N/A"]] }, null, "$allproduct.color"],
        },
        lineSize: {
          $cond: [{ $in: ["$allproduct.size", ["", null, "N/A"]] }, null, "$allproduct.size"],
        },
        lineBuyRate: { $ifNull: ["$allproduct.purchasePrice", 0] },
        lineWsPrice: { $ifNull: ["$allproduct.wholesalePrice", 0] },
        lineRsPrice: { $ifNull: ["$allproduct.retailPrice", 0] },
        lineQty: { $ifNull: ["$allproduct.quantity", 0] },
      },
    },
    // One row per product. Colours and sizes seen across those purchases are
    // collected so a product bought in several variants still shows them.
    {
      $group: {
        _id: { $ifNull: ["$groupProductId", "$lineProductName"] },
        productName: { $first: "$lineProductName" },
        barcode: { $first: "$lineBarcode" },
        colors: { $addToSet: "$lineColor" },
        sizes: { $addToSet: "$lineSize" },
        lineCount: { $sum: 1 },
        sumBuyRate: { $sum: "$lineBuyRate" },
        sumWsPrice: { $sum: "$lineWsPrice" },
        sumRsPrice: { $sum: "$lineRsPrice" },
        qty: { $sum: "$lineQty" },
      },
    },
    {
      $addFields: {
        avgBuyRate: { $divide: ["$sumBuyRate", { $max: ["$lineCount", 1] }] },
        avgWsPrice: { $divide: ["$sumWsPrice", { $max: ["$lineCount", 1] }] },
        avgRsPrice: { $divide: ["$sumRsPrice", { $max: ["$lineCount", 1] }] },
      },
    },
    { $addFields: { buyTotal: { $multiply: ["$avgBuyRate", "$qty"] } } },
    {
      $facet: {
        rows: [
          { $sort: { productName: 1 } },
          { $skip: skip },
          { $limit: limit },
          {
            $project: {
              _id: 1,
              productName: { $ifNull: ["$productName", "-"] },
              barcode: { $ifNull: ["$barcode", "-"] },
              color: {
                $let: {
                  vars: { c: { $filter: { input: "$colors", as: "v", cond: { $ne: ["$$v", null] } } } },
                  in: {
                    $cond: [
                      { $eq: [{ $size: "$$c" }, 0] },
                      "-",
                      { $reduce: {
                        input: "$$c",
                        initialValue: "",
                        in: { $cond: [{ $eq: ["$$value", ""] }, "$$this", { $concat: ["$$value", ", ", "$$this"] }] },
                      } },
                    ],
                  },
                },
              },
              size: {
                $let: {
                  vars: { z: { $filter: { input: "$sizes", as: "v", cond: { $ne: ["$$v", null] } } } },
                  in: {
                    $cond: [
                      { $eq: [{ $size: "$$z" }, 0] },
                      "-",
                      { $reduce: {
                        input: "$$z",
                        initialValue: "",
                        in: { $cond: [{ $eq: ["$$value", ""] }, "$$this", { $concat: ["$$value", ", ", "$$this"] }] },
                      } },
                    ],
                  },
                },
              },
              purchaseCount: "$lineCount",
              avgBuyRate: 1,
              qty: 1,
              wsPrice: "$avgWsPrice",
              rsPrice: "$avgRsPrice",
              buyTotal: 1,
            },
          },
        ],
        totals: [
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              totalAvgBuyRate: { $sum: "$avgBuyRate" },
              totalQty: { $sum: "$qty" },
              totalWsPrice: { $sum: "$avgWsPrice" },
              totalRsPrice: { $sum: "$avgRsPrice" },
              totalBuyTotal: { $sum: "$buyTotal" },
            },
          },
        ],
      },
    },
  ];

  const [result] = await Purchase.aggregate(pipeline);
  const rows = result?.rows || [];
  const totals = result?.totals?.[0] || {
    count: 0,
    totalAvgBuyRate: 0,
    totalQty: 0,
    totalWsPrice: 0,
    totalRsPrice: 0,
    totalBuyTotal: 0,
  };

  const header = await getStoreHeader();

  const payload = {
    header,
    filters: {
      startDate,
      endDate,
      supplier: supplierName?.trim() || (supplierId ? "Selected supplier" : "ALL"),
      productId: productId || null,
      category: category || "ALL",
      subCategory: subCategory || "ALL",
      brand: brand || "ALL",
    },
    rows,
    totals: {
      count: totals.count,
      totalAvgBuyRate: totals.totalAvgBuyRate,
      totalQty: totals.totalQty,
      totalWsPrice: totals.totalWsPrice,
      totalRsPrice: totals.totalRsPrice,
      totalBuyTotal: totals.totalBuyTotal,
    },
    pagination: paginationMeta(totals.count, page, limit, skip),
    generatedAt: new Date(),
  };

  await setCache(cacheKey, payload, REPORT_CACHE_TTL);

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Purchase summary report fetched successfully",
    { ...payload, fromCache: false },
  );
});

// @desc Purchase return report — one row per returned line item, date range +
// optional supplier / product filter, paginated. BUY RATE is the price recorded
// on the return line and TOTAL is that rate multiplied by the returned quantity.
exports.getPurchaseReturnReport = asynchandeler(async (req, res) => {
  const { startDate, endDate, supplierId, productId, category, subCategory, brand } =
    req.body || {};
  const { page, limit, skip } = parsePagination(req);

  if (!startDate || !endDate) {
    throw new customError("startDate and endDate are required", statusCodes.BAD_REQUEST);
  }

  // PurchaseReturn dates the document with returnDate, not date.
  const match = { returnDate: { $gte: new Date(startDate), $lte: new Date(endDate) } };
  castObjectIdFilter(match, "supplier", supplierId);

  const cacheKey = await buildCacheKey(
    PURCHASE_NS,
    `report:purchase-return:${startDate}:${endDate}:${supplierId || "all"}:${productId || "-"}:${category || "-"}:${subCategory || "-"}:${brand || "-"}:p${page}:l${limit}`,
  );
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Purchase return report fetched successfully",
      { ...cached, fromCache: true },
    );
  }

  const productFilterStages = [];
  if (productId) {
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      throw new customError("Invalid productId", statusCodes.BAD_REQUEST);
    }
    productFilterStages.push({
      $match: { "products.product": new mongoose.Types.ObjectId(productId) },
    });
  }

  const pipeline = [
    { $match: match },
    {
      $lookup: {
        from: "suppliers",
        localField: "supplier",
        foreignField: "_id",
        as: "supplierInfo",
        pipeline: [{ $project: { supplierName: 1 } }],
      },
    },
    { $unwind: { path: "$supplierInfo", preserveNullAndEmptyArrays: true } },
    { $unwind: "$products" },
    ...productFilterStages,
    {
      $lookup: {
        from: "products",
        localField: "products.product",
        foreignField: "_id",
        as: "productInfo",
        pipeline: [
          { $project: { name: 1, barCode: 1, category: 1, subcategory: 1, brand: 1 } },
        ],
      },
    },
    { $unwind: { path: "$productInfo", preserveNullAndEmptyArrays: true } },
    // A return line may name a variant instead of a product; the variant carries
    // its own barcode/colour/size plus the parent product's name.
    {
      $lookup: {
        from: "variants",
        localField: "products.variant",
        foreignField: "_id",
        as: "variantInfo",
        pipeline: [
          { $project: { barCode: 1, product: 1, size: 1, color: 1 } },
          {
            $lookup: {
              from: "products",
              localField: "product",
              foreignField: "_id",
              as: "variantProduct",
              pipeline: [
                { $project: { name: 1, category: 1, subcategory: 1, brand: 1 } },
              ],
            },
          },
          { $unwind: { path: "$variantProduct", preserveNullAndEmptyArrays: true } },
        ],
      },
    },
    { $unwind: { path: "$variantInfo", preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        lineProductName: { $ifNull: ["$productInfo.name", "$variantInfo.variantProduct.name"] },
        lineBarcode: { $ifNull: ["$productInfo.barCode", "$variantInfo.barCode"] },
        lineColor: {
          $cond: [{ $in: [{ $ifNull: ["$variantInfo.color", null] }, ["", null, "N/A"]] }, null, "$variantInfo.color"],
        },
        lineSize: {
          $cond: [{ $in: [{ $ifNull: ["$variantInfo.size", null] }, ["", null, "N/A"]] }, null, "$variantInfo.size"],
        },
        lineCategory: {
          $ifNull: ["$productInfo.category", "$variantInfo.variantProduct.category"],
        },
        lineSubCategory: {
          $ifNull: ["$productInfo.subcategory", "$variantInfo.variantProduct.subcategory"],
        },
        lineBrand: { $ifNull: ["$productInfo.brand", "$variantInfo.variantProduct.brand"] },
        lineBuyRate: { $ifNull: ["$products.purchasePrice", 0] },
        lineQty: { $ifNull: ["$products.quantity", 0] },
      },
    },
    ...returnClassificationFilterStages({ category, subCategory, brand }),
    // TOTAL is always rate x qty, never the stored subtotal, so the column and
    // the footer can't drift apart.
    { $addFields: { lineTotal: { $multiply: ["$lineBuyRate", "$lineQty"] } } },
    {
      $facet: {
        rows: [
          { $sort: { returnDate: -1 } },
          { $skip: skip },
          { $limit: limit },
          {
            $project: {
              _id: 1,
              date: "$returnDate",
              returnId: "$serial",
              supplierName: { $ifNull: ["$supplierInfo.supplierName", "-"] },
              productName: { $ifNull: ["$lineProductName", "-"] },
              barcode: { $ifNull: ["$lineBarcode", "-"] },
              color: { $ifNull: ["$lineColor", "-"] },
              size: { $ifNull: ["$lineSize", "-"] },
              buyRate: "$lineBuyRate",
              qty: "$lineQty",
              total: "$lineTotal",
            },
          },
        ],
        totals: [
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              totalBuyRate: { $sum: "$lineBuyRate" },
              totalQty: { $sum: "$lineQty" },
              totalAmount: { $sum: "$lineTotal" },
            },
          },
        ],
      },
    },
  ];

  const [result] = await PurchaseReturn.aggregate(pipeline);
  const rows = result?.rows || [];
  const totals = result?.totals?.[0] || {
    count: 0,
    totalBuyRate: 0,
    totalQty: 0,
    totalAmount: 0,
  };

  const header = await getStoreHeader();

  const payload = {
    header,
    filters: {
      startDate,
      endDate,
      supplierId: supplierId || null,
      productId: productId || null,
      category: category || "ALL",
      subCategory: subCategory || "ALL",
      brand: brand || "ALL",
    },
    rows,
    totals: {
      count: totals.count,
      totalBuyRate: totals.totalBuyRate,
      totalQty: totals.totalQty,
      totalAmount: totals.totalAmount,
    },
    pagination: paginationMeta(totals.count, page, limit, skip),
    generatedAt: new Date(),
  };

  await setCache(cacheKey, payload, REPORT_CACHE_TTL);

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Purchase return report fetched successfully",
    { ...payload, fromCache: false },
  );
});

// @desc Purchase return summary report — one row per returned variant (or per
// product where the return line names no variant). The same item returned more
// than once at different rates collapses into a single row whose AVG BUY RATE
// is the simple average of those rates, and TOTAL is that average multiplied by
// the summed returned quantity.
exports.getPurchaseReturnSummaryReport = asynchandeler(async (req, res) => {
  const { startDate, endDate, supplierId, productId, category, subCategory, brand } =
    req.body || {};
  const { page, limit, skip } = parsePagination(req);

  if (!startDate || !endDate) {
    throw new customError("startDate and endDate are required", statusCodes.BAD_REQUEST);
  }

  const match = { returnDate: { $gte: new Date(startDate), $lte: new Date(endDate) } };
  castObjectIdFilter(match, "supplier", supplierId);

  const cacheKey = await buildCacheKey(
    PURCHASE_NS,
    `report:purchase-return-summary:${startDate}:${endDate}:${supplierId || "all"}:${productId || "-"}:${category || "-"}:${subCategory || "-"}:${brand || "-"}:p${page}:l${limit}`,
  );
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Purchase return summary report fetched successfully",
      { ...cached, fromCache: true },
    );
  }

  const productFilterStages = [];
  if (productId) {
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      throw new customError("Invalid productId", statusCodes.BAD_REQUEST);
    }
    productFilterStages.push({
      $match: { "products.product": new mongoose.Types.ObjectId(productId) },
    });
  }

  const pipeline = [
    { $match: match },
    { $unwind: "$products" },
    ...productFilterStages,
    {
      $lookup: {
        from: "products",
        localField: "products.product",
        foreignField: "_id",
        as: "productInfo",
        pipeline: [
          { $project: { name: 1, barCode: 1, category: 1, subcategory: 1, brand: 1 } },
        ],
      },
    },
    { $unwind: { path: "$productInfo", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "variants",
        localField: "products.variant",
        foreignField: "_id",
        as: "variantInfo",
        pipeline: [
          { $project: { barCode: 1, product: 1, size: 1, color: 1 } },
          {
            $lookup: {
              from: "products",
              localField: "product",
              foreignField: "_id",
              as: "variantProduct",
              pipeline: [
                { $project: { name: 1, category: 1, subcategory: 1, brand: 1 } },
              ],
            },
          },
          { $unwind: { path: "$variantProduct", preserveNullAndEmptyArrays: true } },
        ],
      },
    },
    { $unwind: { path: "$variantInfo", preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        // Rows group by variant when the return line names one, so the same
        // variant returned at several rates lands in a single row; otherwise
        // the product itself is the grouping key.
        groupKey: { $ifNull: ["$products.variant", "$products.product"] },
        lineProductName: { $ifNull: ["$productInfo.name", "$variantInfo.variantProduct.name"] },
        lineBarcode: { $ifNull: ["$variantInfo.barCode", "$productInfo.barCode"] },
        lineColor: {
          $cond: [{ $in: [{ $ifNull: ["$variantInfo.color", null] }, ["", null, "N/A"]] }, null, "$variantInfo.color"],
        },
        lineSize: {
          $cond: [{ $in: [{ $ifNull: ["$variantInfo.size", null] }, ["", null, "N/A"]] }, null, "$variantInfo.size"],
        },
        lineCategory: {
          $ifNull: ["$productInfo.category", "$variantInfo.variantProduct.category"],
        },
        lineSubCategory: {
          $ifNull: ["$productInfo.subcategory", "$variantInfo.variantProduct.subcategory"],
        },
        lineBrand: { $ifNull: ["$productInfo.brand", "$variantInfo.variantProduct.brand"] },
        lineBuyRate: { $ifNull: ["$products.purchasePrice", 0] },
        lineQty: { $ifNull: ["$products.quantity", 0] },
      },
    },
    ...returnClassificationFilterStages({ category, subCategory, brand }),
    {
      $group: {
        _id: { $ifNull: ["$groupKey", "$lineProductName"] },
        productName: { $first: "$lineProductName" },
        barcode: { $first: "$lineBarcode" },
        color: { $first: "$lineColor" },
        size: { $first: "$lineSize" },
        returnCount: { $sum: 1 },
        sumBuyRate: { $sum: "$lineBuyRate" },
        qty: { $sum: "$lineQty" },
      },
    },
    {
      $addFields: {
        avgBuyRate: { $divide: ["$sumBuyRate", { $max: ["$returnCount", 1] }] },
      },
    },
    { $addFields: { total: { $multiply: ["$avgBuyRate", "$qty"] } } },
    {
      $facet: {
        rows: [
          { $sort: { productName: 1 } },
          { $skip: skip },
          { $limit: limit },
          {
            $project: {
              _id: 1,
              productName: { $ifNull: ["$productName", "-"] },
              barcode: { $ifNull: ["$barcode", "-"] },
              color: { $ifNull: ["$color", "-"] },
              size: { $ifNull: ["$size", "-"] },
              returnCount: 1,
              avgBuyRate: 1,
              qty: 1,
              total: 1,
            },
          },
        ],
        totals: [
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              totalAvgBuyRate: { $sum: "$avgBuyRate" },
              totalQty: { $sum: "$qty" },
              totalAmount: { $sum: "$total" },
            },
          },
        ],
      },
    },
  ];

  const [result] = await PurchaseReturn.aggregate(pipeline);
  const rows = result?.rows || [];
  const totals = result?.totals?.[0] || {
    count: 0,
    totalAvgBuyRate: 0,
    totalQty: 0,
    totalAmount: 0,
  };

  const header = await getStoreHeader();

  const payload = {
    header,
    filters: {
      startDate,
      endDate,
      supplierId: supplierId || null,
      productId: productId || null,
      category: category || "ALL",
      subCategory: subCategory || "ALL",
      brand: brand || "ALL",
    },
    rows,
    totals: {
      count: totals.count,
      totalAvgBuyRate: totals.totalAvgBuyRate,
      totalQty: totals.totalQty,
      totalAmount: totals.totalAmount,
    },
    pagination: paginationMeta(totals.count, page, limit, skip),
    generatedAt: new Date(),
  };

  await setCache(cacheKey, payload, REPORT_CACHE_TTL);

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Purchase return summary report fetched successfully",
    { ...payload, fromCache: false },
  );
});

// @desc Stock report — one row per sellable unit: a single-variant product is
// its own row, a multi-variant product contributes one row per variant. Prices
// and stock come from the variant where it has them and fall back to the parent
// product. STOCK VALUE is buy rate x stock.
exports.getStockReport = asynchandeler(async (req, res) => {
  const { category, subCategory, brand, productId, search, inStockOnly } = req.body || {};
  const { page, limit, skip } = parsePagination(req);

  const match = { isActive: { $ne: false } };
  castObjectIdFilter(match, "category", category);
  castObjectIdFilter(match, "subcategory", subCategory);
  castObjectIdFilter(match, "brand", brand);
  castObjectIdFilter(match, "_id", productId);

  const searchTerm = (search || "").trim();

  const cacheKey = await buildCacheKey(
    PRODUCT_NS,
    `report:stock:${category || "-"}:${subCategory || "-"}:${brand || "-"}:${productId || "-"}:${searchTerm.toLowerCase()}:${inStockOnly ? "instock" : "all"}:p${page}:l${limit}`,
  );
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(res, statusCodes.OK, "Stock report fetched successfully", {
      ...cached,
      fromCache: true,
    });
  }

  // Variants are looked up rather than read from product.variant[] so a variant
  // deactivated after the product was saved drops out of the report.
  const pipeline = [
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
            },
          },
        ],
      },
    },
    {
      $lookup: {
        from: "subcategories",
        localField: "subcategory",
        foreignField: "_id",
        as: "subcategoryInfo",
        pipeline: [{ $project: { name: 1 } }],
      },
    },
    { $unwind: { path: "$subcategoryInfo", preserveNullAndEmptyArrays: true } },
    // Each product becomes an array of rows: its variants, or itself when it
    // has none. $unwind then turns that array back into one document per row.
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
                  groupUnitQuantity: {
                    $ifNull: ["$$v.groupUnitQuantity", "$groupUnitQuantity"],
                  },
                  stock: { $ifNull: ["$$v.stockVariant", 0] },
                },
              },
            },
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
              },
            ],
          ],
        },
      },
    },
    { $unwind: "$stockRows" },
    {
      $addFields: {
        rowStock: { $ifNull: ["$stockRows.stock", 0] },
        rowBuyRate: { $ifNull: ["$stockRows.buyRate", 0] },
      },
    },
    { $addFields: { rowStockValue: { $multiply: ["$rowBuyRate", "$rowStock"] } } },
  ];

  if (searchTerm) {
    // Digits scan as a barcode; anything else matches the product or variant name.
    const isBarcode = /^\d{6,20}$/.test(searchTerm);
    pipeline.push({
      $match: isBarcode
        ? { "stockRows.barcode": searchTerm }
        : {
            $or: [
              { name: { $regex: searchTerm, $options: "i" } },
              { "stockRows.variantName": { $regex: searchTerm, $options: "i" } },
              { "stockRows.barcode": { $regex: searchTerm, $options: "i" } },
            ],
          },
    });
  }

  if (inStockOnly) {
    pipeline.push({ $match: { rowStock: { $gt: 0 } } });
  }

  pipeline.push({
    $facet: {
      rows: [
        { $sort: { name: 1, "stockRows.variantName": 1 } },
        { $skip: skip },
        { $limit: limit },
        {
          $project: {
            _id: {
              $concat: [
                { $toString: "$_id" },
                "-",
                { $ifNull: [{ $toString: "$stockRows.variantId" }, "single"] },
              ],
            },
            productName: { $ifNull: ["$name", "-"] },
            variantName: { $ifNull: ["$stockRows.variantName", "-"] },
            subcategory: { $ifNull: ["$subcategoryInfo.name", "-"] },
            barcode: { $ifNull: ["$stockRows.barcode", "-"] },
            color: { $ifNull: ["$stockRows.color", "-"] },
            size: { $ifNull: ["$stockRows.size", "-"] },
            buyRate: "$rowBuyRate",
            wsPrice: { $ifNull: ["$stockRows.wsPrice", 0] },
            retailPrice: { $ifNull: ["$stockRows.retailPrice", 0] },
            unit: { $ifNull: ["$stockRows.unit", ""] },
            groupUnit: { $ifNull: ["$stockRows.groupUnit", ""] },
            groupUnitQuantity: { $ifNull: ["$stockRows.groupUnitQuantity", 0] },
            stock: "$rowStock",
            stockValue: "$rowStockValue",
          },
        },
      ],
      totals: [
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            totalBuyRate: { $sum: "$rowBuyRate" },
            totalWsPrice: { $sum: { $ifNull: ["$stockRows.wsPrice", 0] } },
            totalRetailPrice: { $sum: { $ifNull: ["$stockRows.retailPrice", 0] } },
            totalStock: { $sum: "$rowStock" },
            totalStockValue: { $sum: "$rowStockValue" },
          },
        },
      ],
    },
  });

  const [result] = await Product.aggregate(pipeline);
  const rows = result?.rows || [];
  const totals = result?.totals?.[0] || {
    count: 0,
    totalBuyRate: 0,
    totalWsPrice: 0,
    totalRetailPrice: 0,
    totalStock: 0,
    totalStockValue: 0,
  };

  const header = await getStoreHeader();

  const payload = {
    header,
    filters: {
      category: category || "ALL",
      subCategory: subCategory || "ALL",
      brand: brand || "ALL",
      productId: productId || null,
      search: searchTerm || "",
      inStockOnly: !!inStockOnly,
    },
    rows,
    totals: {
      count: totals.count,
      totalBuyRate: totals.totalBuyRate,
      totalWsPrice: totals.totalWsPrice,
      totalRetailPrice: totals.totalRetailPrice,
      totalStock: totals.totalStock,
      totalStockValue: totals.totalStockValue,
    },
    pagination: paginationMeta(totals.count, page, limit, skip),
    generatedAt: new Date(),
  };

  await setCache(cacheKey, payload, REPORT_CACHE_TTL);

  apiResponse.sendSuccess(res, statusCodes.OK, "Stock report fetched successfully", {
    ...payload,
    fromCache: false,
  });
});

// @desc Stock details report — the movement behind each item's stock: opening,
// purchases, adjustments, sales (POS and web), and the three return streams,
// one row per variant (or per product when it has none). STOCK is derived from
// those movements with the same formula the Category Stock Details page uses,
// and STOCK VALUE is buy rate x that stock.
exports.getStockDetailsReport = asynchandeler(async (req, res) => {
  const { category, subCategory, brand, productId, search, inStockOnly } = req.body || {};
  const { page, limit, skip } = parsePagination(req);

  const match = { isActive: { $ne: false } };
  castObjectIdFilter(match, "category", category);
  castObjectIdFilter(match, "subcategory", subCategory);
  castObjectIdFilter(match, "brand", brand);
  castObjectIdFilter(match, "_id", productId);

  const searchTerm = (search || "").trim();

  const cacheKey = await buildCacheKey(
    PRODUCT_NS,
    `report:stock-details:${category || "-"}:${subCategory || "-"}:${brand || "-"}:${productId || "-"}:${searchTerm.toLowerCase()}:${inStockOnly ? "instock" : "all"}:p${page}:l${limit}`,
  );
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(res, statusCodes.OK, "Stock details report fetched successfully", {
      ...cached,
      fromCache: true,
    });
  }

  // totalSalesReturnQuantity is a mongoose virtual (a sum over salesReturn[]),
  // so aggregation has to add it up itself.
  const courierReturnSum = (field) => ({
    $reduce: {
      input: { $ifNull: [field, []] },
      initialValue: 0,
      in: { $add: ["$$value", { $ifNull: ["$$this.quantity", 0] }] },
    },
  });

  const pipeline = [
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
              initialStock: 1,
              purchaseQuantityStock: 1,
              stockAdjustmentPlus: 1,
              stockAdjustmentMinus: 1,
              posSold: 1,
              totalSales: 1,
              purchaseReturnStock: 1,
              salesReturnStock: 1,
              courierReturn: courierReturnSum("$salesReturn"),
            },
          },
        ],
      },
    },
    {
      $lookup: {
        from: "subcategories",
        localField: "subcategory",
        foreignField: "_id",
        as: "subcategoryInfo",
        pipeline: [{ $project: { name: 1 } }],
      },
    },
    { $unwind: { path: "$subcategoryInfo", preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        productCourierReturn: courierReturnSum("$salesReturn"),
      },
    },
    {
      $addFields: {
        detailRows: {
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
                  opening: { $ifNull: ["$$v.initialStock", 0] },
                  buyQty: { $ifNull: ["$$v.purchaseQuantityStock", 0] },
                  adjPlus: { $ifNull: ["$$v.stockAdjustmentPlus", 0] },
                  adjMinus: { $ifNull: ["$$v.stockAdjustmentMinus", 0] },
                  posSold: { $ifNull: ["$$v.posSold", 0] },
                  webSold: { $ifNull: ["$$v.totalSales", 0] },
                  buyReturn: { $ifNull: ["$$v.purchaseReturnStock", 0] },
                  salesReturn: { $ifNull: ["$$v.salesReturnStock", 0] },
                  courierReturn: { $ifNull: ["$$v.courierReturn", 0] },
                },
              },
            },
            [
              {
                variantId: null,
                variantName: "Single",
                barcode: { $ifNull: ["$barCode", "$sku"] },
                size: "$size",
                color: "$color",
                buyRate: "$purchasePrice",
                opening: { $ifNull: ["$initialStock", 0] },
                buyQty: { $ifNull: ["$purchaseQuantityStock", 0] },
                adjPlus: { $ifNull: ["$stockAdjustmentPlus", 0] },
                adjMinus: { $ifNull: ["$stockAdjustmentMinus", 0] },
                posSold: { $ifNull: ["$posSold", 0] },
                webSold: { $ifNull: ["$totalSales", 0] },
                buyReturn: { $ifNull: ["$purchaseReturnStock", 0] },
                salesReturn: { $ifNull: ["$salesReturnStock", 0] },
                courierReturn: { $ifNull: ["$productCourierReturn", 0] },
              },
            ],
          ],
        },
      },
    },
    { $unwind: "$detailRows" },
    // Stock = (opening + buy qty + adj(+) + sales return + courier return)
    //       - (POS sold + web sold + adj(-) + purchase return)
    {
      $addFields: {
        rowBuyRate: { $ifNull: ["$detailRows.buyRate", 0] },
        rowStock: {
          $subtract: [
            {
              $add: [
                "$detailRows.opening",
                "$detailRows.buyQty",
                "$detailRows.adjPlus",
                "$detailRows.salesReturn",
                "$detailRows.courierReturn",
              ],
            },
            {
              $add: [
                "$detailRows.posSold",
                "$detailRows.webSold",
                "$detailRows.adjMinus",
                "$detailRows.buyReturn",
              ],
            },
          ],
        },
      },
    },
    { $addFields: { rowStockValue: { $multiply: ["$rowBuyRate", "$rowStock"] } } },
  ];

  if (searchTerm) {
    const isBarcode = /^\d{6,20}$/.test(searchTerm);
    pipeline.push({
      $match: isBarcode
        ? { "detailRows.barcode": searchTerm }
        : {
            $or: [
              { name: { $regex: searchTerm, $options: "i" } },
              { "detailRows.variantName": { $regex: searchTerm, $options: "i" } },
              { "detailRows.barcode": { $regex: searchTerm, $options: "i" } },
            ],
          },
    });
  }

  if (inStockOnly) {
    pipeline.push({ $match: { rowStock: { $gt: 0 } } });
  }

  pipeline.push({
    $facet: {
      rows: [
        { $sort: { name: 1, "detailRows.variantName": 1 } },
        { $skip: skip },
        { $limit: limit },
        {
          $project: {
            _id: {
              $concat: [
                { $toString: "$_id" },
                "-",
                { $ifNull: [{ $toString: "$detailRows.variantId" }, "single"] },
              ],
            },
            productName: { $ifNull: ["$name", "-"] },
            variantName: { $ifNull: ["$detailRows.variantName", "-"] },
            subcategory: { $ifNull: ["$subcategoryInfo.name", "-"] },
            barcode: { $ifNull: ["$detailRows.barcode", "-"] },
            color: { $ifNull: ["$detailRows.color", "-"] },
            size: { $ifNull: ["$detailRows.size", "-"] },
            buyRate: "$rowBuyRate",
            opening: "$detailRows.opening",
            buyQty: "$detailRows.buyQty",
            adjPlus: "$detailRows.adjPlus",
            adjMinus: "$detailRows.adjMinus",
            posSold: "$detailRows.posSold",
            webSold: "$detailRows.webSold",
            buyReturn: "$detailRows.buyReturn",
            salesReturn: "$detailRows.salesReturn",
            courierReturn: "$detailRows.courierReturn",
            stock: "$rowStock",
            stockValue: "$rowStockValue",
          },
        },
      ],
      totals: [
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            totalBuyRate: { $sum: "$rowBuyRate" },
            totalOpening: { $sum: "$detailRows.opening" },
            totalBuyQty: { $sum: "$detailRows.buyQty" },
            totalAdjPlus: { $sum: "$detailRows.adjPlus" },
            totalAdjMinus: { $sum: "$detailRows.adjMinus" },
            totalPosSold: { $sum: "$detailRows.posSold" },
            totalWebSold: { $sum: "$detailRows.webSold" },
            totalBuyReturn: { $sum: "$detailRows.buyReturn" },
            totalSalesReturn: { $sum: "$detailRows.salesReturn" },
            totalCourierReturn: { $sum: "$detailRows.courierReturn" },
            totalStock: { $sum: "$rowStock" },
            totalStockValue: { $sum: "$rowStockValue" },
          },
        },
      ],
    },
  });

  const [result] = await Product.aggregate(pipeline);
  const rows = result?.rows || [];
  const totals = result?.totals?.[0] || {
    count: 0,
    totalBuyRate: 0,
    totalOpening: 0,
    totalBuyQty: 0,
    totalAdjPlus: 0,
    totalAdjMinus: 0,
    totalPosSold: 0,
    totalWebSold: 0,
    totalBuyReturn: 0,
    totalSalesReturn: 0,
    totalCourierReturn: 0,
    totalStock: 0,
    totalStockValue: 0,
  };

  const header = await getStoreHeader();

  const payload = {
    header,
    filters: {
      category: category || "ALL",
      subCategory: subCategory || "ALL",
      brand: brand || "ALL",
      productId: productId || null,
      search: searchTerm || "",
      inStockOnly: !!inStockOnly,
    },
    rows,
    totals: {
      count: totals.count,
      totalBuyRate: totals.totalBuyRate,
      totalOpening: totals.totalOpening,
      totalBuyQty: totals.totalBuyQty,
      totalAdjPlus: totals.totalAdjPlus,
      totalAdjMinus: totals.totalAdjMinus,
      totalPosSold: totals.totalPosSold,
      totalWebSold: totals.totalWebSold,
      totalBuyReturn: totals.totalBuyReturn,
      totalSalesReturn: totals.totalSalesReturn,
      totalCourierReturn: totals.totalCourierReturn,
      totalStock: totals.totalStock,
      totalStockValue: totals.totalStockValue,
    },
    pagination: paginationMeta(totals.count, page, limit, skip),
    generatedAt: new Date(),
  };

  await setCache(cacheKey, payload, REPORT_CACHE_TTL);

  apiResponse.sendSuccess(res, statusCodes.OK, "Stock details report fetched successfully", {
    ...payload,
    fromCache: false,
  });
});

// @desc Suppliers that have at least one purchase — for the purchase reports' supplier filter dropdown
exports.getPurchaseInvoiceSuppliers = asynchandeler(async (req, res) => {
  const cacheKey = await buildCacheKey(PURCHASE_NS, "report:purchase:suppliers");
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Supplier list fetched successfully",
      { suppliers: cached, fromCache: true },
    );
  }

  const supplierIds = await Purchase.distinct("supplierId", { supplierId: { $ne: null } });

  const suppliers = await Supplier.find({ _id: { $in: supplierIds } })
    .select("_id supplierName")
    .sort({ supplierName: 1 })
    .lean();

  await setCache(cacheKey, suppliers, REPORT_CACHE_TTL);

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Supplier list fetched successfully",
    { suppliers, fromCache: false },
  );
});

// @desc Sales invoice report — one row per sale invoice, date range + optional
// salesType/customerId filter, paginated. Also returns a payment-account
// breakdown (sum of paymentMethod.singlePayment + multiplePayment per account)
// for the same filtered date range, independent of pagination.
exports.getSalesInvoiceReport = asynchandeler(async (req, res) => {
  const { startDate, endDate, salesType, customerId, salesMenId, paymentStatus } = req.body || {};
  const { page, limit, skip } = parsePagination(req);

  if (!startDate || !endDate) {
    throw new customError("startDate and endDate are required", statusCodes.BAD_REQUEST);
  }

  const match = { date: { $gte: new Date(startDate), $lte: new Date(endDate) } };
  if (salesType && salesType.trim() !== "") match.salesType = salesType.trim();
  if (paymentStatus && paymentStatus.trim() !== "") match.paymentStatus = paymentStatus.trim();
  castObjectIdFilter(match, "customerType.customerId", customerId);
  castObjectIdFilter(match, "salesMen", salesMenId);

  const cacheKey = await buildCacheKey(
    SALES_NS,
    `report:sales-invoice:${startDate}:${endDate}:${salesType || "all"}:${customerId || "all"}:${salesMenId || "all"}:${paymentStatus || "all"}:p${page}:l${limit}`,
  );
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Sales invoice report fetched successfully",
      { ...cached, fromCache: true },
    );
  }

  const pipeline = [
    { $match: match },
    {
      $lookup: {
        from: "customers",
        localField: "customerType.customerId",
        foreignField: "_id",
        as: "customerInfo",
        pipeline: [{ $project: { fullName: 1, mobileNumber: 1 } }],
      },
    },
    { $unwind: { path: "$customerInfo", preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        discountAmount: { $multiply: ["$total", { $divide: ["$discountPercent", 100] }] },
        vatAmount: { $multiply: ["$total", { $divide: ["$vatPercent", 100] }] },
      },
    },
    {
      $facet: {
        rows: [
          { $sort: { date: -1 } },
          { $skip: skip },
          { $limit: limit },
          {
            $project: {
              _id: 1,
              date: 1,
              invoiceNumber: 1,
              salesType: 1,
              customerName: {
                $ifNull: ["$customerType.walking.customerName", "$customerInfo.fullName"],
              },
              customerPhone: {
                $ifNull: ["$customerType.walking.mobileNumber", "$customerInfo.mobileNumber"],
              },
              total: 1,
              discount: "$discountAmount",
              vat: "$vatAmount",
              delivery: "$deliveryCost",
              labour: "$labourCost",
              payable: 1,
              paid: 1,
              due: "$presentDue",
              paymentStatus: 1,
            },
          },
        ],
        totals: [
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              totalAmount: { $sum: "$total" },
              totalDiscount: { $sum: "$discountAmount" },
              totalVat: { $sum: "$vatAmount" },
              totalDelivery: { $sum: "$deliveryCost" },
              totalLabour: { $sum: "$labourCost" },
              totalPayable: { $sum: "$payable" },
              totalPaid: { $sum: "$paid" },
              totalDue: { $sum: "$presentDue" },
            },
          },
        ],
        accountSummary: [
          {
            $project: {
              payments: {
                $concatArrays: [
                  {
                    $cond: [
                      { $ifNull: ["$paymentMethod.singlePayment.paymentTo", false] },
                      ["$paymentMethod.singlePayment"],
                      [],
                    ],
                  },
                  { $ifNull: ["$paymentMethod.multiplePayment", []] },
                ],
              },
            },
          },
          { $unwind: "$payments" },
          {
            $group: {
              _id: "$payments.paymentTo",
              totalAmount: { $sum: "$payments.amount" },
            },
          },
          {
            $lookup: {
              from: "accounts",
              localField: "_id",
              foreignField: "_id",
              as: "account",
              pipeline: [{ $project: { name: 1 } }],
            },
          },
          { $unwind: { path: "$account", preserveNullAndEmptyArrays: true } },
          {
            $project: {
              _id: 0,
              accountName: { $ifNull: ["$account.name", "Unknown"] },
              totalAmount: 1,
            },
          },
          { $sort: { totalAmount: -1 } },
        ],
      },
    },
  ];

  const [result] = await Sales.aggregate(pipeline);
  const rows = result?.rows || [];
  const totals = result?.totals?.[0] || {
    count: 0,
    totalAmount: 0,
    totalDiscount: 0,
    totalVat: 0,
    totalDelivery: 0,
    totalLabour: 0,
    totalPayable: 0,
    totalPaid: 0,
    totalDue: 0,
  };
  const accountSummary = result?.accountSummary || [];
  const grandTotal = accountSummary.reduce((sum, a) => sum + a.totalAmount, 0);

  const header = await getStoreHeader();

  const payload = {
    header,
    filters: {
      startDate,
      endDate,
      salesType: salesType || "ALL",
      customerId: customerId || null,
      salesMenId: salesMenId || null,
      paymentStatus: paymentStatus || "ALL",
    },
    rows,
    totals: {
      count: totals.count,
      totalAmount: totals.totalAmount,
      totalDiscount: totals.totalDiscount,
      totalVat: totals.totalVat,
      totalDelivery: totals.totalDelivery,
      totalLabour: totals.totalLabour,
      totalPayable: totals.totalPayable,
      totalPaid: totals.totalPaid,
      totalDue: totals.totalDue,
    },
    accountSummary: { accounts: accountSummary, grandTotal },
    pagination: paginationMeta(totals.count, page, limit, skip),
    generatedAt: new Date(),
  };

  await setCache(cacheKey, payload, REPORT_CACHE_TTL);

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Sales invoice report fetched successfully",
    { ...payload, fromCache: false },
  );
});

// @desc Customers that have at least one sale — for the sales report's customer filter dropdown
exports.getSalesInvoiceCustomers = asynchandeler(async (req, res) => {
  const cacheKey = await buildCacheKey(SALES_NS, "report:sales:customers");
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Customer list fetched successfully",
      { customers: cached, fromCache: true },
    );
  }

  const customerIds = await Sales.distinct("customerType.customerId", {
    "customerType.customerId": { $ne: null },
  });

  const customers = await Customer.find({ _id: { $in: customerIds } })
    .select("_id fullName mobileNumber")
    .sort({ fullName: 1 })
    .lean();

  await setCache(cacheKey, customers, REPORT_CACHE_TTL);

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Customer list fetched successfully",
    { customers, fromCache: false },
  );
});

// @desc Employees (salesmen) that have at least one sale — for the sales report's salesperson filter dropdown
exports.getSalesInvoiceSalesmen = asynchandeler(async (req, res) => {
  const cacheKey = await buildCacheKey(SALES_NS, "report:sales:salesmen");
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Salesperson list fetched successfully",
      { salesmen: cached, fromCache: true },
    );
  }

  const salesMenIds = await Sales.distinct("salesMen", { salesMen: { $ne: null } });

  const salesmen = await Employee.find({ _id: { $in: salesMenIds } })
    .select("_id fullName")
    .sort({ fullName: 1 })
    .lean();

  await setCache(cacheKey, salesmen, REPORT_CACHE_TTL);

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Salesperson list fetched successfully",
    { salesmen, fromCache: false },
  );
});

// @desc Sales product report — one row per sold line item (product/variant),
// date range + optional product/salesType/category/subcategory/brand filters.
// Prices come from the sale line where recorded (salesRate/discount/subtotal)
// and from the variant/product for buy & list prices, which the sale does not
// copy at the time of sale.
exports.getSalesProductReport = asynchandeler(async (req, res) => {
  const { startDate, endDate, salesType, productId, category, subCategory, brand } =
    req.body || {};
  const { page, limit, skip } = parsePagination(req);

  if (!startDate || !endDate) {
    throw new customError("startDate and endDate are required", statusCodes.BAD_REQUEST);
  }

  const match = { date: { $gte: new Date(startDate), $lte: new Date(endDate) } };
  if (salesType && salesType.trim() !== "") match.salesType = salesType.trim();

  // Line-item and product-level filters can only run after the $unwind and the
  // product $lookup below, so they are collected here and applied as a second
  // $match rather than being folded into the indexed top-level one.
  const lineMatch = {};
  if (productId) {
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      throw new customError("Invalid productId", statusCodes.BAD_REQUEST);
    }
    // Matches on the resolved product so a variant line whose own productId
    // is unset still matches when its parent product is the one selected.
    lineMatch["resolvedProduct._id"] = new mongoose.Types.ObjectId(productId);
  }
  castObjectIdFilter(lineMatch, "resolvedProduct.category", category);
  castObjectIdFilter(lineMatch, "resolvedProduct.subcategory", subCategory);
  castObjectIdFilter(lineMatch, "resolvedProduct.brand", brand);

  const cacheKey = await buildCacheKey(
    SALES_NS,
    `report:sales-product:${startDate}:${endDate}:${salesType || "all"}:${productId || "all"}:${category || "-"}:${subCategory || "-"}:${brand || "-"}:p${page}:l${limit}`,
  );
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Sales product report fetched successfully",
      { ...cached, fromCache: true },
    );
  }

  const pipeline = [
    { $match: match },
    {
      $lookup: {
        from: "customers",
        localField: "customerType.customerId",
        foreignField: "_id",
        as: "customerInfo",
        pipeline: [{ $project: { fullName: 1, mobileNumber: 1 } }],
      },
    },
    { $unwind: { path: "$customerInfo", preserveNullAndEmptyArrays: true } },
    { $unwind: "$searchItem" },
    {
      $lookup: {
        from: "products",
        localField: "searchItem.productId",
        foreignField: "_id",
        as: "productInfo",
        pipeline: [
          {
            $project: {
              name: 1,
              barCode: 1,
              category: 1,
              subcategory: 1,
              brand: 1,
              color: 1,
              size: 1,
              purchasePrice: 1,
              wholesalePrice: 1,
              retailPrice: 1,
            },
          },
        ],
      },
    },
    { $unwind: { path: "$productInfo", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "variants",
        localField: "searchItem.variantId",
        foreignField: "_id",
        as: "variantInfo",
        pipeline: [
          {
            $project: {
              barCode: 1,
              color: 1,
              size: 1,
              product: 1,
              purchasePrice: 1,
              wholesalePrice: 1,
              retailPrice: 1,
            },
          },
          {
            // A sale line that references a variant may carry no productId of
            // its own, so the parent product is resolved through the variant
            // to get its display name.
            $lookup: {
              from: "products",
              localField: "product",
              foreignField: "_id",
              as: "variantProduct",
              pipeline: [
                {
                  $project: {
                    name: 1,
                    barCode: 1,
                    category: 1,
                    subcategory: 1,
                    brand: 1,
                    color: 1,
                    size: 1,
                    purchasePrice: 1,
                    wholesalePrice: 1,
                    retailPrice: 1,
                  },
                },
              ],
            },
          },
          { $unwind: { path: "$variantProduct", preserveNullAndEmptyArrays: true } },
        ],
      },
    },
    { $unwind: { path: "$variantInfo", preserveNullAndEmptyArrays: true } },
    {
      // A variant line may not carry productId, so the effective product is
      // the directly-joined one when present, otherwise the variant's parent.
      // Filters below match against this rather than productInfo, so variant
      // lines are not silently dropped by a category/brand filter.
      $addFields: {
        resolvedProduct: { $ifNull: ["$productInfo", "$variantInfo.variantProduct"] },
      },
    },
    ...(Object.keys(lineMatch).length > 0 ? [{ $match: lineMatch }] : []),
    {
      // The variant is the more specific record, so its values win where a
      // variant was sold; the product is the fallback for non-variant lines.
      $addFields: {
        lineBuyPrice: {
          $ifNull: ["$variantInfo.purchasePrice", { $ifNull: ["$resolvedProduct.purchasePrice", 0] }],
        },
        lineWsPrice: {
          $ifNull: ["$variantInfo.wholesalePrice", { $ifNull: ["$resolvedProduct.wholesalePrice", 0] }],
        },
        lineRsPrice: {
          $ifNull: ["$variantInfo.retailPrice", { $ifNull: ["$resolvedProduct.retailPrice", 0] }],
        },
        lineDiscount: { $ifNull: ["$searchItem.discount", 0] },
        // "amount" = flat taka off, "percent" = share of the line. Returned so
        // the report can render the right unit instead of guessing.
        lineDiscountType: { $ifNull: ["$searchItem.discountType", "amount"] },
        lineTotal: { $ifNull: ["$searchItem.subtotal", 0] },
        lineQty: { $ifNull: ["$searchItem.quantity", 0] },
      },
    },
    {
      $facet: {
        rows: [
          { $sort: { date: -1 } },
          { $skip: skip },
          { $limit: limit },
          {
            $project: {
              _id: 1,
              date: 1,
              invoiceNumber: 1,
              salesType: 1,
              customerName: {
                $ifNull: ["$customerType.walking.customerName", "$customerInfo.fullName"],
              },
              customerPhone: {
                $ifNull: ["$customerType.walking.mobileNumber", "$customerInfo.mobileNumber"],
              },
              productName: { $ifNull: ["$resolvedProduct.name", "-"] },
              barcode: {
                $ifNull: [
                  "$searchItem.barcode",
                  { $ifNull: ["$variantInfo.barCode", "$resolvedProduct.barCode"] },
                ],
              },
              color: {
                $ifNull: [
                  "$variantInfo.color",
                  { $ifNull: ["$resolvedProduct.color", "$searchItem.color"] },
                ],
              },
              size: {
                $ifNull: [
                  "$variantInfo.size",
                  { $ifNull: ["$resolvedProduct.size", "$searchItem.size"] },
                ],
              },
              qty: "$lineQty",
              buyPrice: "$lineBuyPrice",
              wsPrice: "$lineWsPrice",
              rsPrice: "$lineRsPrice",
              discount: "$lineDiscount",
              discountType: "$lineDiscountType",
              total: "$lineTotal",
            },
          },
        ],
        totals: [
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              totalQty: { $sum: "$lineQty" },
              totalBuyPrice: { $sum: "$lineBuyPrice" },
              totalWsPrice: { $sum: "$lineWsPrice" },
              totalRsPrice: { $sum: "$lineRsPrice" },
              // Percent-type discounts are not taka values, so summing them
              // with flat amounts would produce a meaningless total. Only the
              // taka equivalent of each line is accumulated here.
              totalDiscount: {
                $sum: {
                  $cond: [
                    { $eq: ["$lineDiscountType", "percent"] },
                    {
                      $multiply: [
                        { $ifNull: ["$searchItem.subtotal", 0] },
                        { $divide: ["$lineDiscount", 100] },
                      ],
                    },
                    "$lineDiscount",
                  ],
                },
              },
              totalAmount: { $sum: "$lineTotal" },
            },
          },
        ],
      },
    },
  ];

  const [result] = await Sales.aggregate(pipeline);
  const rows = result?.rows || [];
  const totals = result?.totals?.[0] || {
    count: 0,
    totalQty: 0,
    totalBuyPrice: 0,
    totalWsPrice: 0,
    totalRsPrice: 0,
    totalDiscount: 0,
    totalAmount: 0,
  };

  const header = await getStoreHeader();

  const payload = {
    header,
    filters: {
      startDate,
      endDate,
      salesType: salesType || "ALL",
      product: productId || "ALL",
      category: category || "ALL",
      subCategory: subCategory || "ALL",
      brand: brand || "ALL",
    },
    rows,
    totals: {
      count: totals.count,
      totalQty: totals.totalQty,
      totalBuyPrice: totals.totalBuyPrice,
      totalWsPrice: totals.totalWsPrice,
      totalRsPrice: totals.totalRsPrice,
      totalDiscount: totals.totalDiscount,
      totalAmount: totals.totalAmount,
    },
    pagination: paginationMeta(totals.count, page, limit, skip),
    generatedAt: new Date(),
  };

  await setCache(cacheKey, payload, REPORT_CACHE_TTL);

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Sales product report fetched successfully",
    { ...payload, fromCache: false },
  );
});

// @desc Sales summary report — one row per product/variant sold in the range,
// with a WEIGHTED AVERAGE buy price drawn from purchase history.
//
// Why weighted: the same item is purchased repeatedly at different prices, and
// Product/Variant only keep the LAST one (purchase.controller.js overwrites it
// on every purchase). A plain mean of the distinct prices would let 1 unit at
// 1000 count as much as 10 units at 800. So the average is
// Σ(purchasePrice × quantity) / Σ(quantity), which is exactly
// Σ(subTotal) / Σ(quantity) since subTotal is already price × qty.
//
// Purchases are taken all-time UP TO the report's end date, not only those
// inside the range: an item sold in August may have last been bought in June,
// and range-limiting would give it no purchase rows and an average of 0.
exports.getSalesSummaryReport = asynchandeler(async (req, res) => {
  const { startDate, endDate, salesType, category, subCategory, brand } = req.body || {};
  const { page, limit, skip } = parsePagination(req);

  if (!startDate || !endDate) {
    throw new customError("startDate and endDate are required", statusCodes.BAD_REQUEST);
  }

  const rangeStart = new Date(startDate);
  rangeStart.setHours(0, 0, 0, 0);
  // endDate arrives as a bare day ("2026-09-03"), which parses to midnight and
  // would drop everything recorded later that same day.
  const rangeEnd = new Date(endDate);
  rangeEnd.setHours(23, 59, 59, 999);

  const match = { date: { $gte: rangeStart, $lte: rangeEnd } };
  if (salesType && salesType.trim() !== "") match.salesType = salesType.trim();

  const lineMatch = {};
  castObjectIdFilter(lineMatch, "resolvedProduct.category", category);
  castObjectIdFilter(lineMatch, "resolvedProduct.subcategory", subCategory);
  castObjectIdFilter(lineMatch, "resolvedProduct.brand", brand);

  const cacheKey = await buildCacheKey(
    SALES_NS,
    `report:sales-summary:${startDate}:${endDate}:${salesType || "all"}:${category || "-"}:${subCategory || "-"}:${brand || "-"}:p${page}:l${limit}`,
  );
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Sales summary report fetched successfully",
      { ...cached, fromCache: true },
    );
  }

  // ---- 1. Sold quantity + revenue, grouped per product/variant ----
  const salesPipeline = [
    { $match: match },
    { $unwind: "$searchItem" },
    {
      $lookup: {
        from: "products",
        localField: "searchItem.productId",
        foreignField: "_id",
        as: "productInfo",
        pipeline: [
          { $project: { name: 1, barCode: 1, category: 1, subcategory: 1, brand: 1, color: 1, size: 1 } },
        ],
      },
    },
    { $unwind: { path: "$productInfo", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "variants",
        localField: "searchItem.variantId",
        foreignField: "_id",
        as: "variantInfo",
        pipeline: [
          { $project: { barCode: 1, color: 1, size: 1, product: 1 } },
          {
            $lookup: {
              from: "products",
              localField: "product",
              foreignField: "_id",
              as: "variantProduct",
              pipeline: [
                { $project: { name: 1, barCode: 1, category: 1, subcategory: 1, brand: 1, color: 1, size: 1 } },
              ],
            },
          },
          { $unwind: { path: "$variantProduct", preserveNullAndEmptyArrays: true } },
        ],
      },
    },
    { $unwind: { path: "$variantInfo", preserveNullAndEmptyArrays: true } },
    {
      // A variant sale line often carries no productId of its own, so the
      // parent product is resolved through the variant.
      $addFields: {
        resolvedProduct: { $ifNull: ["$productInfo", "$variantInfo.variantProduct"] },
      },
    },
    ...(Object.keys(lineMatch).length > 0 ? [{ $match: lineMatch }] : []),
    {
      $group: {
        // Variant is the reporting grain where present — the screenshot shows
        // colour/size per row, which only a variant carries.
        _id: { $ifNull: ["$searchItem.variantId", "$resolvedProduct._id"] },
        variantId: { $first: "$searchItem.variantId" },
        productName: { $first: { $ifNull: ["$resolvedProduct.name", "-"] } },
        barcode: {
          $first: {
            $ifNull: [
              "$searchItem.barcode",
              { $ifNull: ["$variantInfo.barCode", "$resolvedProduct.barCode"] },
            ],
          },
        },
        color: {
          $first: {
            $ifNull: [
              "$variantInfo.color",
              { $ifNull: ["$resolvedProduct.color", "$searchItem.color"] },
            ],
          },
        },
        size: {
          $first: {
            $ifNull: [
              "$variantInfo.size",
              { $ifNull: ["$resolvedProduct.size", "$searchItem.size"] },
            ],
          },
        },
        qty: { $sum: { $ifNull: ["$searchItem.quantity", 0] } },
        salesTotal: { $sum: { $ifNull: ["$searchItem.subtotal", 0] } },
      },
    },
    { $sort: { salesTotal: -1 } },
  ];

  const [soldRows, summaryAgg] = await Promise.all([
    Sales.aggregate(salesPipeline),
    // ---- 2. Invoice-level totals for the summary block ----
    Sales.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          salesTotal: { $sum: "$total" },
          // Invoice-level percentage discount.
          discount: {
            $sum: { $multiply: ["$total", { $divide: [{ $ifNull: ["$discountPercent", 0] }, 100] }] },
          },
          // Flat taka knocked off the invoice.
          lessTaka: { $sum: { $ifNull: ["$lessTaka", 0] } },
          // Per-line discount, summed across the invoice's items. discountType
          // decides how searchItem.discount reads: "amount" is taka off each
          // unit, "percent" is a share of that line's gross.
          itemDiscount: {
            $sum: {
              $reduce: {
                input: { $ifNull: ["$searchItem", []] },
                initialValue: 0,
                in: {
                  $add: [
                    "$$value",
                    {
                      $let: {
                        vars: {
                          qty: { $ifNull: ["$$this.quantity", 0] },
                          rate: { $ifNull: ["$$this.salesRate", 0] },
                          disc: { $ifNull: ["$$this.discount", 0] },
                        },
                        in: {
                          $cond: [
                            { $eq: [{ $ifNull: ["$$this.discountType", "amount"] }, "percent"] },
                            {
                              $divide: [
                                { $multiply: ["$$qty", "$$rate", "$$disc"] },
                                100,
                              ],
                            },
                            { $multiply: ["$$qty", "$$disc"] },
                          ],
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          deliveryCost: { $sum: { $ifNull: ["$deliveryCost", 0] } },
          labourCost: { $sum: { $ifNull: ["$labourCost", 0] } },
          payable: { $sum: { $ifNull: ["$payable", 0] } },
          paid: { $sum: { $ifNull: ["$paid", 0] } },
          changes: { $sum: { $ifNull: ["$changes", 0] } },
          // Cash retained. Sales written before netPaid existed have no such
          // field, so fall back to computing it from paid and changes rather
          // than reading those rows as zero.
          netPaid: {
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
          due: { $sum: { $ifNull: ["$presentDue", 0] } },
          invoiceCount: { $sum: 1 },
        },
      },
    ]),
  ]);

  const totalRows = soldRows.length;
  const pagedRows = soldRows.slice(skip, skip + limit);

  // ---- 3. Weighted average buy price, only for the items on this page ----
  const keyIds = pagedRows.map((r) => r._id).filter(Boolean);

  const avgCostRows = keyIds.length
    ? await Purchase.aggregate([
        { $match: { date: { $lte: rangeEnd } } },
        { $unwind: "$allproduct" },
        {
          $addFields: {
            costKey: { $ifNull: ["$allproduct.variant", "$allproduct.product"] },
          },
        },
        { $match: { costKey: { $in: keyIds } } },
        {
          $group: {
            _id: "$costKey",
            // subTotal is already purchasePrice × quantity — this is the
            // weighting, and it is why a plain price average is not used.
            totalCost: { $sum: { $ifNull: ["$allproduct.subTotal", 0] } },
            totalQty: { $sum: { $ifNull: ["$allproduct.quantity", 0] } },
          },
        },
        {
          $project: {
            avgBuyPrice: {
              // Guard the divide: no purchase quantity would yield null and
              // render as an empty cell.
              $cond: [{ $gt: ["$totalQty", 0] }, { $divide: ["$totalCost", "$totalQty"] }, 0],
            },
          },
        },
      ])
    : [];

  const avgCostMap = new Map(avgCostRows.map((r) => [String(r._id), r.avgBuyPrice]));

  const rows = pagedRows.map((r) => {
    const avgBuyPrice = avgCostMap.get(String(r._id)) || 0;
    return {
      _id: String(r._id),
      productName: r.productName,
      barcode: r.barcode || "-",
      color: r.color || "-",
      size: r.size || "-",
      qty: r.qty,
      avgBuyPrice,
      // Realised rate, not the variant's current list price — the same item
      // can be sold at different rates across invoices, so the row must
      // multiply out against its own sales total.
      salesPrice: r.qty > 0 ? r.salesTotal / r.qty : 0,
      salesTotal: r.salesTotal,
      buyTotal: avgBuyPrice * r.qty,
    };
  });

  // ---- 4. Sales returns inside the range ----
  // Returns belong to the period they were made in, not the period of the
  // invoice they point back at — a return raised today against last month's
  // invoice is today's return.
  const [returnAgg] = await SalesReturn.aggregate([
    { $match: { date: { $gte: rangeStart, $lte: rangeEnd } } },
    { $group: { _id: null, totalReturn: { $sum: { $ifNull: ["$totalReturnAmount", 0] } } } },
  ]);

  // ---- 5. Account summary (which account received the money) ----
  const accountRows = await Sales.aggregate([
    { $match: match },
    {
      $project: {
        saleChanges: { $ifNull: ["$changes", 0] },
        payments: {
          $concatArrays: [
            {
              $cond: [
                { $ifNull: ["$paymentMethod.singlePayment.paymentTo", false] },
                ["$paymentMethod.singlePayment"],
                [],
              ],
            },
            { $ifNull: ["$paymentMethod.multiplePayment", []] },
          ],
        },
      },
    },
    // Keep the full entry list beside the unwound one so each entry can see
    // what follows it when the change is apportioned.
    { $addFields: { payments_all: "$payments" } },
    { $unwind: { path: "$payments", includeArrayIndex: "paymentIndex" } },
    // Change handed back reduces what the account actually received, so the
    // entries are scaled down to netPaid. It comes off the last entries first,
    // matching how applySalePayments posts to the accounts — anything else and
    // this summary would disagree with the account balances it reports on.
    {
      $addFields: {
        // Total sitting at or after this entry, so a change bigger than the
        // last entry spills backwards into the one before it.
        amountFromHere: {
          $sum: {
            $slice: ["$payments_all.amount", "$paymentIndex", { $size: "$payments_all" }],
          },
        },
      },
    },
    {
      $addFields: {
        totalAmount: {
          $max: [
            0,
            {
              $subtract: [
                "$payments.amount",
                {
                  $max: [
                    0,
                    {
                      $subtract: [
                        { $ifNull: ["$saleChanges", 0] },
                        { $subtract: ["$amountFromHere", "$payments.amount"] },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
    },
    { $group: { _id: "$payments.paymentTo", totalAmount: { $sum: "$totalAmount" } } },
    {
      $lookup: {
        from: "accounts",
        localField: "_id",
        foreignField: "_id",
        as: "account",
        pipeline: [{ $project: { name: 1 } }],
      },
    },
    { $unwind: { path: "$account", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        accountName: { $ifNull: ["$account.name", "Unknown"] },
        totalAmount: 1,
      },
    },
    { $sort: { totalAmount: -1 } },
  ]);

  const s = summaryAgg[0] || {};
  const header = await getStoreHeader();

  const payload = {
    header,
    filters: {
      startDate,
      endDate,
      salesType: salesType || "ALL",
      category: category || "ALL",
      subCategory: subCategory || "ALL",
      brand: brand || "ALL",
    },
    rows,
    totals: {
      count: totalRows,
      totalQty: rows.reduce((a, r) => a + r.qty, 0),
      // Total cost of goods sold. Deliberately NOT a sum of the per-unit
      // averages above it — adding unrelated per-unit rates is meaningless.
      totalBuyValue: rows.reduce((a, r) => a + r.buyTotal, 0),
      totalSalesValue: rows.reduce((a, r) => a + r.salesTotal, 0),
    },
    summary: {
      salesTotal: s.salesTotal || 0,
      itemDiscount: s.itemDiscount || 0,
      discount: s.discount || 0,
      lessTaka: s.lessTaka || 0,
      returnAmount: returnAgg?.totalReturn || 0,
      deliveryCost: s.deliveryCost || 0,
      labourCost: s.labourCost || 0,
      payable: s.payable || 0,
      paid: s.paid || 0,
      changes: s.changes || 0,
      netPaid: s.netPaid || 0,
      due: s.due || 0,
      invoiceCount: s.invoiceCount || 0,
    },
    accountSummary: {
      accounts: accountRows,
      grandTotal: accountRows.reduce((a, r) => a + r.totalAmount, 0),
    },
    pagination: paginationMeta(totalRows, page, limit, skip),
    generatedAt: new Date(),
  };

  await setCache(cacheKey, payload, REPORT_CACHE_TTL);

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Sales summary report fetched successfully",
    { ...payload, fromCache: false },
  );
});
