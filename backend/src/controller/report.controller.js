const mongoose = require("mongoose");
const { asynchandeler } = require("../lib/asyncHandeler");
const { customError } = require("../lib/CustomError");
const { apiResponse } = require("../utils/apiResponse");
const { statusCodes } = require("../constant/constant");
const Purchase = require("../models/purchase.model");
const Sales = require("../models/sales.model");
const SalesReturn = require("../models/salesReturn.model");
const { customerModel: Customer } = require("../models/customer.model");
const Employee = require("../models/employee.model");
const Supplier = require("../models/supplier.model").SupplierModel;
const StoreInformation = require("../models/storeInformation.model");
const { getCache, setCache, buildCacheKey } = require("@/utils/cache.util");

// Shares invalidation with purchase.controller.js (bumpNsVersion("purchase")
// already runs on create/update/delete there) and storeInformation.controller.js
// (bumpNsVersion("storeinformation") on save) — no extra invalidation wiring needed.
const PURCHASE_NS = "purchase";
const SALES_NS = "sales";
const STORE_NS = "storeinformation";
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

// @desc Purchase invoice report — one row per purchase invoice, date range + optional supplier filter, paginated
exports.getPurchaseInvoiceReport = asynchandeler(async (req, res) => {
  const { startDate, endDate, supplierId, supplierName } = req.body || {};
  const { page, limit, skip } = parsePagination(req);

  if (!startDate || !endDate) {
    throw new customError("startDate and endDate are required", statusCodes.BAD_REQUEST);
  }

  const match = { date: { $gte: new Date(startDate), $lte: new Date(endDate) } };
  castObjectIdFilter(match, "supplierId", supplierId);

  const cacheKey = await buildCacheKey(
    PURCHASE_NS,
    `report:purchase-invoice:${startDate}:${endDate}:${supplierId || "all"}:${(supplierName || "").trim().toLowerCase()}:p${page}:l${limit}`,
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
              commission: 1,
              delivery: "$shipping",
              payable: 1,
              paid: 1,
              due: "$dueamount",
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
    totalCommission: 0,
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
      supplier: supplierName?.trim() || (supplierId ? "Selected supplier" : "ALL"),
    },
    rows,
    totals: {
      count: totals.count,
      totalAmount: totals.totalAmount,
      totalCommission: totals.totalCommission,
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
    `report:purchase-product:${startDate}:${endDate}:${supplierId || "all"}:${(supplierName || "").trim().toLowerCase()}:${category || "-"}:${subCategory || "-"}:${brand || "-"}:p${page}:l${limit}`,
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
              pipeline: [{ $project: { name: 1 } }],
            },
          },
          { $unwind: { path: "$variantProduct", preserveNullAndEmptyArrays: true } },
        ],
      },
    },
    { $unwind: { path: "$variantInfo", preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        lineProductName: { $ifNull: ["$variantInfo.variantProduct.name", "$productInfo.name"] },
        lineBarcode: { $ifNull: ["$variantInfo.barCode", "$productInfo.barCode"] },
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
              color: "$allproduct.color",
              size: "$allproduct.size",
              buyRate: "$allproduct.purchasePrice",
              qty: "$allproduct.quantity",
              wsPrice: "$allproduct.wholesalePrice",
              rsPrice: "$allproduct.retailPrice",
              buyTotal: "$allproduct.subTotal",
            },
          },
        ],
        totals: [
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              totalBuyRate: { $sum: "$allproduct.purchasePrice" },
              totalQty: { $sum: "$allproduct.quantity" },
              totalWsPrice: { $sum: "$allproduct.wholesalePrice" },
              totalRsPrice: { $sum: "$allproduct.retailPrice" },
              totalBuyTotal: { $sum: "$allproduct.subTotal" },
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
  const rangeEnd = new Date(endDate);

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
          discount: {
            $sum: { $multiply: ["$total", { $divide: [{ $ifNull: ["$discountPercent", 0] }, 100] }] },
          },
          deliveryCost: { $sum: { $ifNull: ["$deliveryCost", 0] } },
          labourCost: { $sum: { $ifNull: ["$labourCost", 0] } },
          payable: { $sum: { $ifNull: ["$payable", 0] } },
          paid: { $sum: { $ifNull: ["$paid", 0] } },
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
  const salesIdsInRange = await Sales.find(match).distinct("_id");
  const [returnAgg] = salesIdsInRange.length
    ? await SalesReturn.aggregate([
        { $match: { invoiceNumber: { $in: salesIdsInRange } } },
        { $group: { _id: null, totalReturn: { $sum: { $ifNull: ["$totalReturnAmount", 0] } } } },
      ])
    : [];

  // ---- 5. Account summary (which account received the money) ----
  const accountRows = await Sales.aggregate([
    { $match: match },
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
    { $group: { _id: "$payments.paymentTo", totalAmount: { $sum: "$payments.amount" } } },
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
      discount: s.discount || 0,
      returnAmount: returnAgg?.totalReturn || 0,
      deliveryCost: s.deliveryCost || 0,
      labourCost: s.labourCost || 0,
      payable: s.payable || 0,
      paid: s.paid || 0,
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
