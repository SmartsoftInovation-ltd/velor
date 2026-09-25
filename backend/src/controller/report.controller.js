const mongoose = require("mongoose");
const { asynchandeler } = require("../lib/asyncHandeler");
const { customError } = require("../lib/CustomError");
const { apiResponse } = require("../utils/apiResponse");
const { statusCodes } = require("../constant/constant");
const Purchase = require("../models/purchase.model");
const PurchaseReturn = require("../models/purchaseReturn.model");
const Variant = require("../models/variant.model");
const StockAdjust = require("../models/stockadjust.model");
const CourierReturn = require("../models/courierReturn.model");
const Sales = require("../models/sales.model");
const SalesReturn = require("../models/salesReturn.model");
const {
  customerModel: Customer,
  CustomerType,
  customerPaymentRecived: CustomerPaymentRecived,
  customerAdvancePaymentModel: CustomerAdvancePayment,
} = require("../models/customer.model");
const Employee = require("../models/employee.model");
const { employeeAdvancePayment: EmployeeAdvancePayment } = require("../models/advancePayment.model");
const Supplier = require("../models/supplier.model").SupplierModel;
const SupplierDuePayment = require("../models/supplier.model").SupplierDuePayment;
const StoreInformation = require("../models/storeInformation.model");
const Product = require("../models/product.model");
const { buildLowStockStages } = require("../utils/lowStock.util");
const {
  getCache,
  setCache,
  buildCacheKey,
  getNsVersion,
} = require("@/utils/cache.util");

// Shares invalidation with purchase.controller.js (bumpNsVersion("purchase")
// already runs on create/update/delete there) and storeInformation.controller.js
// (bumpNsVersion("storeinformation") on save) — no extra invalidation wiring needed.
const PURCHASE_NS = "purchase";
const SALES_NS = "sales";
const STORE_NS = "storeinformation";
// Matches NS_EMPLOYEE in employee.controller.js, which already bumps this
// namespace on every employee/designation/department/section mutation.
const EMPLOYEE_NS = "employee";
// Matches NS_ADVANCE in employee.controller.js, bumped on every advance
// payment create/update/delete.
const ADVANCE_NS = "employeeAdvance";
const PRODUCT_NS = "product";
const SUPPLIER_NS = "supplier";
// Matches NS_CUSTOMER_PAYMENT in customer.controller.js, bumped on every
// customer payment create/update/delete. The advance-payment side bumps
// NS_CUSTOMER_ADVANCE, so that namespace is folded into the same key below to
// keep the merged report from serving stale rows after an advance changes.
const CUSTOMER_NS = "customer";
// Matches NS in salesReturn.controller.js, bumped on every return write.
const SALES_RETURN_NS = "salesReturn";
const CUSTOMER_PAYMENT_NS = "customerPayment";
const CUSTOMER_ADVANCE_NS = "customerAdvance";
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

  // Purchase now stores paymentStatus (see purchase.model.js), so the filter
  // folds into the indexed top-level $match instead of an $expr stage that no
  // index can serve.
  const status = (paymentStatus || "").trim();
  if (status) match.paymentStatus = status;

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
              paymentStatus: 1,
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

// Sale rows are labelled by what kind of sale moved the stock, so a ledger
// distinguishes a POS retail sale from a web order at a glance.
const SALES_TYPE_ACTION = {
  retailsale: "Retail Sale",
  wholesale: "Wholesale",
  retailsaleorder: "Retail Sale Order",
  wholesaleorder: "Wholesale Order",
};

// @desc Product ledger — every stock movement for ONE product or variant, in
// date order, with a running balance. Opening stock is the item's initialStock
// and every later row comes from the collection that actually moved the stock:
// purchases and their returns, sales (by sales type) and their returns, courier
// returns, and manual stock adjustments.
exports.getProductLedgerReport = asynchandeler(async (req, res) => {
  const { productId, variantId, startDate, endDate } = req.body || {};

  if (!productId && !variantId) {
    throw new customError("productId or variantId is required", statusCodes.BAD_REQUEST);
  }
  if (productId && !mongoose.Types.ObjectId.isValid(productId)) {
    throw new customError("Invalid productId", statusCodes.BAD_REQUEST);
  }
  if (variantId && !mongoose.Types.ObjectId.isValid(variantId)) {
    throw new customError("Invalid variantId", statusCodes.BAD_REQUEST);
  }

  const variantOid = variantId ? new mongoose.Types.ObjectId(variantId) : null;
  const productOid = productId ? new mongoose.Types.ObjectId(productId) : null;

  const cacheKey = await buildCacheKey(
    PRODUCT_NS,
    `report:product-ledger:${productId || "-"}:${variantId || "-"}:${startDate || "-"}:${endDate || "-"}`,
  );
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(res, statusCodes.OK, "Product ledger fetched successfully", {
      ...cached,
      fromCache: true,
    });
  }

  // Identify the item first: its name/barcode/colour/size label the sheet, and
  // its initialStock is the opening row.
  let item = null;
  if (variantOid) {
    const variant = await Variant.findById(variantOid)
      .select("variantName barCode sku size color initialStock product createdAt")
      .populate("product", "name")
      .lean();
    if (!variant) throw new customError("Variant not found", statusCodes.NOT_FOUND);
    item = {
      productId: variant.product?._id || null,
      variantId: variant._id,
      productName: variant.product?.name || variant.variantName || "-",
      variantName: variant.variantName || "",
      barcode: variant.barCode || variant.sku || "-",
      color: variant.color || "-",
      size: variant.size || "-",
      openingStock: variant.initialStock || 0,
      createdAt: variant.createdAt,
    };
  } else {
    const product = await Product.findById(productOid)
      .select("name barCode sku size color initialStock createdAt")
      .lean();
    if (!product) throw new customError("Product not found", statusCodes.NOT_FOUND);
    item = {
      productId: product._id,
      variantId: null,
      productName: product.name,
      variantName: "",
      barcode: product.barCode || product.sku || "-",
      color: product.color || "-",
      size: product.size || "-",
      openingStock: product.initialStock || 0,
      createdAt: product.createdAt,
    };
  }

  // Each source matches on whichever id the caller gave: a variant ledger only
  // counts lines naming that variant, a product ledger only lines naming the
  // product directly (its variants have their own ledgers).
  const lineMatch = (productField, variantField) =>
    variantOid ? { [variantField]: variantOid } : { [productField]: productOid };

  const dateFilter = (field) => {
    const range = {};
    if (startDate) range.$gte = new Date(startDate);
    if (endDate) range.$lte = new Date(endDate);
    return Object.keys(range).length > 0 ? [{ $match: { [field]: range } }] : [];
  };

  // ---- Purchases: stock in ----
  const purchaseRows = await Purchase.aggregate([
    ...dateFilter("date"),
    { $unwind: "$allproduct" },
    { $match: lineMatch("allproduct.product", "allproduct.variant") },
    {
      $project: {
        _id: 0,
        date: "$date",
        action: "Purchase",
        reference: { $ifNull: ["$serial", "$invoiceNumber"] },
        stockIn: { $ifNull: ["$allproduct.quantity", 0] },
        stockOut: { $literal: 0 },
      },
    },
  ]);

  // ---- Purchase returns: stock out ----
  const purchaseReturnRows = await PurchaseReturn.aggregate([
    ...dateFilter("returnDate"),
    { $unwind: "$products" },
    { $match: lineMatch("products.product", "products.variant") },
    {
      $project: {
        _id: 0,
        date: "$returnDate",
        action: "Purchase Return",
        reference: "$serial",
        stockIn: { $literal: 0 },
        stockOut: { $ifNull: ["$products.quantity", 0] },
      },
    },
  ]);

  // ---- Sales: stock out, labelled by sales type ----
  const salesRows = await Sales.aggregate([
    ...dateFilter("date"),
    { $unwind: "$searchItem" },
    { $match: lineMatch("searchItem.productId", "searchItem.variantId") },
    {
      $project: {
        _id: 0,
        date: "$date",
        action: {
          $switch: {
            branches: Object.entries(SALES_TYPE_ACTION).map(([value, label]) => ({
              case: { $eq: ["$salesType", value] },
              then: label,
            })),
            default: "Sold",
          },
        },
        reference: "$invoiceNumber",
        stockIn: { $literal: 0 },
        stockOut: { $ifNull: ["$searchItem.quantity", 0] },
      },
    },
  ]);

  // ---- Sales returns: stock in ----
  const salesReturnRows = await SalesReturn.aggregate([
    ...dateFilter("date"),
    { $unwind: "$allproduct" },
    { $match: lineMatch("allproduct.product", "allproduct.variant") },
    {
      $project: {
        _id: 0,
        date: "$date",
        action: "Sales Return",
        reference: "$invoiceNumber",
        stockIn: { $ifNull: ["$allproduct.quantity", 0] },
        stockOut: { $literal: 0 },
      },
    },
  ]);

  // ---- Courier returns: stock in (no date field of its own, uses createdAt) ----
  const courierReturnRows = await CourierReturn.aggregate([
    ...dateFilter("createdAt"),
    { $match: lineMatch("product", "variant") },
    {
      $project: {
        _id: 0,
        date: "$createdAt",
        action: "Courier Return",
        reference: { $ifNull: [{ $toString: "$orderId" }, "-"] },
        stockIn: { $ifNull: ["$receivedQuantity", 0] },
        stockOut: { $literal: 0 },
      },
    },
  ]);

  // ---- Manual adjustments: one row per direction, so a single adjustment that
  // both adds and removes shows as two clearly-signed lines ----
  const adjustDocs = await StockAdjust.aggregate([
    ...dateFilter("date"),
    { $match: lineMatch("productId", "variantId") },
    {
      $project: {
        _id: 1,
        date: 1,
        adjustReason: 1,
        increaseQuantity: { $ifNull: ["$increaseQuantity", 0] },
        decreaseQuantity: { $ifNull: ["$decreaseQuantity", 0] },
      },
    },
  ]);

  const adjustRows = [];
  for (const a of adjustDocs) {
    const reference = a.adjustReason || String(a._id);
    if (a.increaseQuantity > 0) {
      adjustRows.push({
        date: a.date,
        action: "Adjust Plus (+)",
        reference,
        stockIn: a.increaseQuantity,
        stockOut: { $literal: 0 },
      });
    }
    if (a.decreaseQuantity > 0) {
      adjustRows.push({
        date: a.date,
        action: "Adjust Minus (-)",
        reference,
        stockIn: { $literal: 0 },
        stockOut: a.decreaseQuantity,
      });
    }
  }

  const movements = [
    ...purchaseRows,
    ...purchaseReturnRows,
    ...salesRows,
    ...salesReturnRows,
    ...courierReturnRows,
    ...adjustRows,
  ].sort((a, b) => new Date(a.date) - new Date(b.date));

  // The opening row carries the item's initialStock and is dated to the start
  // of the requested range (the item's creation date when no range was given),
  // since initialStock has no date of its own.
  const openingDate = startDate ? new Date(startDate) : item.createdAt || new Date();
  const rows = [
    {
      date: openingDate,
      action: "Opening",
      reference: "N/A",
      stockIn: item.openingStock,
      stockOut: 0,
    },
    ...movements,
  ];

  let balance = 0;
  const ledger = rows.map((r, idx) => {
    balance += (r.stockIn || 0) - (r.stockOut || 0);
    return {
      _id: `${idx}`,
      sl: idx + 1,
      date: r.date,
      action: r.action,
      reference: r.reference || "-",
      stockIn: r.stockIn || 0,
      stockOut: r.stockOut || 0,
      balance,
    };
  });

  const totals = ledger.reduce(
    (acc, r) => ({
      count: acc.count + 1,
      totalStockIn: acc.totalStockIn + r.stockIn,
      totalStockOut: acc.totalStockOut + r.stockOut,
      balance: r.balance,
    }),
    { count: 0, totalStockIn: 0, totalStockOut: 0, balance: 0 },
  );

  const header = await getStoreHeader();

  const payload = {
    header,
    item,
    filters: {
      productId: productId || null,
      variantId: variantId || null,
      startDate: startDate || "",
      endDate: endDate || "",
    },
    rows: ledger,
    totals,
    generatedAt: new Date(),
  };

  await setCache(cacheKey, payload, REPORT_CACHE_TTL);

  apiResponse.sendSuccess(res, statusCodes.OK, "Product ledger fetched successfully", {
    ...payload,
    fromCache: false,
  });
});

// @desc Selectable items for the product ledger's picker — every variant plus
// every product that has none, each with the barcode/colour/size the ledger
// header shows, so one search box can find an item by name or by barcode.
exports.getLedgerItems = asynchandeler(async (req, res) => {
  const search = (req.query.search || "").trim();

  const cacheKey = await buildCacheKey(PRODUCT_NS, `report:ledger-items:${search.toLowerCase()}`);
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(res, statusCodes.OK, "Ledger items fetched successfully", {
      items: cached,
      fromCache: true,
    });
  }

  const rx = search ? new RegExp(search, "i") : null;

  const variants = await Variant.find({
    isActive: { $ne: false },
    ...(rx ? { $or: [{ variantName: rx }, { barCode: rx }, { sku: rx }] } : {}),
  })
    .select("variantName barCode sku size color product")
    .populate("product", "name")
    .limit(500)
    .lean();

  const productsWithoutVariants = await Product.aggregate([
    { $match: { isActive: { $ne: false }, ...(rx ? { $or: [{ name: rx }, { barCode: rx }, { sku: rx }] } : {}) } },
    {
      $lookup: {
        from: "variants",
        localField: "_id",
        foreignField: "product",
        as: "variants",
        pipeline: [{ $match: { isActive: { $ne: false } } }, { $project: { _id: 1 } }],
      },
    },
    { $match: { variants: { $size: 0 } } },
    { $limit: 500 },
    { $project: { name: 1, barCode: 1, sku: 1, size: 1, color: 1 } },
  ]);

  const items = [
    ...variants.map((v) => ({
      productId: v.product?._id || null,
      variantId: v._id,
      productName: v.product?.name || v.variantName || "-",
      variantName: v.variantName || "",
      barcode: v.barCode || v.sku || "",
      color: v.color || "",
      size: v.size || "",
    })),
    ...productsWithoutVariants.map((p) => ({
      productId: p._id,
      variantId: null,
      productName: p.name,
      variantName: "",
      barcode: p.barCode || p.sku || "",
      color: p.color || "",
      size: p.size || "",
    })),
  ].sort((a, b) => a.productName.localeCompare(b.productName));

  await setCache(cacheKey, items, REPORT_CACHE_TTL);

  apiResponse.sendSuccess(res, statusCodes.OK, "Ledger items fetched successfully", {
    items,
    fromCache: false,
  });
});

// Preferred order for the size columns on the size & colour stock sheet. A size
// that is not on this list (a numeric waist, a free-form label) still gets its
// own column, sorted after these and numerically where it can be.
const SIZE_ORDER = [
  "XS", "S", "M", "L", "XL", "2XL", "XXL", "3XL", "XXXL", "4XL", "5XL", "6XL", "7XL", "8XL",
];

const sizeSortKey = (label) => {
  const idx = SIZE_ORDER.indexOf(label.toUpperCase());
  if (idx !== -1) return [0, idx, label];
  const n = parseFloat(label);
  if (!Number.isNaN(n)) return [1, n, label];
  return [2, 0, label];
};

const compareSizes = (a, b) => {
  const ka = sizeSortKey(a);
  const kb = sizeSortKey(b);
  if (ka[0] !== kb[0]) return ka[0] - kb[0];
  if (ka[1] !== kb[1]) return ka[1] - kb[1];
  return String(ka[2]).localeCompare(String(kb[2]));
};

// @desc Size & colour stock report — with groupBy "color" (the default) one row
// per product + colour; with groupBy "product" one row per product, colours
// folded together, which is the Size Wise Stock view. Either way the stock of
// each size is spread across size columns taken from whatever sizes the
// filtered data actually uses (a store may label sizes S/M/L, 30/32/34, or
// anything else), ordered smallest to largest. BUY RATE is the purchase price
// of the row's variants and VALUE is buy rate x the row's total stock.
exports.getSizeColorStockReport = asynchandeler(async (req, res) => {
  const { category, subCategory, brand, productId, search, inStockOnly, groupBy } =
    req.body || {};
  const byProduct = groupBy === "product";
  const { page, limit, skip } = parsePagination(req);

  const productMatch = { isActive: { $ne: false } };
  castObjectIdFilter(productMatch, "category", category);
  castObjectIdFilter(productMatch, "subcategory", subCategory);
  castObjectIdFilter(productMatch, "brand", brand);
  castObjectIdFilter(productMatch, "_id", productId);

  const searchTerm = (search || "").trim();

  const cacheKey = await buildCacheKey(
    PRODUCT_NS,
    `report:size-color-stock:${byProduct ? "product" : "color"}:${category || "-"}:${subCategory || "-"}:${brand || "-"}:${productId || "-"}:${searchTerm.toLowerCase()}:${inStockOnly ? "instock" : "all"}:p${page}:l${limit}`,
  );
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(res, statusCodes.OK, "Size & colour stock fetched successfully", {
      ...cached,
      fromCache: true,
    });
  }

  // Variants carry the size/colour/stock; the product carries the filters, so
  // the join runs variant-first and matches the product afterwards.
  const pipeline = [
    { $match: { isActive: { $ne: false } } },
    {
      $lookup: {
        from: "products",
        localField: "product",
        foreignField: "_id",
        as: "productInfo",
        pipeline: [
          { $match: productMatch },
          { $project: { name: 1, barCode: 1, sku: 1, purchasePrice: 1 } },
        ],
      },
    },
    { $unwind: "$productInfo" },
  ];

  if (searchTerm) {
    const isBarcode = /^\d{6,20}$/.test(searchTerm);
    pipeline.push({
      $match: isBarcode
        ? { $or: [{ barCode: searchTerm }, { "productInfo.barCode": searchTerm }] }
        : {
            $or: [
              { "productInfo.name": { $regex: searchTerm, $options: "i" } },
              { variantName: { $regex: searchTerm, $options: "i" } },
              { barCode: { $regex: searchTerm, $options: "i" } },
            ],
          },
    });
  }

  pipeline.push(
    {
      $addFields: {
        rowColor: {
          $let: {
            vars: { c: { $trim: { input: { $ifNull: ["$color", ""] } } } },
            in: { $cond: [{ $eq: ["$$c", ""] }, "N/A", "$$c"] },
          },
        },
        rowSize: {
          $let: {
            vars: { z: { $trim: { input: { $ifNull: ["$size", ""] } } } },
            in: { $cond: [{ $eq: ["$$z", ""] }, "N/A", "$$z"] },
          },
        },
        rowStock: { $ifNull: ["$stockVariant", 0] },
        rowBuyRate: { $ifNull: ["$purchasePrice", "$productInfo.purchasePrice"] },
      },
    },
    // One row per product (+ colour unless grouping by product); every variant
    // in the group folds in, its size kept alongside its stock so the size
    // columns can be filled below.
    {
      $group: {
        _id: byProduct
          ? { product: "$productInfo._id" }
          : { product: "$productInfo._id", color: "$rowColor" },
        productName: { $first: "$productInfo.name" },
        barcode: { $first: { $ifNull: ["$productInfo.barCode", { $ifNull: ["$barCode", "$sku"] }] } },
        color: { $first: "$rowColor" },
        colors: { $addToSet: "$rowColor" },
        // Sizes are averaged into one buy rate only when a colour's variants
        // disagree; normally they share a price.
        buyRate: { $avg: "$rowBuyRate" },
        total: { $sum: "$rowStock" },
        sizeEntries: { $push: { size: "$rowSize", stock: "$rowStock" } },
      },
    },
    { $addFields: { value: { $multiply: [{ $ifNull: ["$buyRate", 0] }, "$total"] } } },
  );

  if (inStockOnly) {
    pipeline.push({ $match: { total: { $gt: 0 } } });
  }

  pipeline.push({
    $facet: {
      rows: [{ $sort: { productName: 1, color: 1 } }, { $skip: skip }, { $limit: limit }],
      totals: [
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            totalBuyRate: { $sum: { $ifNull: ["$buyRate", 0] } },
            totalStock: { $sum: "$total" },
            totalValue: { $sum: "$value" },
            sizeEntries: { $push: "$sizeEntries" },
          },
        },
      ],
    },
  });

  const [result] = await Variant.aggregate(pipeline);
  const rawRows = result?.rows || [];
  const rawTotals = result?.totals?.[0];

  // Column set comes from the whole filtered result, not just this page, so the
  // columns stay put while paging through.
  const sizeTotals = {};
  for (const group of rawTotals?.sizeEntries || []) {
    for (const e of group) {
      sizeTotals[e.size] = (sizeTotals[e.size] || 0) + (e.stock || 0);
    }
  }
  const sizeColumns = Object.keys(sizeTotals).sort(compareSizes);

  const rows = rawRows.map((r) => {
    const sizeStock = Object.fromEntries(sizeColumns.map((z) => [z, 0]));
    const present = [];
    for (const e of r.sizeEntries || []) {
      if (sizeStock[e.size] === undefined) sizeStock[e.size] = 0;
      sizeStock[e.size] += e.stock || 0;
      if (!present.includes(e.size)) present.push(e.size);
    }
    // Grouping by product folds several colours into one row, so the colour
    // cell lists them all rather than showing whichever happened to be first.
    const colorLabel = byProduct
      ? (r.colors || []).filter((c) => c && c !== "N/A").sort().join(", ") || "-"
      : r.color || "-";
    return {
      _id: byProduct ? String(r._id.product) : `${r._id.product}-${r._id.color}`,
      productName: r.productName || "-",
      barcode: r.barcode || "-",
      color: colorLabel,
      size: present.filter((z) => z !== "N/A").sort(compareSizes).join(", ") || "-",
      buyRate: r.buyRate || 0,
      sizeStock,
      total: r.total || 0,
      value: r.value || 0,
    };
  });

  const totals = {
    count: rawTotals?.count || 0,
    totalBuyRate: rawTotals?.totalBuyRate || 0,
    totalStock: rawTotals?.totalStock || 0,
    totalValue: rawTotals?.totalValue || 0,
    sizeStock: sizeTotals,
  };

  const header = await getStoreHeader();

  const payload = {
    header,
    sizeColumns,
    filters: {
      groupBy: byProduct ? "product" : "color",
      category: category || "ALL",
      subCategory: subCategory || "ALL",
      brand: brand || "ALL",
      productId: productId || null,
      search: searchTerm || "",
      inStockOnly: !!inStockOnly,
    },
    rows,
    totals,
    pagination: paginationMeta(totals.count, page, limit, skip),
    generatedAt: new Date(),
  };

  await setCache(cacheKey, payload, REPORT_CACHE_TTL);

  apiResponse.sendSuccess(res, statusCodes.OK, "Size & colour stock fetched successfully", {
    ...payload,
    fromCache: false,
  });
});

// @desc Stock adjustment report — one row per manual adjustment, showing what
// was adjusted and by how much in each direction. StockAdjust has no serial of
// its own, so the ADJUST ID is derived from the document id, which is stable
// and unique.
exports.getStockAdjustmentReport = asynchandeler(async (req, res) => {
  const { startDate, endDate, productId, category, subCategory, brand, search } = req.body || {};
  const { page, limit, skip } = parsePagination(req);

  const match = {};
  if (startDate || endDate) {
    match.date = {};
    if (startDate) match.date.$gte = new Date(startDate);
    if (endDate) match.date.$lte = new Date(endDate);
  }
  castObjectIdFilter(match, "productId", productId);

  const searchTerm = (search || "").trim();

  const cacheKey = await buildCacheKey(
    PRODUCT_NS,
    `report:stock-adjustment:${startDate || "-"}:${endDate || "-"}:${productId || "-"}:${category || "-"}:${subCategory || "-"}:${brand || "-"}:${searchTerm.toLowerCase()}:p${page}:l${limit}`,
  );
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(res, statusCodes.OK, "Stock adjustment report fetched successfully", {
      ...cached,
      fromCache: true,
    });
  }

  // An adjustment names either a product or a variant; category/brand live on
  // the product, so both paths resolve to a product before those filters run.
  const pipeline = [
    { $match: match },
    {
      $lookup: {
        from: "products",
        localField: "productId",
        foreignField: "_id",
        as: "productInfo",
        pipeline: [
          { $project: { name: 1, barCode: 1, sku: 1, size: 1, color: 1, category: 1, subcategory: 1, brand: 1 } },
        ],
      },
    },
    { $unwind: { path: "$productInfo", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "variants",
        localField: "variantId",
        foreignField: "_id",
        as: "variantInfo",
        pipeline: [
          { $project: { variantName: 1, barCode: 1, sku: 1, size: 1, color: 1, product: 1 } },
          {
            $lookup: {
              from: "products",
              localField: "product",
              foreignField: "_id",
              as: "variantProduct",
              pipeline: [
                { $project: { name: 1, barCode: 1, category: 1, subcategory: 1, brand: 1 } },
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
        rowProductName: {
          $ifNull: ["$productInfo.name", "$variantInfo.variantProduct.name"],
        },
        rowBarcode: {
          $ifNull: [
            "$variantInfo.barCode",
            { $ifNull: ["$variantInfo.sku", { $ifNull: ["$productInfo.barCode", "$productInfo.sku"] }] },
          ],
        },
        rowColor: { $ifNull: ["$variantInfo.color", "$productInfo.color"] },
        rowSize: { $ifNull: ["$variantInfo.size", "$productInfo.size"] },
        rowCategory: { $ifNull: ["$productInfo.category", "$variantInfo.variantProduct.category"] },
        rowSubCategory: {
          $ifNull: ["$productInfo.subcategory", "$variantInfo.variantProduct.subcategory"],
        },
        rowBrand: { $ifNull: ["$productInfo.brand", "$variantInfo.variantProduct.brand"] },
        rowAdjPlus: { $ifNull: ["$increaseQuantity", 0] },
        rowAdjMinus: { $ifNull: ["$decreaseQuantity", 0] },
      },
    },
  ];

  const classMatch = {};
  const addClass = (field, value, label) => {
    if (!value) return;
    if (!mongoose.Types.ObjectId.isValid(value)) {
      throw new customError(`Invalid ${label}`, statusCodes.BAD_REQUEST);
    }
    classMatch[field] = new mongoose.Types.ObjectId(value);
  };
  addClass("rowCategory", category, "category");
  addClass("rowSubCategory", subCategory, "subCategory");
  addClass("rowBrand", brand, "brand");
  if (Object.keys(classMatch).length > 0) pipeline.push({ $match: classMatch });

  if (searchTerm) {
    const isBarcode = /^\d{6,20}$/.test(searchTerm);
    pipeline.push({
      $match: isBarcode
        ? { rowBarcode: searchTerm }
        : {
            $or: [
              { rowProductName: { $regex: searchTerm, $options: "i" } },
              { rowBarcode: { $regex: searchTerm, $options: "i" } },
              { adjustReason: { $regex: searchTerm, $options: "i" } },
            ],
          },
    });
  }

  pipeline.push({
    $facet: {
      rows: [
        { $sort: { date: -1 } },
        { $skip: skip },
        { $limit: limit },
        {
          $project: {
            _id: 1,
            date: 1,
            // e.g. SADJ-4F32A9 — derived from the document id since the model
            // carries no serial.
            adjustId: {
              $concat: [
                "SADJ-",
                { $toUpper: { $substrCP: [{ $toString: "$_id" }, 18, 6] } },
              ],
            },
            productName: { $ifNull: ["$rowProductName", "-"] },
            barcode: { $ifNull: ["$rowBarcode", "-"] },
            color: { $ifNull: ["$rowColor", "-"] },
            size: { $ifNull: ["$rowSize", "-"] },
            reason: { $ifNull: ["$adjustReason", "-"] },
            adjPlus: "$rowAdjPlus",
            adjMinus: "$rowAdjMinus",
          },
        },
      ],
      totals: [
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            totalAdjPlus: { $sum: "$rowAdjPlus" },
            totalAdjMinus: { $sum: "$rowAdjMinus" },
          },
        },
      ],
      // How many times each product was adjusted in the filtered range — the
      // report's "koto bar adjust hoyeche" summary.
      byProduct: [
        {
          $group: {
            _id: { $ifNull: ["$rowProductName", "-"] },
            adjustments: { $sum: 1 },
            adjPlus: { $sum: "$rowAdjPlus" },
            adjMinus: { $sum: "$rowAdjMinus" },
          },
        },
        { $sort: { adjustments: -1, _id: 1 } },
        { $limit: 50 },
        {
          $project: {
            _id: 0,
            productName: "$_id",
            adjustments: 1,
            adjPlus: 1,
            adjMinus: 1,
          },
        },
      ],
    },
  });

  const [result] = await StockAdjust.aggregate(pipeline);
  const rows = result?.rows || [];
  const totals = result?.totals?.[0] || { count: 0, totalAdjPlus: 0, totalAdjMinus: 0 };
  const byProduct = result?.byProduct || [];

  const header = await getStoreHeader();

  const payload = {
    header,
    filters: {
      startDate: startDate || "",
      endDate: endDate || "",
      productId: productId || null,
      category: category || "ALL",
      subCategory: subCategory || "ALL",
      brand: brand || "ALL",
      search: searchTerm || "",
    },
    rows,
    byProduct,
    totals: {
      count: totals.count,
      totalAdjPlus: totals.totalAdjPlus,
      totalAdjMinus: totals.totalAdjMinus,
    },
    pagination: paginationMeta(totals.count, page, limit, skip),
    generatedAt: new Date(),
  };

  await setCache(cacheKey, payload, REPORT_CACHE_TTL);

  apiResponse.sendSuccess(res, statusCodes.OK, "Stock adjustment report fetched successfully", {
    ...payload,
    fromCache: false,
  });
});

// @desc Low stock alert report — every sellable item whose stock has fallen to
// or below its alert quantity. Stock is a snapshot, so the optional date range
// filters by when the item was created rather than by movement. BUY RATE is the
// purchase price, and GROUP QTY reads the stock in group units.
exports.getLowStockReport = asynchandeler(async (req, res) => {
  const { startDate, endDate, productId, category, subCategory, brand, search } = req.body || {};
  const { page, limit, skip } = parsePagination(req);

  const match = { isActive: { $ne: false } };
  castObjectIdFilter(match, "category", category);
  castObjectIdFilter(match, "subcategory", subCategory);
  castObjectIdFilter(match, "brand", brand);
  castObjectIdFilter(match, "_id", productId);
  if (startDate || endDate) {
    match.createdAt = {};
    if (startDate) match.createdAt.$gte = new Date(startDate);
    if (endDate) match.createdAt.$lte = new Date(endDate);
  }

  const searchTerm = (search || "").trim();

  const cacheKey = await buildCacheKey(
    PRODUCT_NS,
    `report:low-stock:${startDate || "-"}:${endDate || "-"}:${productId || "-"}:${category || "-"}:${subCategory || "-"}:${brand || "-"}:${searchTerm.toLowerCase()}:p${page}:l${limit}`,
  );
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(res, statusCodes.OK, "Low stock report fetched successfully", {
      ...cached,
      fromCache: true,
    });
  }

  const pipeline = buildLowStockStages(match);

  if (searchTerm) {
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

  pipeline.push({
    $facet: {
      rows: [
        // Worst shortfall first, so what needs reordering most is on page one.
        { $sort: { rowShortfall: -1, name: 1 } },
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
            alertQty: "$rowAlertQty",
            shortfall: "$rowShortfall",
          },
        },
      ],
      totals: [
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            totalBuyRate: { $sum: "$rowBuyRate" },
            totalStock: { $sum: "$rowStock" },
            totalAlertQty: { $sum: "$rowAlertQty" },
            outOfStock: { $sum: { $cond: [{ $lte: ["$rowStock", 0] }, 1, 0] } },
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
    totalStock: 0,
    totalAlertQty: 0,
    outOfStock: 0,
  };

  const header = await getStoreHeader();

  const payload = {
    header,
    filters: {
      startDate: startDate || "",
      endDate: endDate || "",
      productId: productId || null,
      category: category || "ALL",
      subCategory: subCategory || "ALL",
      brand: brand || "ALL",
      search: searchTerm || "",
    },
    rows,
    totals: {
      count: totals.count,
      totalBuyRate: totals.totalBuyRate,
      totalStock: totals.totalStock,
      totalAlertQty: totals.totalAlertQty,
      outOfStock: totals.outOfStock,
    },
    pagination: paginationMeta(totals.count, page, limit, skip),
    generatedAt: new Date(),
  };

  await setCache(cacheKey, payload, REPORT_CACHE_TTL);

  apiResponse.sendSuccess(res, statusCodes.OK, "Low stock report fetched successfully", {
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

// @desc Employee list report — full employee roster with contact, designation,
// department/section and salary details. Optional designation/department/
// section/status filters, paginated. Unlike the purchase/sales reports this is
// a roster snapshot rather than a period-bound transaction report, so no date
// range is required.
exports.getEmployeeListReport = asynchandeler(async (req, res) => {
  const { designation, department, section, status } = req.body || {};
  const { page, limit, skip } = parsePagination(req);

  const match = { isDeleted: { $ne: true } };
  castObjectIdFilter(match, "designation", designation);
  castObjectIdFilter(match, "deapartment", department);
  castObjectIdFilter(match, "section", section);
  if (status === "active") match.isActive = true;
  else if (status === "inactive") match.isActive = false;

  const cacheKey = await buildCacheKey(
    EMPLOYEE_NS,
    `report:employee-list:${designation || "all"}:${department || "all"}:${section || "all"}:${status || "all"}:p${page}:l${limit}`,
  );
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Employee list report fetched successfully",
      { ...cached, fromCache: true },
    );
  }

  const [employees, count, salaryAgg] = await Promise.all([
    Employee.find(match)
      .populate("designation", "name")
      .populate("deapartment", "name")
      .populate("section", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select(
        "employeeId fullName mobile email gender nidNumber dateOfBirth religion designation joiningDate referenceMobile bloodGroup deapartment section salary isActive",
      )
      .lean(),
    Employee.countDocuments(match),
    Employee.aggregate([
      { $match: match },
      { $group: { _id: null, totalSalary: { $sum: { $ifNull: ["$salary.netSalary", 0] } } } },
    ]),
  ]);

  const rows = employees.map((e) => ({
    _id: e._id,
    employeeId: e.employeeId,
    fullName: e.fullName,
    mobile: e.mobile,
    email: e.email,
    gender: e.gender,
    nidNumber: e.nidNumber,
    dateOfBirth: e.dateOfBirth,
    religion: e.religion,
    designationName: e.designation?.name || "-",
    joiningDate: e.joiningDate,
    referenceMobile: e.referenceMobile,
    bloodGroup: e.bloodGroup,
    departmentName: e.deapartment?.name || "-",
    sectionName: e.section?.name || "-",
    netSalary: e.salary?.netSalary || 0,
    isActive: e.isActive,
  }));

  const totalSalary = salaryAgg?.[0]?.totalSalary || 0;
  const header = await getStoreHeader();

  const payload = {
    header,
    filters: {
      designation: designation || null,
      department: department || null,
      section: section || null,
      status: status || "ALL",
    },
    rows,
    totals: { count, totalSalary },
    pagination: paginationMeta(count, page, limit, skip),
    generatedAt: new Date(),
  };

  await setCache(cacheKey, payload, REPORT_CACHE_TTL);

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Employee list report fetched successfully",
    { ...payload, fromCache: false },
  );
});

// @desc Employee payment report — one row per advance payment record, date
// range + optional employee filter, paginated. BALANCE is the employee's net
// salary minus the amount paid on that record — the same rule
// createEmployeeAdvancePayment already enforces (amount can never exceed
// netSalary), so this mirrors it rather than reading a stored balance field
// (the schema never actually persists one).
exports.getEmployeePaymentReport = asynchandeler(async (req, res) => {
  const { startDate, endDate, employeeId } = req.body || {};
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
  castObjectIdFilter(match, "employeeId", employeeId);

  const cacheKey = await buildCacheKey(
    ADVANCE_NS,
    `report:employee-payment:${startDate}:${endDate}:${employeeId || "all"}:p${page}:l${limit}`,
  );
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Employee payment report fetched successfully",
      { ...cached, fromCache: true },
    );
  }

  const pipeline = [
    { $match: match },
    {
      $lookup: {
        from: "employees",
        localField: "employeeId",
        foreignField: "_id",
        as: "employee",
        pipeline: [{ $project: { employeeId: 1, fullName: 1, designation: 1, salary: 1 } }],
      },
    },
    { $unwind: { path: "$employee", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "employeedesignations",
        localField: "employee.designation",
        foreignField: "_id",
        as: "designationInfo",
        pipeline: [{ $project: { name: 1 } }],
      },
    },
    { $unwind: { path: "$designationInfo", preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        netSalary: { $ifNull: ["$employee.salary.netSalary", 0] },
        lineBalance: {
          $subtract: [{ $ifNull: ["$employee.salary.netSalary", 0] }, { $ifNull: ["$amount", 0] }],
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
              month: 1,
              paymentMode: 1,
              employeeId: { $ifNull: ["$employee.employeeId", "-"] },
              fullName: { $ifNull: ["$employee.fullName", "-"] },
              designationName: { $ifNull: ["$designationInfo.name", "-"] },
              salary: "$netSalary",
              amount: 1,
              balance: "$lineBalance",
            },
          },
        ],
        totals: [
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              totalSalary: { $sum: "$netSalary" },
              totalPaid: { $sum: { $ifNull: ["$amount", 0] } },
              totalBalance: { $sum: "$lineBalance" },
            },
          },
        ],
      },
    },
  ];

  const [result] = await EmployeeAdvancePayment.aggregate(pipeline);
  const rows = result?.rows || [];
  const totals = result?.totals?.[0] || {
    count: 0,
    totalSalary: 0,
    totalPaid: 0,
    totalBalance: 0,
  };

  const header = await getStoreHeader();

  const payload = {
    header,
    filters: {
      startDate,
      endDate,
      employeeId: employeeId || null,
    },
    rows,
    totals: {
      count: totals.count,
      totalSalary: totals.totalSalary,
      totalPaid: totals.totalPaid,
      totalBalance: totals.totalBalance,
    },
    pagination: paginationMeta(totals.count, page, limit, skip),
    generatedAt: new Date(),
  };

  await setCache(cacheKey, payload, REPORT_CACHE_TTL);

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Employee payment report fetched successfully",
    { ...payload, fromCache: false },
  );
});

// @desc Employees that have at least one advance payment — for the employee
// payment report's employee filter dropdown
exports.getEmployeePaymentEmployees = asynchandeler(async (req, res) => {
  const cacheKey = await buildCacheKey(ADVANCE_NS, "report:employee-payment:employees");
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Employee list fetched successfully",
      { employees: cached, fromCache: true },
    );
  }

  const employeeIds = await EmployeeAdvancePayment.distinct("employeeId");

  const employees = await Employee.find({ _id: { $in: employeeIds } })
    .select("_id employeeId fullName")
    .sort({ fullName: 1 })
    .lean();

  await setCache(cacheKey, employees, REPORT_CACHE_TTL);

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Employee list fetched successfully",
    { employees, fromCache: false },
  );
});

// @desc Customer sales invoice report — one row per sale invoice for the
// customer report category. Same source collection as the sales invoice
// report, but filtered and read customer-first: the customer name/phone
// search and the payment status are the two primary filters, and the row
// carries the CUSTOMER SALES INVOICE sheet's columns (total, discount,
// delivery, labour, payable, paid, due, status).
//
// DELIVERY comes from `deliveryCost` on the sale. The sale schema has no
// `shipping` field — that name only exists on Purchase — so `deliveryCost`
// is the sale's delivery charge and what the sheet's DELIVERY column means.
//
// `customerName` is a free-text search rather than an id filter so walking
// customers, who have no Customer document to pick from a dropdown, are
// searchable too: it matches the listed customer's name/mobile and the
// walking customer's embedded name/mobile alike.
exports.getCustomerSalesInvoiceReport = asynchandeler(async (req, res) => {
  const { startDate, endDate, customerId, customerName, paymentStatus, salesType } =
    req.body || {};
  const { page, limit, skip } = parsePagination(req);

  if (!startDate || !endDate) {
    throw new customError("startDate and endDate are required", statusCodes.BAD_REQUEST);
  }

  // endDate arrives as a bare day ("2026-08-31"), which parses to midnight and
  // would drop every sale made later that same day. Push it to end-of-day.
  const rangeStart = new Date(startDate);
  rangeStart.setHours(0, 0, 0, 0);
  const rangeEnd = new Date(endDate);
  rangeEnd.setHours(23, 59, 59, 999);

  const match = { date: { $gte: rangeStart, $lte: rangeEnd } };
  if (paymentStatus && paymentStatus.trim() !== "") match.paymentStatus = paymentStatus.trim();
  if (salesType && salesType.trim() !== "") match.salesType = salesType.trim();
  castObjectIdFilter(match, "customerType.customerId", customerId);

  const nameQuery = typeof customerName === "string" ? customerName.trim() : "";

  const cacheKey = await buildCacheKey(
    SALES_NS,
    `report:customer-sales-invoice:${startDate}:${endDate}:${customerId || "all"}:${nameQuery || "all"}:${paymentStatus || "all"}:${salesType || "all"}:p${page}:l${limit}`,
  );
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Customer sales invoice report fetched successfully",
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
        // Resolve the two customer shapes (listed vs walking) into one pair of
        // fields so the name search and the projected row read the same value.
        resolvedCustomerName: {
          $ifNull: ["$customerType.walking.customerName", "$customerInfo.fullName"],
        },
        resolvedCustomerPhone: {
          $ifNull: ["$customerType.walking.mobileNumber", "$customerInfo.mobileNumber"],
        },
        discountAmount: { $multiply: ["$total", { $divide: ["$discountPercent", 100] }] },
        vatAmount: { $multiply: ["$total", { $divide: ["$vatPercent", 100] }] },
      },
    },
  ];

  // Name/phone search runs after the lookup because it has to see the resolved
  // fields — a listed customer's name lives on the joined document, not on the
  // sale, so this cannot be folded into the initial $match.
  if (nameQuery) {
    const escaped = nameQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx = new RegExp(escaped, "i");
    pipeline.push({
      $match: {
        $or: [{ resolvedCustomerName: rx }, { resolvedCustomerPhone: rx }],
      },
    });
  }

  pipeline.push({
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
            customerName: "$resolvedCustomerName",
            customerPhone: "$resolvedCustomerPhone",
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
    },
  });

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

  const header = await getStoreHeader();

  const payload = {
    header,
    filters: {
      startDate,
      endDate,
      customerId: customerId || null,
      customerName: nameQuery || null,
      paymentStatus: paymentStatus || "ALL",
      salesType: salesType || "ALL",
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
    pagination: paginationMeta(totals.count, page, limit, skip),
    generatedAt: new Date(),
  };

  await setCache(cacheKey, payload, REPORT_CACHE_TTL);

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Customer sales invoice report fetched successfully",
    { ...payload, fromCache: false },
  );
});

// @desc Customers that have at least one sale — for the customer report's
// customer dropdown. Walking customers have no Customer document, so they
// cannot appear here; the report's name search covers them instead.
exports.getCustomerReportCustomers = asynchandeler(async (req, res) => {
  const cacheKey = await buildCacheKey(SALES_NS, "report:customer:customers");
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

// @desc Customer sales product report — one row per sold line item, for the
// customer report category. The CUSTOMER SALES PRODUCT sheet: SL, invoice,
// sales type, date, product name, barcode, color, qty, WS price, RS price,
// sub. total — filtered by customer (id or name/phone search) and payment
// status, matching the customer sales invoice report's filters.
//
// SUB. TOTAL is RS PRICE x QTY on every row, including wholesale ones. That is
// what the sheet does, so it is reproduced here deliberately: it is a retail
// valuation of what was sold, NOT the amount charged. The sale's own
// `searchItem.subtotal` (the real transacted line value, net of any per-line
// discount) is returned alongside as `soldSubtotal` so the two never get
// confused by a later reader.
//
// The footer block (discount/less, delivery, labour, payable, paid, due) is
// invoice-level money, so it is summed over DISTINCT invoices — grouping by
// invoice first. Summing it per line would multiply an invoice's delivery cost
// by the number of lines on it.
exports.getCustomerSalesProductReport = asynchandeler(async (req, res) => {
  const {
    startDate,
    endDate,
    customerId,
    customerName,
    paymentStatus,
    salesType,
    productId,
    category,
    subCategory,
    brand,
  } = req.body || {};
  const { page, limit, skip } = parsePagination(req);

  if (!startDate || !endDate) {
    throw new customError("startDate and endDate are required", statusCodes.BAD_REQUEST);
  }

  // endDate arrives as a bare day ("2026-08-31"), which parses to midnight and
  // would drop every sale made later that same day. Push it to end-of-day.
  const rangeStart = new Date(startDate);
  rangeStart.setHours(0, 0, 0, 0);
  const rangeEnd = new Date(endDate);
  rangeEnd.setHours(23, 59, 59, 999);

  const match = { date: { $gte: rangeStart, $lte: rangeEnd } };
  if (paymentStatus && paymentStatus.trim() !== "") match.paymentStatus = paymentStatus.trim();
  if (salesType && salesType.trim() !== "") match.salesType = salesType.trim();
  castObjectIdFilter(match, "customerType.customerId", customerId);

  const nameQuery = typeof customerName === "string" ? customerName.trim() : "";

  // Product-level filters can only run after the $unwind and the product
  // $lookup below, so they are collected here and applied as a second $match
  // rather than being folded into the indexed top-level one.
  const lineMatch = {};
  if (productId) {
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      throw new customError("Invalid productId", statusCodes.BAD_REQUEST);
    }
    // Matches on the resolved product so a variant line whose own productId is
    // unset still matches when its parent product is the one selected.
    lineMatch["resolvedProduct._id"] = new mongoose.Types.ObjectId(productId);
  }
  castObjectIdFilter(lineMatch, "resolvedProduct.category", category);
  castObjectIdFilter(lineMatch, "resolvedProduct.subcategory", subCategory);
  castObjectIdFilter(lineMatch, "resolvedProduct.brand", brand);

  const cacheKey = await buildCacheKey(
    SALES_NS,
    `report:customer-sales-product:${startDate}:${endDate}:${customerId || "all"}:${nameQuery || "all"}:${paymentStatus || "all"}:${salesType || "all"}:${productId || "all"}:${category || "-"}:${subCategory || "-"}:${brand || "-"}:p${page}:l${limit}`,
  );
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Customer sales product report fetched successfully",
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
        resolvedCustomerName: {
          $ifNull: ["$customerType.walking.customerName", "$customerInfo.fullName"],
        },
        resolvedCustomerPhone: {
          $ifNull: ["$customerType.walking.mobileNumber", "$customerInfo.mobileNumber"],
        },
      },
    },
  ];

  // Name/phone search runs after the lookup because a listed customer's name
  // lives on the joined document, not on the sale itself.
  if (nameQuery) {
    const escaped = nameQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx = new RegExp(escaped, "i");
    pipeline.push({
      $match: {
        $or: [{ resolvedCustomerName: rx }, { resolvedCustomerPhone: rx }],
      },
    });
  }

  pipeline.push(
    // Invoice-level money is captured BEFORE the $unwind, while there is still
    // exactly one document per sale. After the unwind these fields repeat on
    // every line of the invoice and can no longer be summed.
    {
      $addFields: {
        invoiceDiscountAmount: {
          $add: [
            { $multiply: ["$total", { $divide: [{ $ifNull: ["$discountPercent", 0] }, 100] }] },
            { $ifNull: ["$lessTaka", 0] },
          ],
        },
      },
    },
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
              color: 1,
              size: 1,
              category: 1,
              subcategory: 1,
              brand: 1,
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
              wholesalePrice: 1,
              retailPrice: 1,
            },
          },
          {
            // A sale line referencing a variant may carry no productId of its
            // own, so the parent product is resolved through the variant to
            // get its display name.
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
                    color: 1,
                    size: 1,
                    category: 1,
                    subcategory: 1,
                    brand: 1,
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
      // A variant line may not carry productId, so the effective product is the
      // directly-joined one when present, otherwise the variant's parent.
      // Filters match against this rather than productInfo, so variant lines
      // are not silently dropped by a category/brand filter.
      $addFields: {
        resolvedProduct: { $ifNull: ["$productInfo", "$variantInfo.variantProduct"] },
      },
    },
    ...(Object.keys(lineMatch).length > 0 ? [{ $match: lineMatch }] : []),
    {
      // The variant is the more specific record, so its prices win where a
      // variant was sold; the product is the fallback for non-variant lines.
      $addFields: {
        lineQty: { $ifNull: ["$searchItem.quantity", 0] },
        lineWsPrice: {
          $ifNull: ["$variantInfo.wholesalePrice", { $ifNull: ["$resolvedProduct.wholesalePrice", 0] }],
        },
        lineRsPrice: {
          $ifNull: ["$variantInfo.retailPrice", { $ifNull: ["$resolvedProduct.retailPrice", 0] }],
        },
      },
    },
    {
      // SUB. TOTAL per the sheet: RS price x qty, regardless of sales type.
      $addFields: {
        lineSubTotal: { $multiply: ["$lineRsPrice", "$lineQty"] },
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
              paymentStatus: 1,
              customerName: "$resolvedCustomerName",
              customerPhone: "$resolvedCustomerPhone",
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
              wsPrice: "$lineWsPrice",
              rsPrice: "$lineRsPrice",
              subTotal: "$lineSubTotal",
              // The real transacted line value, net of any per-line discount.
              // Kept distinct from subTotal, which is a retail valuation.
              soldSubtotal: { $ifNull: ["$searchItem.subtotal", 0] },
            },
          },
        ],
        totals: [
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              totalQty: { $sum: "$lineQty" },
              totalWsPrice: { $sum: "$lineWsPrice" },
              totalRsPrice: { $sum: "$lineRsPrice" },
              totalSubTotal: { $sum: "$lineSubTotal" },
              totalSoldSubtotal: { $sum: { $ifNull: ["$searchItem.subtotal", 0] } },
            },
          },
        ],
        // Invoice-level money, de-duplicated: group back to one document per
        // invoice first, then sum. Without the first $group each value would
        // be counted once per line on its invoice.
        invoiceTotals: [
          {
            $group: {
              _id: "$_id",
              discount: { $first: "$invoiceDiscountAmount" },
              delivery: { $first: "$deliveryCost" },
              labour: { $first: "$labourCost" },
              payable: { $first: "$payable" },
              paid: { $first: "$paid" },
              due: { $first: "$presentDue" },
            },
          },
          {
            $group: {
              _id: null,
              invoiceCount: { $sum: 1 },
              totalDiscount: { $sum: "$discount" },
              totalDelivery: { $sum: "$delivery" },
              totalLabour: { $sum: "$labour" },
              totalPayable: { $sum: "$payable" },
              totalPaid: { $sum: "$paid" },
              totalDue: { $sum: "$due" },
            },
          },
        ],
      },
    },
  );

  const [result] = await Sales.aggregate(pipeline);
  const rows = result?.rows || [];
  const totals = result?.totals?.[0] || {
    count: 0,
    totalQty: 0,
    totalWsPrice: 0,
    totalRsPrice: 0,
    totalSubTotal: 0,
    totalSoldSubtotal: 0,
  };
  const invoiceTotals = result?.invoiceTotals?.[0] || {
    invoiceCount: 0,
    totalDiscount: 0,
    totalDelivery: 0,
    totalLabour: 0,
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
      customerId: customerId || null,
      customerName: nameQuery || null,
      paymentStatus: paymentStatus || "ALL",
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
      totalWsPrice: totals.totalWsPrice,
      totalRsPrice: totals.totalRsPrice,
      totalSubTotal: totals.totalSubTotal,
      totalSoldSubtotal: totals.totalSoldSubtotal,
    },
    invoiceTotals: {
      invoiceCount: invoiceTotals.invoiceCount,
      totalDiscount: invoiceTotals.totalDiscount,
      totalDelivery: invoiceTotals.totalDelivery,
      totalLabour: invoiceTotals.totalLabour,
      totalPayable: invoiceTotals.totalPayable,
      totalPaid: invoiceTotals.totalPaid,
      totalDue: invoiceTotals.totalDue,
    },
    pagination: paginationMeta(totals.count, page, limit, skip),
    generatedAt: new Date(),
  };

  await setCache(cacheKey, payload, REPORT_CACHE_TTL);

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Customer sales product report fetched successfully",
    { ...payload, fromCache: false },
  );
});

// @desc Customer sales summary report — one row per PRODUCT sold in the range
// (lines for the same product across invoices collapse into one row), for the
// customer report category. The CUSTOMER SALES SUMMARY sheet: SL, product
// name, qty, sales price, total.
//
// SALES PRICE follows the sales type filter, since that is what determines
// which price list the customer was billed from:
//   wholesale / wholesaleorder -> wholesalePrice
//   everything else (incl. no filter) -> retailPrice
// The variant is the more specific record, so its price wins where a variant
// was sold; the product is the fallback for non-variant lines.
//
// TOTAL is salesPrice x qty per row. The footer sums each column on its own,
// matching the sheet: the TOTAL row's price cell is the sum of the per-row
// unit prices, NOT a weighted average, so it will not equal totalAmount/qty.
//
// The money block below the table (discount/less, delivery, labour, payable,
// paid, due) is invoice-level, so it is summed over DISTINCT invoices rather
// than per line — otherwise an invoice's delivery cost would be counted once
// per line item on it.
exports.getCustomerSalesSummaryReport = asynchandeler(async (req, res) => {
  const {
    startDate,
    endDate,
    customerId,
    customerName,
    paymentStatus,
    salesType,
    productId,
    category,
    subCategory,
    brand,
  } = req.body || {};
  const { page, limit, skip } = parsePagination(req);

  if (!startDate || !endDate) {
    throw new customError("startDate and endDate are required", statusCodes.BAD_REQUEST);
  }

  // endDate arrives as a bare day ("2026-08-31"), which parses to midnight and
  // would drop every sale made later that same day. Push it to end-of-day.
  const rangeStart = new Date(startDate);
  rangeStart.setHours(0, 0, 0, 0);
  const rangeEnd = new Date(endDate);
  rangeEnd.setHours(23, 59, 59, 999);

  const normalisedSalesType = salesType && salesType.trim() !== "" ? salesType.trim() : "";

  const match = { date: { $gte: rangeStart, $lte: rangeEnd } };
  if (paymentStatus && paymentStatus.trim() !== "") match.paymentStatus = paymentStatus.trim();
  if (normalisedSalesType) match.salesType = normalisedSalesType;
  castObjectIdFilter(match, "customerType.customerId", customerId);

  const nameQuery = typeof customerName === "string" ? customerName.trim() : "";

  // Which price list the SALES PRICE column reads from.
  const isWholesale =
    normalisedSalesType === "wholesale" || normalisedSalesType === "wholesaleorder";
  const priceField = isWholesale ? "wholesalePrice" : "retailPrice";
  const priceLabel = isWholesale ? "Wholesale Price" : "Retail Price";

  const lineMatch = {};
  if (productId) {
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      throw new customError("Invalid productId", statusCodes.BAD_REQUEST);
    }
    lineMatch["resolvedProduct._id"] = new mongoose.Types.ObjectId(productId);
  }
  castObjectIdFilter(lineMatch, "resolvedProduct.category", category);
  castObjectIdFilter(lineMatch, "resolvedProduct.subcategory", subCategory);
  castObjectIdFilter(lineMatch, "resolvedProduct.brand", brand);

  const cacheKey = await buildCacheKey(
    SALES_NS,
    `report:customer-sales-summary:${startDate}:${endDate}:${customerId || "all"}:${nameQuery || "all"}:${paymentStatus || "all"}:${normalisedSalesType || "all"}:${productId || "all"}:${category || "-"}:${subCategory || "-"}:${brand || "-"}:p${page}:l${limit}`,
  );
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Customer sales summary report fetched successfully",
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
        resolvedCustomerName: {
          $ifNull: ["$customerType.walking.customerName", "$customerInfo.fullName"],
        },
        resolvedCustomerPhone: {
          $ifNull: ["$customerType.walking.mobileNumber", "$customerInfo.mobileNumber"],
        },
      },
    },
  ];

  if (nameQuery) {
    const escaped = nameQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx = new RegExp(escaped, "i");
    pipeline.push({
      $match: {
        $or: [{ resolvedCustomerName: rx }, { resolvedCustomerPhone: rx }],
      },
    });
  }

  pipeline.push(
    // Invoice-level money is captured BEFORE the $unwind, while there is still
    // exactly one document per sale.
    {
      $addFields: {
        invoiceDiscountAmount: {
          $add: [
            { $multiply: ["$total", { $divide: [{ $ifNull: ["$discountPercent", 0] }, 100] }] },
            { $ifNull: ["$lessTaka", 0] },
          ],
        },
      },
    },
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
              category: 1,
              subcategory: 1,
              brand: 1,
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
              product: 1,
              purchasePrice: 1,
              wholesalePrice: 1,
              retailPrice: 1,
            },
          },
          {
            $lookup: {
              from: "products",
              localField: "product",
              foreignField: "_id",
              as: "variantProduct",
              pipeline: [
                {
                  $project: {
                    name: 1,
                    category: 1,
                    subcategory: 1,
                    brand: 1,
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
      $addFields: {
        resolvedProduct: { $ifNull: ["$productInfo", "$variantInfo.variantProduct"] },
      },
    },
    ...(Object.keys(lineMatch).length > 0 ? [{ $match: lineMatch }] : []),
    {
      $addFields: {
        lineQty: { $ifNull: ["$searchItem.quantity", 0] },
        linePrice: {
          $ifNull: [
            `$variantInfo.${priceField}`,
            { $ifNull: [`$resolvedProduct.${priceField}`, 0] },
          ],
        },
      },
    },
    {
      // One row per product. Lines for the same product across several
      // invoices collapse here, which is what makes this a summary rather
      // than the line-item product report.
      //
      // The unit price is taken as the LAST price seen for the product rather
      // than summed: it is a per-unit figure, so adding it across lines would
      // be meaningless. Row TOTAL is still the true sum of price x qty for
      // each contributing line, so a product whose price changed mid-range
      // keeps an accurate total even though one unit price is displayed.
      $group: {
        _id: { $ifNull: ["$resolvedProduct._id", "$searchItem.productId"] },
        productName: { $last: { $ifNull: ["$resolvedProduct.name", "-"] } },
        qty: { $sum: "$lineQty" },
        salesPrice: { $last: "$linePrice" },
        total: { $sum: { $multiply: ["$linePrice", "$lineQty"] } },
      },
    },
    {
      $facet: {
        rows: [
          { $sort: { total: -1 } },
          { $skip: skip },
          { $limit: limit },
          {
            $project: {
              _id: 1,
              productName: 1,
              qty: 1,
              salesPrice: 1,
              total: 1,
            },
          },
        ],
        totals: [
          {
            $group: {
              _id: null,
              // Distinct products, which is what the rows now are.
              count: { $sum: 1 },
              totalQty: { $sum: "$qty" },
              // Column-wise sum of the displayed unit prices, per the sheet.
              // Deliberately NOT a weighted average price.
              totalSalesPrice: { $sum: "$salesPrice" },
              totalAmount: { $sum: "$total" },
            },
          },
        ],
      },
    },
  );

  // Invoice-level money cannot be read off the grouped-by-product pipeline
  // above, so it is computed by its own aggregation over the same filters.
  const invoiceMatch = { ...match };
  const invoicePipeline = [
    { $match: invoiceMatch },
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
        resolvedCustomerName: {
          $ifNull: ["$customerType.walking.customerName", "$customerInfo.fullName"],
        },
        resolvedCustomerPhone: {
          $ifNull: ["$customerType.walking.mobileNumber", "$customerInfo.mobileNumber"],
        },
      },
    },
  ];
  if (nameQuery) {
    const escaped = nameQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx = new RegExp(escaped, "i");
    invoicePipeline.push({
      $match: { $or: [{ resolvedCustomerName: rx }, { resolvedCustomerPhone: rx }] },
    });
  }
  invoicePipeline.push({
    $group: {
      _id: null,
      invoiceCount: { $sum: 1 },
      totalDiscount: {
        $sum: {
          $add: [
            { $multiply: ["$total", { $divide: [{ $ifNull: ["$discountPercent", 0] }, 100] }] },
            { $ifNull: ["$lessTaka", 0] },
          ],
        },
      },
      totalDelivery: { $sum: { $ifNull: ["$deliveryCost", 0] } },
      totalLabour: { $sum: { $ifNull: ["$labourCost", 0] } },
      totalPayable: { $sum: { $ifNull: ["$payable", 0] } },
      totalPaid: { $sum: { $ifNull: ["$paid", 0] } },
      totalDue: { $sum: { $ifNull: ["$presentDue", 0] } },
    },
  });

  const [[result], [invoiceAgg]] = await Promise.all([
    Sales.aggregate(pipeline),
    Sales.aggregate(invoicePipeline),
  ]);

  const rows = result?.rows || [];
  const totals = result?.totals?.[0] || {
    count: 0,
    totalQty: 0,
    totalSalesPrice: 0,
    totalAmount: 0,
  };
  const invoiceTotals = invoiceAgg || {
    invoiceCount: 0,
    totalDiscount: 0,
    totalDelivery: 0,
    totalLabour: 0,
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
      customerId: customerId || null,
      customerName: nameQuery || null,
      paymentStatus: paymentStatus || "ALL",
      salesType: normalisedSalesType || "ALL",
      product: productId || "ALL",
      category: category || "ALL",
      subCategory: subCategory || "ALL",
      brand: brand || "ALL",
    },
    // Tells the client which price list the SALES PRICE column is showing, so
    // the column header can say so rather than the reader having to infer it.
    priceType: { field: priceField, label: priceLabel },
    rows,
    totals: {
      count: totals.count,
      totalQty: totals.totalQty,
      totalSalesPrice: totals.totalSalesPrice,
      totalAmount: totals.totalAmount,
    },
    invoiceTotals: {
      invoiceCount: invoiceTotals.invoiceCount,
      totalDiscount: invoiceTotals.totalDiscount,
      totalDelivery: invoiceTotals.totalDelivery,
      totalLabour: invoiceTotals.totalLabour,
      totalPayable: invoiceTotals.totalPayable,
      totalPaid: invoiceTotals.totalPaid,
      totalDue: invoiceTotals.totalDue,
    },
    pagination: paginationMeta(totals.count, page, limit, skip),
    generatedAt: new Date(),
  };

  await setCache(cacheKey, payload, REPORT_CACHE_TTL);

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Customer sales summary report fetched successfully",
    { ...payload, fromCache: false },
  );
});

// @desc Supplier purchase invoice report — one row per purchase invoice, for
// the supplier report category. The SUPPLIER PURCHASE INVOICE sheet: SL,
// purchase inv., date, supplier info (name + mobile), total, commission,
// shipping, payable, paid, due, status.
//
// paymentStatus is the stored field on Purchase (see purchase.model.js), so
// the filter folds into the indexed top-level $match rather than an $expr
// stage. The rule that maintains it: 0 paid -> "due", paid below payable ->
// "partial", paid covering payable -> "paid".
exports.getSupplierPurchaseInvoiceReport = asynchandeler(async (req, res) => {
  const { startDate, endDate, supplierId, supplierName, paymentStatus } = req.body || {};
  const { page, limit, skip } = parsePagination(req);

  if (!startDate || !endDate) {
    throw new customError("startDate and endDate are required", statusCodes.BAD_REQUEST);
  }

  // endDate arrives as a bare day ("2026-08-31"), which parses to midnight and
  // would drop every purchase made later that same day. Push it to end-of-day.
  const rangeStart = new Date(startDate);
  rangeStart.setHours(0, 0, 0, 0);
  const rangeEnd = new Date(endDate);
  rangeEnd.setHours(23, 59, 59, 999);

  const match = { date: { $gte: rangeStart, $lte: rangeEnd } };
  castObjectIdFilter(match, "supplierId", supplierId);

  const status = (paymentStatus || "").trim();
  if (status) match.paymentStatus = status;

  const nameQuery = typeof supplierName === "string" ? supplierName.trim() : "";

  const cacheKey = await buildCacheKey(
    PURCHASE_NS,
    `report:supplier-purchase-invoice:${startDate}:${endDate}:${supplierId || "all"}:${nameQuery.toLowerCase() || "all"}:${status || "all"}:p${page}:l${limit}`,
  );
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Supplier purchase invoice report fetched successfully",
      { ...cached, fromCache: true },
    );
  }

  const pipeline = [
    { $match: match },
    {
      $lookup: {
        from: "suppliers",
        localField: "supplierId",
        foreignField: "_id",
        as: "supplier",
        pipeline: [{ $project: { supplierName: 1, mobile: 1 } }],
      },
    },
    { $unwind: { path: "$supplier", preserveNullAndEmptyArrays: true } },
  ];

  // Name/mobile search runs after the lookup because the supplier's name lives
  // on the joined document, not on the purchase itself.
  if (nameQuery) {
    const escaped = nameQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx = new RegExp(escaped, "i");
    pipeline.push({
      $match: { $or: [{ "supplier.supplierName": rx }, { "supplier.mobile": rx }] },
    });
  }

  pipeline.push({
    $facet: {
      rows: [
        { $sort: { date: -1 } },
        { $skip: skip },
        { $limit: limit },
        {
          $project: {
            _id: 1,
            date: 1,
            purchaseInvoice: { $ifNull: ["$serial", "$invoiceNumber"] },
            supplierInvoice: "$invoiceNumber",
            supplierName: { $ifNull: ["$supplier.supplierName", "-"] },
            supplierPhone: { $ifNull: ["$supplier.mobile", ""] },
            total: "$subTotal",
            commission: 1,
            shipping: 1,
            payable: 1,
            paid: 1,
            due: "$dueamount",
            paymentStatus: 1,
          },
        },
      ],
      totals: [
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            totalAmount: { $sum: "$subTotal" },
            totalCommission: { $sum: "$commission" },
            totalShipping: { $sum: "$shipping" },
            totalPayable: { $sum: "$payable" },
            totalPaid: { $sum: "$paid" },
            totalDue: { $sum: "$dueamount" },
          },
        },
      ],
    },
  });

  const [result] = await Purchase.aggregate(pipeline);
  const rows = result?.rows || [];
  const totals = result?.totals?.[0] || {
    count: 0,
    totalAmount: 0,
    totalCommission: 0,
    totalShipping: 0,
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
      supplierName: nameQuery || null,
      paymentStatus: status || "ALL",
    },
    rows,
    totals: {
      count: totals.count,
      totalAmount: totals.totalAmount,
      totalCommission: totals.totalCommission,
      totalShipping: totals.totalShipping,
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
    "Supplier purchase invoice report fetched successfully",
    { ...payload, fromCache: false },
  );
});

// @desc Suppliers that have at least one purchase — for the supplier report's
// supplier dropdown.
exports.getSupplierReportSuppliers = asynchandeler(async (req, res) => {
  const cacheKey = await buildCacheKey(PURCHASE_NS, "report:supplier:suppliers");
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
    .select("_id supplierName mobile")
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

// @desc Supplier payment report — one row per supplier due-payment record, for
// the supplier report category. The SUPPLIER PAYMENT sheet: SL, trx id, date,
// supplier (name + mobile), payment method, paid, less, reference #.
//
// Reads SupplierDuePayment. Note its `supplierId` is a STRING (the supplier's
// phone-derived business id), not an ObjectId, so the supplier join matches
// supplierId -> supplierId rather than the usual _id foreign key.
//
// PAYMENT METHOD is the single `paymentMode` account on the record. The model
// stores one account per payment, so a row shows one method — a payment split
// across two accounts would need two records (or a schema change).
//
// Soft-deleted records (isActive false / deletedAt set) are excluded: they are
// reversed payments and must not inflate the totals.
exports.getSupplierPaymentReport = asynchandeler(async (req, res) => {
  const { startDate, endDate, supplierId, supplierName, paymentMode } = req.body || {};
  const { page, limit, skip } = parsePagination(req);

  if (!startDate || !endDate) {
    throw new customError("startDate and endDate are required", statusCodes.BAD_REQUEST);
  }

  // endDate arrives as a bare day ("2026-08-31"), which parses to midnight and
  // would drop every payment made later that same day. Push it to end-of-day.
  const rangeStart = new Date(startDate);
  rangeStart.setHours(0, 0, 0, 0);
  const rangeEnd = new Date(endDate);
  rangeEnd.setHours(23, 59, 59, 999);

  const match = {
    date: { $gte: rangeStart, $lte: rangeEnd },
    isActive: { $ne: false },
    deletedAt: null,
  };

  // supplierId here is the string business id, not an ObjectId — no casting.
  if (supplierId && String(supplierId).trim() !== "") {
    match.supplierId = String(supplierId).trim();
  }

  if (paymentMode && String(paymentMode).trim() !== "") {
    if (!mongoose.Types.ObjectId.isValid(paymentMode)) {
      throw new customError("Invalid paymentMode", statusCodes.BAD_REQUEST);
    }
    match.paymentMode = new mongoose.Types.ObjectId(paymentMode);
  }

  const nameQuery = typeof supplierName === "string" ? supplierName.trim() : "";

  const cacheKey = await buildCacheKey(
    SUPPLIER_NS,
    `report:supplier-payment:${startDate}:${endDate}:${supplierId || "all"}:${nameQuery.toLowerCase() || "all"}:${paymentMode || "all"}:p${page}:l${limit}`,
  );
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Supplier payment report fetched successfully",
      { ...cached, fromCache: true },
    );
  }

  const pipeline = [
    { $match: match },
    {
      // String-to-string join: the payment stores the supplier's business id,
      // not its _id.
      $lookup: {
        from: "suppliers",
        localField: "supplierId",
        foreignField: "supplierId",
        as: "supplier",
        pipeline: [{ $project: { supplierName: 1, mobile: 1 } }],
      },
    },
    { $unwind: { path: "$supplier", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "accounts",
        localField: "paymentMode",
        foreignField: "_id",
        as: "account",
        pipeline: [{ $project: { name: 1 } }],
      },
    },
    { $unwind: { path: "$account", preserveNullAndEmptyArrays: true } },
  ];

  // Name/mobile search runs after the lookup because the supplier's name lives
  // on the joined document, not on the payment record.
  if (nameQuery) {
    const escaped = nameQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx = new RegExp(escaped, "i");
    pipeline.push({
      $match: { $or: [{ "supplier.supplierName": rx }, { "supplier.mobile": rx }] },
    });
  }

  pipeline.push({
    $facet: {
      rows: [
        { $sort: { date: -1 } },
        { $skip: skip },
        { $limit: limit },
        {
          $project: {
            _id: 1,
            date: 1,
            trxId: { $ifNull: ["$supplierPaymentSerialId", "$transactionId"] },
            transactionId: 1,
            supplierName: { $ifNull: ["$supplier.supplierName", "-"] },
            supplierPhone: { $ifNull: ["$supplier.mobile", ""] },
            paymentMethod: { $ifNull: ["$account.name", "-"] },
            paid: { $ifNull: ["$paidAmount", 0] },
            less: { $ifNull: ["$lessAmount", 0] },
            // The sheet's REFERENCE # column — the record's free-text remarks.
            reference: { $ifNull: ["$remarks", ""] },
            remainingDue: { $ifNull: ["$remainingDue", 0] },
          },
        },
      ],
      totals: [
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            totalPaid: { $sum: { $ifNull: ["$paidAmount", 0] } },
            totalLess: { $sum: { $ifNull: ["$lessAmount", 0] } },
          },
        },
      ],
    },
  });

  // Payment methods present in the range, so the filter dropdown can be built
  // without calling the account endpoint — that one is gated by the
  // add-account permission, which a report-only user need not hold.
  //
  // Runs as its own pass with every filter EXCEPT paymentMode: folding it into
  // the main $facet would narrow the list by the method filter itself, so
  // picking one method would leave the dropdown showing only that method.
  const methodMatch = { ...match };
  delete methodMatch.paymentMode;
  const methodPipeline = [
    { $match: methodMatch },
    {
      $lookup: {
        from: "suppliers",
        localField: "supplierId",
        foreignField: "supplierId",
        as: "supplier",
        pipeline: [{ $project: { supplierName: 1, mobile: 1 } }],
      },
    },
    { $unwind: { path: "$supplier", preserveNullAndEmptyArrays: true } },
  ];
  if (nameQuery) {
    const escaped = nameQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx = new RegExp(escaped, "i");
    methodPipeline.push({
      $match: { $or: [{ "supplier.supplierName": rx }, { "supplier.mobile": rx }] },
    });
  }
  methodPipeline.push(
    {
      $lookup: {
        from: "accounts",
        localField: "paymentMode",
        foreignField: "_id",
        as: "account",
        pipeline: [{ $project: { name: 1 } }],
      },
    },
    { $unwind: { path: "$account", preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: "$paymentMode",
        name: { $first: { $ifNull: ["$account.name", "-"] } },
        count: { $sum: 1 },
        totalPaid: { $sum: { $ifNull: ["$paidAmount", 0] } },
      },
    },
    { $match: { _id: { $ne: null } } },
    { $project: { _id: 0, id: "$_id", name: 1, count: 1, totalPaid: 1 } },
    { $sort: { name: 1 } },
  );

  const [[result], methods] = await Promise.all([
    SupplierDuePayment.aggregate(pipeline),
    SupplierDuePayment.aggregate(methodPipeline),
  ]);
  const rows = result?.rows || [];
  const totals = result?.totals?.[0] || { count: 0, totalPaid: 0, totalLess: 0 };

  const header = await getStoreHeader();

  const payload = {
    header,
    filters: {
      startDate,
      endDate,
      supplierId: supplierId || null,
      supplierName: nameQuery || null,
      paymentMode: paymentMode || "ALL",
    },
    rows,
    methods,
    totals: {
      count: totals.count,
      totalPaid: totals.totalPaid,
      totalLess: totals.totalLess,
    },
    pagination: paginationMeta(totals.count, page, limit, skip),
    generatedAt: new Date(),
  };

  await setCache(cacheKey, payload, REPORT_CACHE_TTL);

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Supplier payment report fetched successfully",
    { ...payload, fromCache: false },
  );
});

// @desc Suppliers that have at least one due payment — for the supplier payment
// report's dropdown. Values are the string business ids the payment records
// store, not ObjectIds, so the filter can use them directly.
exports.getSupplierPaymentSuppliers = asynchandeler(async (req, res) => {
  const cacheKey = await buildCacheKey(SUPPLIER_NS, "report:supplier-payment:suppliers");
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Supplier list fetched successfully",
      { suppliers: cached, fromCache: true },
    );
  }

  const supplierIds = await SupplierDuePayment.distinct("supplierId", {
    supplierId: { $ne: null },
    isActive: { $ne: false },
    deletedAt: null,
  });

  const suppliers = await Supplier.find({ supplierId: { $in: supplierIds } })
    .select("supplierId supplierName mobile")
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

// @desc Customer payment report — one row per received payment, merging the two
// places a customer payment can be recorded:
//   * CustomerPaymentRecived        ("Customer Payment Received")
//   * CustomerAdvancePaymentRecived ("Customer Advance Payment")
// Both are normalised into one row shape via $unionWith so the sheet can show a
// single date-ordered ledger. PAYMENT CATEGORY names which model a row came
// from; a row carrying a non-zero cash back is re-labelled "Return Cash Back"
// so the sheet matches the accountant's category list.
exports.getCustomerPaymentReport = asynchandeler(async (req, res) => {
  const { startDate, endDate, customerId, customerName, paymentMode, category } =
    req.body || {};
  const { page, limit, skip } = parsePagination(req);

  if (!startDate || !endDate) {
    throw new customError(
      "startDate and endDate are required",
      statusCodes.BAD_REQUEST,
    );
  }

  // endDate arrives as a bare day ("2026-08-31"), which parses to midnight and
  // would drop every payment made later that same day. Push it to end-of-day.
  const rangeStart = new Date(startDate);
  rangeStart.setHours(0, 0, 0, 0);
  const rangeEnd = new Date(endDate);
  rangeEnd.setHours(23, 59, 59, 999);

  const baseMatch = {
    date: { $gte: rangeStart, $lte: rangeEnd },
    isActive: { $ne: false },
    deletedAt: null,
  };

  // Both models store `customer` as an ObjectId ref, so the same cast works for
  // either side of the union.
  if (customerId && String(customerId).trim() !== "") {
    if (!mongoose.Types.ObjectId.isValid(customerId)) {
      throw new customError("Invalid customerId", statusCodes.BAD_REQUEST);
    }
    baseMatch.customer = new mongoose.Types.ObjectId(customerId);
  }

  if (paymentMode && String(paymentMode).trim() !== "") {
    if (!mongoose.Types.ObjectId.isValid(paymentMode)) {
      throw new customError("Invalid paymentMode", statusCodes.BAD_REQUEST);
    }
    baseMatch.paymentMode = new mongoose.Types.ObjectId(paymentMode);
  }

  const nameQuery = typeof customerName === "string" ? customerName.trim() : "";
  const categoryFilter =
    typeof category === "string" && category.trim() !== "" ? category.trim() : "";

  // buildCacheKey versions on one namespace only, but this report reads both
  // collections — so the advance namespace's version is folded into the suffix.
  // Without it an advance-payment write would leave these rows stale until TTL.
  const advanceVersion = await getNsVersion(CUSTOMER_ADVANCE_NS);
  const cacheKey = await buildCacheKey(
    CUSTOMER_PAYMENT_NS,
    `report:customer-payment:a${advanceVersion}:${startDate}:${endDate}:${customerId || "all"}:${
      nameQuery.toLowerCase() || "all"
    }:${paymentMode || "all"}:${categoryFilter || "all"}:p${page}:l${limit}`,
  );
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Customer payment report fetched successfully",
      { ...cached, fromCache: true },
    );
  }

  // Normalise the due-payment side. `lessAmount` and `cashBack` are distinct
  // columns on the sheet, so they are kept apart rather than summed.
  const duePaymentStages = [
    { $match: baseMatch },
    {
      $project: {
        _id: 1,
        date: 1,
        customer: 1,
        paymentMode: 1,
        trxId: { $ifNull: ["$paymentId", ""] },
        paid: { $ifNull: ["$paidAmount", 0] },
        less: { $ifNull: ["$lessAmount", 0] },
        cashBack: { $ifNull: ["$cashBack", 0] },
        remarks: { $ifNull: ["$remarks", ""] },
        sourceCategory: "Customer Payment Received",
      },
    },
  ];

  // The advance model names its cash-back field `advanceCashBack` and has no
  // less column at all, so `less` is pinned to 0 to keep the union's row shape
  // identical on both sides.
  const advancePaymentStages = [
    { $match: baseMatch },
    {
      $project: {
        _id: 1,
        date: 1,
        customer: 1,
        paymentMode: 1,
        trxId: { $ifNull: ["$paymentId", ""] },
        paid: { $ifNull: ["$paidAmount", 0] },
        less: { $literal: 0 },
        cashBack: { $ifNull: ["$advanceCashBack", 0] },
        remarks: { $ifNull: ["$remarks", ""] },
        sourceCategory: "Customer Advance Payment",
      },
    },
  ];

  // Stages shared by the row pipeline and the filter-option passes: join the
  // customer and account, then derive the displayed category.
  const enrichStages = [
    {
      $lookup: {
        from: "customers",
        localField: "customer",
        foreignField: "_id",
        as: "customerInfo",
        pipeline: [{ $project: { fullName: 1, mobileNumber: 1 } }],
      },
    },
    { $unwind: { path: "$customerInfo", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "accounts",
        localField: "paymentMode",
        foreignField: "_id",
        as: "account",
        pipeline: [{ $project: { name: 1 } }],
      },
    },
    { $unwind: { path: "$account", preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        // A row that carries cash back is reported under its own category
        // regardless of which model produced it.
        paymentCategory: {
          $cond: [{ $gt: ["$cashBack", 0] }, "Return Cash Back", "$sourceCategory"],
        },
      },
    },
  ];

  // Name/mobile search runs after the lookup because the customer's name lives
  // on the joined document, not on the payment record.
  const nameFilterStages = [];
  if (nameQuery) {
    const escaped = nameQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx = new RegExp(escaped, "i");
    nameFilterStages.push({
      $match: {
        $or: [
          { "customerInfo.fullName": rx },
          { "customerInfo.mobileNumber": rx },
        ],
      },
    });
  }

  const categoryFilterStages = categoryFilter
    ? [{ $match: { paymentCategory: categoryFilter } }]
    : [];

  const unionStage = {
    $unionWith: {
      coll: "customeradvancepaymentreciveds",
      pipeline: advancePaymentStages,
    },
  };

  const pipeline = [
    ...duePaymentStages,
    unionStage,
    ...enrichStages,
    ...nameFilterStages,
    ...categoryFilterStages,
    {
      $facet: {
        rows: [
          { $sort: { date: -1, _id: -1 } },
          { $skip: skip },
          { $limit: limit },
          {
            $project: {
              _id: 1,
              date: 1,
              trxId: 1,
              customerName: { $ifNull: ["$customerInfo.fullName", "-"] },
              customerPhone: { $ifNull: ["$customerInfo.mobileNumber", ""] },
              paymentCategory: 1,
              paymentMethod: { $ifNull: ["$account.name", "-"] },
              paid: 1,
              less: 1,
              cashBack: 1,
              remarks: 1,
            },
          },
        ],
        totals: [
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              totalPaid: { $sum: "$paid" },
              totalLess: { $sum: "$less" },
              totalCashBack: { $sum: "$cashBack" },
            },
          },
        ],
      },
    },
  ];

  // Payment methods and categories present in the range, so the two dropdowns
  // can be built without calling the account endpoint — that one is gated by
  // the add-account permission, which a report-only user need not hold.
  //
  // Each runs as its own pass with every filter EXCEPT its own: folding them
  // into the main $facet would narrow each list by its own filter, so picking
  // one value would leave that dropdown showing only that value.
  const buildOptionPipeline = (excludeKey) => {
    const optionMatch = { ...baseMatch };
    if (excludeKey === "paymentMode") delete optionMatch.paymentMode;

    const dueSide = [
      { $match: optionMatch },
      { $project: duePaymentStages[1].$project },
    ];
    const advanceSide = [
      { $match: optionMatch },
      { $project: advancePaymentStages[1].$project },
    ];

    return [
      ...dueSide,
      {
        $unionWith: {
          coll: "customeradvancepaymentreciveds",
          pipeline: advanceSide,
        },
      },
      ...enrichStages,
      ...nameFilterStages,
      ...(excludeKey === "category" ? [] : categoryFilterStages),
    ];
  };

  const methodPipeline = [
    ...buildOptionPipeline("paymentMode"),
    {
      $group: {
        _id: "$paymentMode",
        name: { $first: { $ifNull: ["$account.name", "-"] } },
        count: { $sum: 1 },
        totalPaid: { $sum: "$paid" },
      },
    },
    { $match: { _id: { $ne: null } } },
    { $project: { _id: 0, id: "$_id", name: 1, count: 1, totalPaid: 1 } },
    { $sort: { name: 1 } },
  ];

  const categoryPipeline = [
    ...buildOptionPipeline("category"),
    {
      $group: {
        _id: "$paymentCategory",
        count: { $sum: 1 },
        totalPaid: { $sum: "$paid" },
      },
    },
    { $match: { _id: { $ne: null } } },
    { $project: { _id: 0, name: "$_id", count: 1, totalPaid: 1 } },
    { $sort: { name: 1 } },
  ];

  const [[result], methods, categories] = await Promise.all([
    CustomerPaymentRecived.aggregate(pipeline),
    CustomerPaymentRecived.aggregate(methodPipeline),
    CustomerPaymentRecived.aggregate(categoryPipeline),
  ]);

  const rows = result?.rows || [];
  const totals = result?.totals?.[0] || {
    count: 0,
    totalPaid: 0,
    totalLess: 0,
    totalCashBack: 0,
  };

  const header = await getStoreHeader();

  const payload = {
    header,
    filters: {
      startDate,
      endDate,
      customerId: customerId || null,
      customerName: nameQuery || null,
      paymentMode: paymentMode || "ALL",
      category: categoryFilter || "ALL",
    },
    rows,
    methods,
    categories,
    totals: {
      count: totals.count,
      totalPaid: totals.totalPaid,
      totalLess: totals.totalLess,
      totalCashBack: totals.totalCashBack,
    },
    pagination: paginationMeta(totals.count, page, limit, skip),
    generatedAt: new Date(),
  };

  await setCache(cacheKey, payload, REPORT_CACHE_TTL);

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Customer payment report fetched successfully",
    { ...payload, fromCache: false },
  );
});

// @desc Customers that have at least one received payment (due or advance) —
// for the customer payment report's dropdown.
exports.getCustomerPaymentCustomers = asynchandeler(async (req, res) => {
  const advanceVersion = await getNsVersion(CUSTOMER_ADVANCE_NS);
  const cacheKey = await buildCacheKey(
    CUSTOMER_PAYMENT_NS,
    `report:customer-payment:customers:a${advanceVersion}`,
  );
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Customer list fetched successfully",
      { customers: cached, fromCache: true },
    );
  }

  const activeOnly = { isActive: { $ne: false }, deletedAt: null };
  const [dueIds, advanceIds] = await Promise.all([
    CustomerPaymentRecived.distinct("customer", activeOnly),
    CustomerAdvancePayment.distinct("customer", activeOnly),
  ]);

  const uniqueIds = [
    ...new Map(
      [...dueIds, ...advanceIds]
        .filter(Boolean)
        .map((id) => [String(id), id]),
    ).values(),
  ];

  const customers = await Customer.find({ _id: { $in: uniqueIds } })
    .select("fullName mobileNumber")
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

// @desc Customer balance summary — one row per customer with the running
// balance the shop is owed.
//
//   TOTAL BALANCE = OPENING BALANCE + TOTAL SALES - TOTAL PAID
//
// OPENING BALANCE is the customer's `openingDues` (the due carried in when the
// customer was first entered). CREDIT LIMIT is `dueLimit` — the schema has no
// `creditLimit` field, that is the column's source.
//
// TOTAL SALES / TOTAL PAID are summed from the Sales collection, so the date
// range narrows the sales side only: a customer's opening balance predates
// every sale and so is never filtered out by it. That also means a customer
// with no sales in the range still appears, showing opening balance alone —
// the driving collection is Customer, with sales joined in.
exports.getCustomerBalanceSummaryReport = asynchandeler(async (req, res) => {
  const { startDate, endDate, customerId, customerName, customerType } =
    req.body || {};
  const { page, limit, skip } = parsePagination(req);

  // Unlike the payment report, the range is optional here: with no dates the
  // sheet shows each customer's all-time balance, which is the default view.
  let rangeStart = null;
  let rangeEnd = null;
  if (startDate && endDate) {
    rangeStart = new Date(startDate);
    rangeStart.setHours(0, 0, 0, 0);
    rangeEnd = new Date(endDate);
    rangeEnd.setHours(23, 59, 59, 999);
  }

  const match = { isActive: { $ne: false }, deletedAt: null };

  if (customerId && String(customerId).trim() !== "") {
    if (!mongoose.Types.ObjectId.isValid(customerId)) {
      throw new customError("Invalid customerId", statusCodes.BAD_REQUEST);
    }
    match._id = new mongoose.Types.ObjectId(customerId);
  }

  if (customerType && String(customerType).trim() !== "") {
    if (!mongoose.Types.ObjectId.isValid(customerType)) {
      throw new customError("Invalid customerType", statusCodes.BAD_REQUEST);
    }
    match.customerType = new mongoose.Types.ObjectId(customerType);
  }

  const nameQuery = typeof customerName === "string" ? customerName.trim() : "";
  if (nameQuery) {
    const escaped = nameQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx = new RegExp(escaped, "i");
    // Serial id is searchable too so "CUS-VR-01" finds the row the sheet shows.
    match.$or = [
      { fullName: rx },
      { mobileNumber: rx },
      { customSerialId: rx },
    ];
  }

  // Versioned on the customer namespace but reads Sales too, so the sales
  // namespace version is folded into the suffix — otherwise a new sale would
  // leave these totals stale until the TTL expired.
  const salesVersion = await getNsVersion(SALES_NS);
  const cacheKey = await buildCacheKey(
    CUSTOMER_NS,
    `report:customer-balance-summary:s${salesVersion}:${startDate || "any"}:${
      endDate || "any"
    }:${customerId || "all"}:${nameQuery.toLowerCase() || "all"}:${
      customerType || "all"
    }:p${page}:l${limit}`,
  );
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Customer balance summary report fetched successfully",
      { ...cached, fromCache: true },
    );
  }

  // Only completed sales count toward a balance — a draft or pending invoice
  // has not been billed to the customer yet.
  const salesConditions = [
    { $eq: ["$customerType.customerId", "$$cid"] },
    { $eq: ["$invoiceStatus", "complete"] },
  ];
  if (rangeStart && rangeEnd) {
    salesConditions.push({ $gte: ["$date", rangeStart] });
    salesConditions.push({ $lte: ["$date", rangeEnd] });
  }

  const buildStages = () => [
    { $match: match },
    {
      $lookup: {
        from: "customertypes",
        localField: "customerType",
        foreignField: "_id",
        as: "typeInfo",
        pipeline: [{ $project: { customerType: 1 } }],
      },
    },
    { $unwind: { path: "$typeInfo", preserveNullAndEmptyArrays: true } },
    {
      // Summed inside the $lookup so only two numbers come back per customer,
      // rather than every matching sale document.
      $lookup: {
        from: "sales",
        let: { cid: "$_id" },
        as: "salesAgg",
        pipeline: [
          { $match: { $expr: { $and: salesConditions } } },
          {
            $group: {
              _id: null,
              totalSales: { $sum: { $ifNull: ["$payable", 0] } },
              // netPaid is paid minus change given back, so it is the cash the
              // shop actually kept — `paid` alone would overstate on overpay.
              totalPaid: { $sum: { $ifNull: ["$netPaid", 0] } },
            },
          },
        ],
      },
    },
    { $unwind: { path: "$salesAgg", preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        openingBalance: { $ifNull: ["$openingDues", 0] },
        creditLimit: { $ifNull: ["$dueLimit", 0] },
        totalSales: { $ifNull: ["$salesAgg.totalSales", 0] },
        totalPaid: { $ifNull: ["$salesAgg.totalPaid", 0] },
      },
    },
    {
      $addFields: {
        totalBalance: {
          $subtract: [
            { $add: ["$openingBalance", "$totalSales"] },
            "$totalPaid",
          ],
        },
      },
    },
  ];

  const pipeline = [
    ...buildStages(),
    {
      $facet: {
        rows: [
          { $sort: { fullName: 1, _id: 1 } },
          { $skip: skip },
          { $limit: limit },
          {
            $project: {
              _id: 1,
              serialId: { $ifNull: ["$customSerialId", ""] },
              customerName: { $ifNull: ["$fullName", "-"] },
              customerPhone: { $ifNull: ["$mobileNumber", ""] },
              customerType: { $ifNull: ["$typeInfo.customerType", "-"] },
              creditLimit: 1,
              openingBalance: 1,
              totalSales: 1,
              totalPaid: 1,
              totalBalance: 1,
            },
          },
        ],
        totals: [
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              totalCreditLimit: { $sum: "$creditLimit" },
              totalOpeningBalance: { $sum: "$openingBalance" },
              totalSales: { $sum: "$totalSales" },
              totalPaid: { $sum: "$totalPaid" },
              totalBalance: { $sum: "$totalBalance" },
            },
          },
        ],
      },
    },
  ];

  const [result] = await Customer.aggregate(pipeline);
  const rows = result?.rows || [];
  const totals = result?.totals?.[0] || {
    count: 0,
    totalCreditLimit: 0,
    totalOpeningBalance: 0,
    totalSales: 0,
    totalPaid: 0,
    totalBalance: 0,
  };

  const header = await getStoreHeader();

  const payload = {
    header,
    filters: {
      startDate: startDate || null,
      endDate: endDate || null,
      customerId: customerId || null,
      customerName: nameQuery || null,
      customerType: customerType || "ALL",
    },
    rows,
    totals: {
      count: totals.count,
      totalCreditLimit: totals.totalCreditLimit,
      totalOpeningBalance: totals.totalOpeningBalance,
      totalSales: totals.totalSales,
      totalPaid: totals.totalPaid,
      totalBalance: totals.totalBalance,
    },
    pagination: paginationMeta(totals.count, page, limit, skip),
    generatedAt: new Date(),
  };

  await setCache(cacheKey, payload, REPORT_CACHE_TTL);

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Customer balance summary report fetched successfully",
    { ...payload, fromCache: false },
  );
});

// @desc Customers and customer types for the balance summary report's two
// dropdowns. Every active customer is listed, not only those with sales, since
// a customer with opening dues and no sales still appears on the sheet.
exports.getCustomerBalanceSummaryFilters = asynchandeler(async (req, res) => {
  const cacheKey = await buildCacheKey(
    CUSTOMER_NS,
    "report:customer-balance-summary:filters",
  );
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Customer filters fetched successfully",
      { ...cached, fromCache: true },
    );
  }

  const [customers, types] = await Promise.all([
    Customer.find({ isActive: { $ne: false }, deletedAt: null })
      .select("fullName mobileNumber customSerialId")
      .sort({ fullName: 1 })
      .lean(),
    CustomerType.find().select("customerType").sort({ customerType: 1 }).lean(),
  ]);

  const payload = { customers, types };
  await setCache(cacheKey, payload, REPORT_CACHE_TTL);

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Customer filters fetched successfully",
    { ...payload, fromCache: false },
  );
});

// @desc Customer ledger — one date-ordered statement per customer, merging the
// five places a customer's balance moves:
//
//   Opening Balance          received = openingDues,        payment = 0
//   Sales Invoice            received = payable,            payment = netPaid
//   Customer Payment Receive received = 0,                  payment = paidAmount
//   Customer Advance         received = 0,                  payment = paidAmount
//   Sales Return             received = totalReturnAmount,  payment = 0
//
// BALANCE is a running total (received - payment accumulated down the sheet),
// not a per-row figure, so it is computed with $setWindowFields after the union
// is sorted — a per-row subtraction would restart at every line.
//
// The ledger is only meaningful for one customer at a time (the running balance
// of several customers interleaved means nothing), so customerId is required.
exports.getCustomerLedgerReport = asynchandeler(async (req, res) => {
  const { startDate, endDate, customerId } = req.body || {};
  const { page, limit, skip } = parsePagination(req);

  if (!customerId || String(customerId).trim() === "") {
    throw new customError("customerId is required", statusCodes.BAD_REQUEST);
  }
  if (!mongoose.Types.ObjectId.isValid(customerId)) {
    throw new customError("Invalid customerId", statusCodes.BAD_REQUEST);
  }
  const custId = new mongoose.Types.ObjectId(customerId);

  // The range is optional: with no dates the sheet shows the whole history.
  let rangeStart = null;
  let rangeEnd = null;
  if (startDate && endDate) {
    rangeStart = new Date(startDate);
    rangeStart.setHours(0, 0, 0, 0);
    rangeEnd = new Date(endDate);
    rangeEnd.setHours(23, 59, 59, 999);
  }

  const customer = await Customer.findById(custId)
    .select("fullName mobileNumber customSerialId openingDues createdAt")
    .lean();
  if (!customer) {
    throw new customError("Customer not found", statusCodes.NOT_FOUND);
  }

  const salesVersion = await getNsVersion(SALES_NS);
  const paymentVersion = await getNsVersion(CUSTOMER_PAYMENT_NS);
  const advanceVersion = await getNsVersion(CUSTOMER_ADVANCE_NS);
  const returnVersion = await getNsVersion(SALES_RETURN_NS);
  const cacheKey = await buildCacheKey(
    CUSTOMER_NS,
    `report:customer-ledger:s${salesVersion}:p${paymentVersion}:a${advanceVersion}:r${returnVersion}:${customerId}:${
      startDate || "any"
    }:${endDate || "any"}:p${page}:l${limit}`,
  );
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Customer ledger fetched successfully",
      { ...cached, fromCache: true },
    );
  }

  const inRange = (dateExpr) =>
    rangeStart
      ? [{ $gte: [dateExpr, rangeStart] }, { $lte: [dateExpr, rangeEnd] }]
      : [];

  // Every branch projects the same row shape. `sortKey` pins the opening
  // balance to the top of the statement: it is the balance carried in, so it
  // must precede every transaction regardless of the date it was recorded on.
  const rowShape = (
    referenceId,
    description,
    received,
    payment,
    date,
    sortKey = 1,
  ) => ({
    $project: {
      _id: 1,
      date,
      referenceId,
      description,
      received,
      payment,
      sortKey: { $literal: sortKey },
    },
  });

  // --- 1. Opening balance -------------------------------------------------
  // Not a transaction, so it has no serial of its own — the sheet prints N/A.
  // Deliberately NOT date-filtered: the opening balance is the amount carried
  // in before any transaction, so a date range narrows the transactions listed
  // beneath it, never the opening line itself.
  const openingPipeline = [
    { $match: { _id: custId } },
    rowShape(
      { $literal: "N/A" },
      { $literal: "Opening Balance" },
      { $ifNull: ["$openingDues", 0] },
      { $literal: 0 },
      "$createdAt",
      0,
    ),
  ];

  // --- 2. Sales invoices --------------------------------------------------
  const salesPipeline = [
    {
      $match: {
        $expr: {
          $and: [
            { $eq: ["$customerType.customerId", custId] },
            { $eq: ["$invoiceStatus", "complete"] },
            ...inRange("$date"),
          ],
        },
      },
    },
    rowShape(
      { $ifNull: ["$invoiceNumber", "N/A"] },
      { $literal: "Sales Invoice" },
      { $ifNull: ["$payable", 0] },
      { $ifNull: ["$netPaid", 0] },
      "$date",
    ),
  ];

  // --- 3. Customer payment receive ---------------------------------------
  const paymentPipeline = [
    {
      $match: {
        $expr: {
          $and: [
            { $eq: ["$customer", custId] },
            { $ne: ["$isActive", false] },
            { $eq: ["$deletedAt", null] },
            ...inRange("$date"),
          ],
        },
      },
    },
    rowShape(
      { $ifNull: ["$paymentId", "N/A"] },
      { $literal: "Customer Payment Receive" },
      { $literal: 0 },
      { $ifNull: ["$paidAmount", 0] },
      "$date",
    ),
  ];

  // --- 4. Customer advance ------------------------------------------------
  const advancePipeline = [
    {
      $match: {
        $expr: {
          $and: [
            { $eq: ["$customer", custId] },
            { $ne: ["$isActive", false] },
            { $eq: ["$deletedAt", null] },
            ...inRange("$date"),
          ],
        },
      },
    },
    rowShape(
      { $ifNull: ["$paymentId", "N/A"] },
      { $literal: "Customer Advance" },
      { $literal: 0 },
      { $ifNull: ["$paidAmount", 0] },
      "$date",
    ),
  ];

  // --- 5. Sales returns ---------------------------------------------------
  // SalesReturn stores no customer of its own; it reaches one only through the
  // sale it reverses, so the customer filter has to run after that $lookup.
  const returnPipeline = [
    ...(rangeStart ? [{ $match: { $expr: { $and: inRange("$date") } } }] : []),
    {
      $lookup: {
        from: "sales",
        localField: "invoiceNumber",
        foreignField: "_id",
        as: "sale",
        pipeline: [{ $project: { "customerType.customerId": 1 } }],
      },
    },
    { $unwind: { path: "$sale", preserveNullAndEmptyArrays: false } },
    { $match: { "sale.customerType.customerId": custId } },
    rowShape(
      { $ifNull: ["$returnId", "N/A"] },
      { $literal: "Sales Return" },
      { $ifNull: ["$totalReturnAmount", 0] },
      { $literal: 0 },
      "$date",
    ),
  ];

  const ledgerStages = [
    ...openingPipeline,
    { $unionWith: { coll: "sales", pipeline: salesPipeline } },
    { $unionWith: { coll: "customerpaymentreciveds", pipeline: paymentPipeline } },
    {
      $unionWith: {
        coll: "customeradvancepaymentreciveds",
        pipeline: advancePipeline,
      },
    },
    { $unionWith: { coll: "salesreturns", pipeline: returnPipeline } },
    { $sort: { sortKey: 1, date: 1, _id: 1 } },
    {
      // Running balance over every row in the statement, in sorted order.
      $setWindowFields: {
        sortBy: { sortKey: 1, date: 1, _id: 1 },
        output: {
          runningReceived: {
            $sum: "$received",
            window: { documents: ["unbounded", "current"] },
          },
          runningPayment: {
            $sum: "$payment",
            window: { documents: ["unbounded", "current"] },
          },
        },
      },
    },
    {
      $addFields: {
        balance: { $subtract: ["$runningReceived", "$runningPayment"] },
      },
    },
  ];

  const pipeline = [
    ...ledgerStages,
    {
      $facet: {
        rows: [
          { $skip: skip },
          { $limit: limit },
          {
            $project: {
              _id: 1,
              date: 1,
              referenceId: 1,
              description: 1,
              received: 1,
              payment: 1,
              balance: 1,
            },
          },
        ],
        totals: [
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              totalReceived: { $sum: "$received" },
              totalPayment: { $sum: "$payment" },
            },
          },
        ],
      },
    },
  ];

  const [result] = await Customer.aggregate(pipeline);
  const rows = result?.rows || [];
  const totals = result?.totals?.[0] || {
    count: 0,
    totalReceived: 0,
    totalPayment: 0,
  };

  const header = await getStoreHeader();

  const payload = {
    header,
    customer: {
      _id: customer._id,
      serialId: customer.customSerialId || "",
      name: customer.fullName || "-",
      phone: customer.mobileNumber || "",
    },
    filters: {
      startDate: startDate || null,
      endDate: endDate || null,
      customerId,
    },
    rows,
    totals: {
      count: totals.count,
      totalReceived: totals.totalReceived,
      totalPayment: totals.totalPayment,
      // The sheet's TOTAL balance is the closing balance of the whole
      // statement, not the sum of the per-row running balances.
      closingBalance: totals.totalReceived - totals.totalPayment,
    },
    pagination: paginationMeta(totals.count, page, limit, skip),
    generatedAt: new Date(),
  };

  await setCache(cacheKey, payload, REPORT_CACHE_TTL);

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Customer ledger fetched successfully",
    { ...payload, fromCache: false },
  );
});

// @desc Customer due list — one row per customer with what they still owe.
//
//   CUSTOMER INFO    customSerialId + fullName + mobileNumber
//   CUSTOMER TYPE    joined from CustomerType
//   CREDIT LIMIT     the customer's dueLimit (the schema has no creditLimit)
//   DUE INVOICES     count of that customer's sales with paymentStatus "due"
//   TOTAL DUES       the customer's openingDues (the live running balance)
//   LAST SALES DATE  max `date` across their sales — the sale's own date field,
//                    not createdAt
//   LAST PAY DATE    max `date` across their customer payment receives
//
// Customer is the driving collection, not Sales: TOTAL DUES and CREDIT LIMIT
// live on the customer, so a customer carrying a due with no invoice in the
// range must still appear. The date range therefore narrows the joined sales
// and payments, never the customer's own due figure.
exports.getCustomerDueListReport = asynchandeler(async (req, res) => {
  const { startDate, endDate, customerId, customerName, customerType } =
    req.body || {};
  const { page, limit, skip } = parsePagination(req);

  // The range is optional: with no dates the sheet shows all-time figures.
  let rangeStart = null;
  let rangeEnd = null;
  if (startDate && endDate) {
    rangeStart = new Date(startDate);
    rangeStart.setHours(0, 0, 0, 0);
    rangeEnd = new Date(endDate);
    rangeEnd.setHours(23, 59, 59, 999);
  }

  const match = { isActive: { $ne: false }, deletedAt: null };

  if (customerId && String(customerId).trim() !== "") {
    if (!mongoose.Types.ObjectId.isValid(customerId)) {
      throw new customError("Invalid customerId", statusCodes.BAD_REQUEST);
    }
    match._id = new mongoose.Types.ObjectId(customerId);
  }

  if (customerType && String(customerType).trim() !== "") {
    if (!mongoose.Types.ObjectId.isValid(customerType)) {
      throw new customError("Invalid customerType", statusCodes.BAD_REQUEST);
    }
    match.customerType = new mongoose.Types.ObjectId(customerType);
  }

  const nameQuery = typeof customerName === "string" ? customerName.trim() : "";
  if (nameQuery) {
    const escaped = nameQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx = new RegExp(escaped, "i");
    match.$or = [
      { fullName: rx },
      { mobileNumber: rx },
      { customSerialId: rx },
    ];
  }

  const salesVersion = await getNsVersion(SALES_NS);
  const paymentVersion = await getNsVersion(CUSTOMER_PAYMENT_NS);
  const cacheKey = await buildCacheKey(
    CUSTOMER_NS,
    `report:customer-due-list:s${salesVersion}:p${paymentVersion}:${
      startDate || "any"
    }:${endDate || "any"}:${customerId || "all"}:${
      nameQuery.toLowerCase() || "all"
    }:${customerType || "all"}:p${page}:l${limit}`,
  );
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Customer due list fetched successfully",
      { ...cached, fromCache: true },
    );
  }

  const inRange = (field) =>
    rangeStart
      ? [{ $gte: [field, rangeStart] }, { $lte: [field, rangeEnd] }]
      : [];

  const pipeline = [
    { $match: match },
    {
      $lookup: {
        from: "customertypes",
        localField: "customerType",
        foreignField: "_id",
        as: "typeInfo",
        pipeline: [{ $project: { customerType: 1 } }],
      },
    },
    { $unwind: { path: "$typeInfo", preserveNullAndEmptyArrays: true } },
    {
      // Both figures come from one pass over the customer's sales: the count of
      // still-owing invoices, and the latest sale date. Only completed invoices
      // count — a draft or pending one has not been billed yet.
      $lookup: {
        from: "sales",
        let: { cid: "$_id" },
        as: "salesAgg",
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$customerType.customerId", "$$cid"] },
                  { $eq: ["$invoiceStatus", "complete"] },
                  ...inRange("$date"),
                ],
              },
            },
          },
          {
            $group: {
              _id: null,
              dueInvoices: {
                $sum: { $cond: [{ $eq: ["$paymentStatus", "due"] }, 1, 0] },
              },
              // The sale's own date field, not createdAt.
              lastSalesDate: { $max: "$date" },
            },
          },
        ],
      },
    },
    { $unwind: { path: "$salesAgg", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "customerpaymentreciveds",
        let: { cid: "$_id" },
        as: "payAgg",
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$customer", "$$cid"] },
                  { $ne: ["$isActive", false] },
                  { $eq: ["$deletedAt", null] },
                  ...inRange("$date"),
                ],
              },
            },
          },
          { $group: { _id: null, lastPayDate: { $max: "$date" } } },
        ],
      },
    },
    { $unwind: { path: "$payAgg", preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        creditLimit: { $ifNull: ["$dueLimit", 0] },
        totalDues: { $ifNull: ["$openingDues", 0] },
        dueInvoices: { $ifNull: ["$salesAgg.dueInvoices", 0] },
        lastSalesDate: "$salesAgg.lastSalesDate",
        lastPayDate: "$payAgg.lastPayDate",
      },
    },
    {
      $facet: {
        rows: [
          { $sort: { totalDues: -1, fullName: 1, _id: 1 } },
          { $skip: skip },
          { $limit: limit },
          {
            $project: {
              _id: 1,
              serialId: { $ifNull: ["$customSerialId", ""] },
              customerName: { $ifNull: ["$fullName", "-"] },
              customerPhone: { $ifNull: ["$mobileNumber", ""] },
              customerType: { $ifNull: ["$typeInfo.customerType", "-"] },
              creditLimit: 1,
              dueInvoices: 1,
              totalDues: 1,
              lastSalesDate: 1,
              lastPayDate: 1,
            },
          },
        ],
        totals: [
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              totalCreditLimit: { $sum: "$creditLimit" },
              totalDueInvoices: { $sum: "$dueInvoices" },
              totalDues: { $sum: "$totalDues" },
            },
          },
        ],
      },
    },
  ];

  const [result] = await Customer.aggregate(pipeline);
  const rows = result?.rows || [];
  const totals = result?.totals?.[0] || {
    count: 0,
    totalCreditLimit: 0,
    totalDueInvoices: 0,
    totalDues: 0,
  };

  const header = await getStoreHeader();

  const payload = {
    header,
    filters: {
      startDate: startDate || null,
      endDate: endDate || null,
      customerId: customerId || null,
      customerName: nameQuery || null,
      customerType: customerType || "ALL",
    },
    rows,
    totals: {
      count: totals.count,
      totalCreditLimit: totals.totalCreditLimit,
      totalDueInvoices: totals.totalDueInvoices,
      totalDues: totals.totalDues,
    },
    pagination: paginationMeta(totals.count, page, limit, skip),
    generatedAt: new Date(),
  };

  await setCache(cacheKey, payload, REPORT_CACHE_TTL);

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Customer due list fetched successfully",
    { ...payload, fromCache: false },
  );
});
