const mongoose = require("mongoose");
const PurchaseReturn = require("../models/purchaseReturn.model");
const Product = require("../models/product.model");
const Variant = require("../models/variant.model");
const { SupplierModel } = require("../models/supplier.model");
const Account = require("../models/account.model");
const CrateTransaction = require("../models/crateTransaction.model");
const { SYSTEM_CATEGORIES, getSystemCategory } = require("../utils/systemCategory.util");
const { customError } = require("../lib/CustomError");
const { apiResponse } = require("../utils/apiResponse");
const { asynchandeler } = require("../lib/asyncHandeler");
const { statusCodes } = require("../constant/constant");
const {
  getCache,
  setCache,
  bumpNsVersion,
  buildCacheKey,
} = require("@/utils/cache.util");

const NS = "purchase-return";
const CACHE_TTL = 60 * 60;

// ─── helpers ─────────────────────────────────────────────────────────────────

function validatePayload(body) {
  const { supplier, products } = body;
  if (!supplier) {
    throw new customError("Supplier is required", statusCodes.BAD_REQUEST);
  }
  if (!mongoose.Types.ObjectId.isValid(supplier)) {
    throw new customError("Invalid supplier ID", statusCodes.BAD_REQUEST);
  }
  // The refund is paid into a real account, so the account has to be named.
  // Without it the money would have nowhere to land and the return would
  // silently move stock only.
  if (!body.cashType) {
    throw new customError("Refund account is required", statusCodes.BAD_REQUEST);
  }
  if (!mongoose.Types.ObjectId.isValid(body.cashType)) {
    throw new customError("Invalid refund account ID", statusCodes.BAD_REQUEST);
  }
  if (!Array.isArray(products) || products.length === 0) {
    throw new customError(
      "At least one product is required",
      statusCodes.BAD_REQUEST,
    );
  }
  for (const item of products) {
    if (!item.product && !item.variant) {
      throw new customError(
        "Each item must have a product or variant",
        statusCodes.BAD_REQUEST,
      );
    }
    if (!item.quantity || item.quantity < 1) {
      throw new customError(
        "Each item must have a quantity of at least 1",
        statusCodes.BAD_REQUEST,
      );
    }
    if (!item.purchasePrice || item.purchasePrice <= 0) {
      throw new customError(
        "Each item must have a valid purchasePrice",
        statusCodes.BAD_REQUEST,
      );
    }
  }
}

// Refunds are filed under one fixed system category (see
// utils/systemCategory.util.js).
const getRefundCategory = (session) =>
  getSystemCategory(SYSTEM_CATEGORIES.PURCHASE_RETURN_REFUND, session);

// Credit the full return value into the chosen account and log a matching
// "cash recived" transaction, tagged with purchaseReturnReference so the
// refund can be found and reversed later.
const applyPurchaseReturnRefund = async (session, purchaseReturn) => {
  const amount = Number(purchaseReturn.totalReturnAmount || 0);
  if (amount <= 0 || !purchaseReturn.cashType) return;

  const category = await getRefundCategory(session);

  const updatedAccount = await Account.findByIdAndUpdate(
    purchaseReturn.cashType,
    { $inc: { balance: amount } },
    { new: true, session },
  );
  if (!updatedAccount) {
    throw new customError("Refund account not found", statusCodes.NOT_FOUND);
  }

  await CrateTransaction.create(
    [
      {
        date: purchaseReturn.returnDate || new Date(),
        transactionCategory: category._id,
        account: purchaseReturn.cashType,
        transactionDescription: `Purchase return refund — ${purchaseReturn.serial || purchaseReturn._id}`,
        transactionType: "cash recived",
        amount,
        balanceAfter: updatedAccount.balance,
        purchaseReturnReference: purchaseReturn._id,
      },
    ],
    { session },
  );

  await bumpNsVersion("account");
};

// Undo whatever this return credited — subtract each amount back out of its
// account and delete the audit records tied to this return.
const reversePurchaseReturnRefund = async (session, purchaseReturnId) => {
  const transactions = await CrateTransaction.find({
    purchaseReturnReference: purchaseReturnId,
  }).session(session);
  if (!transactions.length) return;

  for (const t of transactions) {
    await Account.findByIdAndUpdate(
      t.account,
      { $inc: { balance: -t.amount } },
      { session },
    );
  }

  await CrateTransaction.deleteMany({
    purchaseReturnReference: purchaseReturnId,
  }).session(session);
  await bumpNsVersion("account");
};

// Take the return value off the supplier's running due, clamped at 0 since
// openingDues cannot go negative. The amount actually taken is stored on the
// return as dueReduced so an edit or delete can put back exactly that.
// This runs alongside the cash refund: the business wants both the due
// lowered and the refund credited to the chosen account.
const applyPurchaseReturnDue = async (session, purchaseReturn) => {
  const amount = Number(purchaseReturn.totalReturnAmount || 0);
  const supplier = await SupplierModel.findById(purchaseReturn.supplier).session(
    session,
  );
  if (!supplier) {
    throw new customError("Supplier not found", statusCodes.NOT_FOUND);
  }

  const dueReduced = Math.min(Number(supplier.openingDues || 0), amount);
  if (dueReduced > 0) {
    await SupplierModel.updateOne(
      { _id: supplier._id },
      { $inc: { openingDues: -dueReduced } },
      { session },
    );
  }

  purchaseReturn.dueReduced = dueReduced;
  await PurchaseReturn.updateOne(
    { _id: purchaseReturn._id },
    { $set: { dueReduced } },
    { session },
  );
};

// Put back whatever this return took off the supplier's due.
const reversePurchaseReturnDue = async (session, purchaseReturn) => {
  const dueReduced = Number(purchaseReturn.dueReduced || 0);
  if (dueReduced <= 0) return;

  await SupplierModel.updateOne(
    { _id: purchaseReturn.supplier },
    { $inc: { openingDues: dueReduced } },
    { session },
  );
  purchaseReturn.dueReduced = 0;
};

// ─── createPurchaseReturn ────────────────────────────────────────────────────

exports.createPurchaseReturn = asynchandeler(async (req, res) => {
  const { supplier, returnDate, remarks, products } = req.body;

  validatePayload(req.body);

  const productIds = [
    ...new Set(
      products.filter((i) => i.product).map((i) => i.product.toString()),
    ),
  ];
  const variantIds = [
    ...new Set(
      products.filter((i) => i.variant).map((i) => i.variant.toString()),
    ),
  ];

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Batch fetch — sequential on same session (Promise.all on one session corrupts txn counter)
    const supplierDoc = await SupplierModel.findById(supplier).session(session);
    const productDocs = productIds.length
      ? await Product.find({ _id: { $in: productIds } })
          .select("_id stock")
          .session(session)
      : [];
    const variantDocs = variantIds.length
      ? await Variant.find({ _id: { $in: variantIds } })
          .select("_id stockVariant")
          .session(session)
      : [];

    if (!supplierDoc) {
      throw new customError("Supplier not found", statusCodes.NOT_FOUND);
    }

    const productMap = Object.fromEntries(
      productDocs.map((p) => [p._id.toString(), p]),
    );
    const variantMap = Object.fromEntries(
      variantDocs.map((v) => [v._id.toString(), v]),
    );

    // Stock validation & subtotal calculation
    let totalReturnAmount = 0;
    const returnProducts = [];

    for (const item of products) {
      const qty = Number(item.quantity);
      const price = Number(item.purchasePrice);

      if (item.variant) {
        const v = variantMap[item.variant.toString()];
        if (!v) {
          throw new customError(
            `Variant ${item.variant} not found`,
            statusCodes.NOT_FOUND,
          );
        }
        if (v.stockVariant < qty) {
          throw new customError(
            `Return quantity (${qty}) exceeds available variant stock (${v.stockVariant})`,
            statusCodes.BAD_REQUEST,
          );
        }
      } else {
        const p = productMap[item.product.toString()];
        if (!p) {
          throw new customError(
            `Product ${item.product} not found`,
            statusCodes.NOT_FOUND,
          );
        }
        if (p.stock < qty) {
          throw new customError(
            `Return quantity (${qty}) exceeds available product stock (${p.stock})`,
            statusCodes.BAD_REQUEST,
          );
        }
      }

      const subtotal = price * qty;
      totalReturnAmount += subtotal;

      returnProducts.push({
        product: item.product || null,
        variant: item.variant || null,
        quantity: qty,
        purchasePrice: price,
        subtotal,
      });
    }

    // Create the return document
    const [purchaseReturn] = await PurchaseReturn.create(
      [
        {
          supplier,
          cashType: req.body.cashType,
          returnDate: returnDate || Date.now(),
          remarks: remarks || "",
          totalReturnAmount,
          products: returnProducts,
        },
      ],
      { session },
    );

    // Bulk update product stock
    // The $gte guard makes the check atomic with the decrement: a row whose
    // stock has already dropped below the returned quantity simply will not
    // match, so stock can never be driven negative. matchedCount catching the
    // shortfall is what turns that into a rejected return rather than a
    // silently skipped one.
    if (productIds.length) {
      // A variant line carries its parent product's id too, so the stock for
      // it lives on the Variant (stockVariant), never on the Product. Matching
      // on `i.product` alone also decremented the parent Product, whose own
      // `stock` is 0 for variant-based products — the filter never matched and
      // the whole return was rejected as "not enough product stock". Only
      // lines with no variant are product-stock lines.
      const productOps = returnProducts
        .filter((i) => i.product && !i.variant)
        .map((i) => ({
          updateOne: {
            filter: { _id: i.product, stock: { $gte: i.quantity } },
            update: {
              $inc: {
                stock: -i.quantity,
                purchaseReturnStock: i.quantity,
              },
            },
          },
        }));
      if (productOps.length) {
        const r = await Product.bulkWrite(productOps, { session });
        if (r.matchedCount !== productOps.length) {
          throw new customError(
            "Not enough product stock to return some items",
            statusCodes.BAD_REQUEST,
          );
        }
      }
    }

    // Bulk update variant stock
    if (variantIds.length) {
      const variantOps = returnProducts
        .filter((i) => i.variant)
        .map((i) => ({
          updateOne: {
            filter: { _id: i.variant, stockVariant: { $gte: i.quantity } },
            update: {
              $inc: {
                stockVariant: -i.quantity,
                purchaseReturnStock: i.quantity,
              },
            },
          },
        }));
      if (variantOps.length) {
        const r = await Variant.bulkWrite(variantOps, { session });
        if (r.matchedCount !== variantOps.length) {
          throw new customError(
            "Not enough variant stock to return some items",
            statusCodes.BAD_REQUEST,
          );
        }
      }
    }

    // The return lowers the supplier's due and its value is credited to the
    // chosen account.
    await applyPurchaseReturnDue(session, purchaseReturn);
    await applyPurchaseReturnRefund(session, purchaseReturn);

    await session.commitTransaction();
    session.endSession();

    await bumpNsVersion(NS);
    await bumpNsVersion("supplier");
    // Also bump product cache — this endpoint mutates stock/stockVariant and
    // purchaseReturnStock on Product/Variant, which /product/* endpoints cache.
    await bumpNsVersion("product");

    return apiResponse.sendSuccess(
      res,
      statusCodes.CREATED,
      "Purchase return created successfully",
      purchaseReturn,
    );
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
});

// ─── getPurchaseReturn ───────────────────────────────────────────────────────

exports.getPurchaseReturn = asynchandeler(async (req, res) => {
  const {
    serial,
    supplierId,
    supplierName,
    productName,
    variantName,
    returnDate,
    startDate,
    endDate,
    page = 1,
    limit = 20,
    sort = "-createdAt",
  } = req.query;

  const isSearch =
    serial || supplierId || supplierName || productName || variantName || returnDate || startDate || endDate;

  // Only use cache for plain list (no filters)
  if (!isSearch) {
    const cacheKey = await buildCacheKey(
      NS,
      `list:page=${page}:limit=${limit}:sort=${sort}`,
    );
    const cached = await getCache(cacheKey);
    if (cached) {
      return apiResponse.sendSuccess(
        res,
        statusCodes.OK,
        "Purchase returns fetched successfully",
        { ...cached, fromCache: true },
      );
    }
  }

  const filter = {};

  // Serial filter (exact, e.g. PURR-SI-01)
  if (serial) {
    filter.serial = serial.trim();
  }

  // Supplier filter
  if (supplierId) {
    if (!mongoose.Types.ObjectId.isValid(supplierId)) {
      throw new customError("Invalid supplierId", statusCodes.BAD_REQUEST);
    }
    filter.supplier = supplierId;
  } else if (supplierName) {
    const matched = await SupplierModel.find({
      supplierName: { $regex: supplierName.trim(), $options: "i" },
    })
      .select("_id")
      .lean();
    filter.supplier = { $in: matched.map((s) => s._id) };
  }

  // Product/Variant name filter (find matching IDs first)
  if (productName) {
    const matchedProducts = await Product.find({
      name: { $regex: productName.trim(), $options: "i" },
    })
      .select("_id")
      .lean();
    filter["products.product"] = { $in: matchedProducts.map((p) => p._id) };
  }

  if (variantName) {
    const matchedVariants = await Variant.find({
      variantName: { $regex: variantName.trim(), $options: "i" },
    })
      .select("_id")
      .lean();
    filter["products.variant"] = { $in: matchedVariants.map((v) => v._id) };
  }

  // Date filters
  if (returnDate) {
    const day = new Date(returnDate);
    const next = new Date(returnDate);
    next.setDate(next.getDate() + 1);
    filter.returnDate = { $gte: day, $lt: next };
  } else if (startDate || endDate) {
    filter.returnDate = {};
    if (startDate) filter.returnDate.$gte = new Date(startDate);
    if (endDate) filter.returnDate.$lte = new Date(endDate);
  }

  const skip = (Number(page) - 1) * Number(limit);

  const [purchaseReturns, total] = await Promise.all([
    PurchaseReturn.find(filter)
      .populate("supplier", "supplierName supplierId mobile openingDues totalPurchaseDue")
      .populate("products.product", "name stock purchaseReturnStock barCode")
      .populate("products.variant", "variantName stockVariant purchaseReturnStock barCode size color")
      .sort(sort)
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    PurchaseReturn.countDocuments(filter),
  ]);

  if (!purchaseReturns.length) {
    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Purchase return not found",
      {
        purchaseReturns: [],
        total: 0,
        page: Number(page),
        totalPages: 0,
        fromCache: false,
      },
    );
  }

  const result = {
    purchaseReturns,
    total,
    page: Number(page),
    totalPages: Math.ceil(total / Number(limit)),
    fromCache: false,
  };

  if (!isSearch) {
    const cacheKey = await buildCacheKey(
      NS,
      `list:page=${page}:limit=${limit}:sort=${sort}`,
    );
    await setCache(cacheKey, result, CACHE_TTL);
  }

  return apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Purchase returns fetched successfully",
    result,
  );
});

// ─── getSinglePurchaseReturn ─────────────────────────────────────────────────

exports.getSinglePurchaseReturn = asynchandeler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new customError("Invalid ID", statusCodes.BAD_REQUEST);
  }

  const cacheKey = await buildCacheKey(NS, `id:${id}`);
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Purchase return fetched successfully",
      { purchaseReturn: cached, fromCache: true },
    );
  }

  const purchaseReturn = await PurchaseReturn.findById(id)
    .populate("supplier", "supplierName supplierId mobile openingDues totalPurchaseDue")
    .populate("products.product", "name stock purchaseReturnStock barCode")
    .populate("products.variant", "variantName stockVariant purchaseReturnStock barCode size color")
    .lean();

  if (!purchaseReturn) {
    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Purchase return not found",
      { purchaseReturn: null, fromCache: false },
    );
  }

  await setCache(cacheKey, purchaseReturn, CACHE_TTL);

  return apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Purchase return fetched successfully",
    { purchaseReturn, fromCache: false },
  );
});

// ─── updatePurchaseReturn ────────────────────────────────────────────────────

exports.updatePurchaseReturn = asynchandeler(async (req, res) => {
  const { id } = req.params;
  const { supplier, returnDate, remarks, products } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new customError("Invalid ID", statusCodes.BAD_REQUEST);
  }

  validatePayload(req.body);

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const existing = await PurchaseReturn.findById(id).session(session);
    if (!existing) {
      throw new customError("Purchase return not found", statusCodes.NOT_FOUND);
    }

    const oldSupplier = await SupplierModel.findById(
      existing.supplier,
    ).session(session);

    // ── STEP 1: Revert old stock ────────────────────────────────────────────

    // Variant lines carry their parent product id as well, but their stock
    // only ever moved on the Variant. Reverting them here would add stock back
    // to a Product that was never decremented, inflating inventory.
    const oldProductOps = existing.products
      .filter((i) => i.product && !i.variant)
      .map((i) => ({
        updateOne: {
          filter: { _id: i.product },
          update: {
            $inc: {
              stock: i.quantity,
              purchaseReturnStock: -i.quantity,
            },
          },
        },
      }));

    const oldVariantOps = existing.products
      .filter((i) => i.variant)
      .map((i) => ({
        updateOne: {
          filter: { _id: i.variant },
          update: {
            $inc: {
              stockVariant: i.quantity,
              purchaseReturnStock: -i.quantity,
            },
          },
        },
      }));

    if (oldProductOps.length) {
      await Product.bulkWrite(oldProductOps, { session });
    }
    if (oldVariantOps.length) {
      await Variant.bulkWrite(oldVariantOps, { session });
    }

    // Undo the due reduction and the cash refund this return already made,
    // on the supplier it was made against.
    await reversePurchaseReturnDue(session, existing);
    await reversePurchaseReturnRefund(session, existing._id);

    // ── STEP 2: Validate new payload & fetch new docs ───────────────────────

    const newProductIds = [
      ...new Set(
        products.filter((i) => i.product).map((i) => i.product.toString()),
      ),
    ];
    const newVariantIds = [
      ...new Set(
        products.filter((i) => i.variant).map((i) => i.variant.toString()),
      ),
    ];

    const newProductDocs = newProductIds.length
      ? await Product.find({ _id: { $in: newProductIds } })
          .select("_id stock")
          .session(session)
      : [];
    const newVariantDocs = newVariantIds.length
      ? await Variant.find({ _id: { $in: newVariantIds } })
          .select("_id stockVariant")
          .session(session)
      : [];
    const newSupplierDoc =
      supplier !== existing.supplier.toString()
        ? await SupplierModel.findById(supplier).session(session)
        : oldSupplier;

    if (!newSupplierDoc) {
      throw new customError("New supplier not found", statusCodes.NOT_FOUND);
    }

    const newProductMap = Object.fromEntries(
      newProductDocs.map((p) => [p._id.toString(), p]),
    );
    const newVariantMap = Object.fromEntries(
      newVariantDocs.map((v) => [v._id.toString(), v]),
    );

    let totalReturnAmount = 0;
    const returnProducts = [];

    for (const item of products) {
      const qty = Number(item.quantity);
      const price = Number(item.purchasePrice);

      if (item.variant) {
        const v = newVariantMap[item.variant.toString()];
        if (!v) {
          throw new customError(
            `Variant ${item.variant} not found`,
            statusCodes.NOT_FOUND,
          );
        }
        if (v.stockVariant < qty) {
          throw new customError(
            `Return quantity (${qty}) exceeds available variant stock (${v.stockVariant})`,
            statusCodes.BAD_REQUEST,
          );
        }
      } else {
        const p = newProductMap[item.product.toString()];
        if (!p) {
          throw new customError(
            `Product ${item.product} not found`,
            statusCodes.NOT_FOUND,
          );
        }
        if (p.stock < qty) {
          throw new customError(
            `Return quantity (${qty}) exceeds available product stock (${p.stock})`,
            statusCodes.BAD_REQUEST,
          );
        }
      }

      const subtotal = price * qty;
      totalReturnAmount += subtotal;
      returnProducts.push({
        product: item.product || null,
        variant: item.variant || null,
        quantity: qty,
        purchasePrice: price,
        subtotal,
      });
    }

    // ── STEP 3: Apply new stock ─────────────────────────────────────────────

    // Guarded the same way as the create path: the $gte makes the check
    // atomic with the decrement so stock cannot go negative, and the
    // matchedCount shortfall rejects the update instead of skipping rows.
    // Only lines with no variant are product-stock lines — see the create path.
    const newProductOps = returnProducts
      .filter((i) => i.product && !i.variant)
      .map((i) => ({
        updateOne: {
          filter: { _id: i.product, stock: { $gte: i.quantity } },
          update: {
            $inc: {
              stock: -i.quantity,
              purchaseReturnStock: i.quantity,
            },
          },
        },
      }));

    const newVariantOps = returnProducts
      .filter((i) => i.variant)
      .map((i) => ({
        updateOne: {
          filter: { _id: i.variant, stockVariant: { $gte: i.quantity } },
          update: {
            $inc: {
              stockVariant: -i.quantity,
              purchaseReturnStock: i.quantity,
            },
          },
        },
      }));

    if (newProductOps.length) {
      const r = await Product.bulkWrite(newProductOps, { session });
      if (r.matchedCount !== newProductOps.length) {
        throw new customError(
          "Not enough product stock to return some items",
          statusCodes.BAD_REQUEST,
        );
      }
    }
    if (newVariantOps.length) {
      const r = await Variant.bulkWrite(newVariantOps, { session });
      if (r.matchedCount !== newVariantOps.length) {
        throw new customError(
          "Not enough variant stock to return some items",
          statusCodes.BAD_REQUEST,
        );
      }
    }

    // ── STEP 4: Update the return document ─────────────────────────────────

    existing.supplier = supplier;
    existing.cashType = req.body.cashType;
    existing.returnDate = returnDate || existing.returnDate;
    existing.remarks = remarks ?? existing.remarks;
    existing.products = returnProducts;
    existing.totalReturnAmount = totalReturnAmount;
    await existing.save({ session });

    // Re-apply the due reduction and the refund at the new amount, against
    // whichever supplier and account are now chosen. The old ones were
    // already reversed in STEP 1.
    await applyPurchaseReturnDue(session, existing);
    await applyPurchaseReturnRefund(session, existing);

    await session.commitTransaction();
    session.endSession();

    await bumpNsVersion(NS);
    await bumpNsVersion("supplier");
    // Also bump product cache — this endpoint mutates stock/stockVariant and
    // purchaseReturnStock on Product/Variant, which /product/* endpoints cache.
    await bumpNsVersion("product");

    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Purchase return updated successfully",
      existing,
    );
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
});

// ─── deletePurchaseReturn ────────────────────────────────────────────────────

exports.deletePurchaseReturn = asynchandeler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new customError("Invalid ID", statusCodes.BAD_REQUEST);
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const purchaseReturn = await PurchaseReturn.findById(id).session(session);
    if (!purchaseReturn) {
      throw new customError("Purchase return not found", statusCodes.NOT_FOUND);
    }

    // Revert stock
    // Variant lines never moved Product.stock, so they must not be reverted
    // against it — see the update path's revert block.
    const productOps = purchaseReturn.products
      .filter((i) => i.product && !i.variant)
      .map((i) => ({
        updateOne: {
          filter: { _id: i.product },
          update: {
            $inc: {
              stock: i.quantity,
              purchaseReturnStock: -i.quantity,
            },
          },
        },
      }));

    const variantOps = purchaseReturn.products
      .filter((i) => i.variant)
      .map((i) => ({
        updateOne: {
          filter: { _id: i.variant },
          update: {
            $inc: {
              stockVariant: i.quantity,
              purchaseReturnStock: -i.quantity,
            },
          },
        },
      }));

    if (productOps.length) await Product.bulkWrite(productOps, { session });
    if (variantOps.length) await Variant.bulkWrite(variantOps, { session });

    // Put the due reduction back on the supplier, take the refunded cash back
    // out of the account it was paid into and delete its audit row.
    await reversePurchaseReturnDue(session, purchaseReturn);
    await reversePurchaseReturnRefund(session, purchaseReturn._id);

    await PurchaseReturn.findByIdAndDelete(id).session(session);

    await session.commitTransaction();
    session.endSession();

    await bumpNsVersion(NS);
    await bumpNsVersion("supplier");
    // Also bump product cache — this endpoint mutates stock/stockVariant and
    // purchaseReturnStock on Product/Variant, which /product/* endpoints cache.
    await bumpNsVersion("product");

    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Purchase return deleted successfully",
      null,
    );
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
});
