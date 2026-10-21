const mongoose = require("mongoose");
const Purchase = require("../models/purchase.model");
const Product = require("../models/product.model");
const Variant = require("../models/variant.model");
const { SupplierModel } = require("../models/supplier.model");
const Account = require("../models/account.model");
const CrateTransaction = require("../models/crateTransaction.model");
const { SYSTEM_CATEGORIES, getSystemCategory } = require("../utils/systemCategory.util");
const { customError } = require("../lib/CustomError");
const { apiResponse } = require("../utils/apiResponse");
const { asynchandeler } = require("../lib/asyncHandeler");
const { retryTransientErrors } = require("../utils/transaction.util");
const { statusCodes } = require("../constant/constant");
const {
  getCache,
  setCache,
  bumpNsVersion,
  buildCacheKey,
} = require("@/utils/cache.util");

const NS = "purchase";
const CACHE_TTL = 60 * 60; // 1 hour

// Purchase payments are always money going out, filed under one fixed
// system category (see utils/systemCategory.util.js).
const getPurchasePaymentCategory = (session) =>
  getSystemCategory(SYSTEM_CATEGORIES.PURCHASE_PAYMENT, session);

// The form caps paid at payable, but a client can be bypassed: paying a
// supplier more than the purchase is worth would push a negative due into the
// supplier's balance and the ledger.
const assertPaidWithinPayable = (paid, payable) => {
  const paidAmount = Number(paid) || 0;
  if (paidAmount < 0) {
    throw new customError("Paid amount cannot be negative", statusCodes.BAD_REQUEST);
  }
  if (paidAmount > (Number(payable) || 0)) {
    throw new customError(
      "Paid amount cannot be more than the payable amount",
      statusCodes.BAD_REQUEST,
    );
  }
};

// Subtract the paid amount from the chosen (cashType) account and record a
// matching "cash payment" transaction (tagged with purchaseReference).
const applyPurchasePayment = async (session, purchase) => {
  const amount = Number(purchase.paid || 0);
  if (amount <= 0 || !purchase.cashType) return;

  const category = await getPurchasePaymentCategory(session);

  const updatedAccount = await Account.findByIdAndUpdate(
    purchase.cashType,
    { $inc: { balance: -amount } },
    { new: true, session },
  );
  if (!updatedAccount) {
    throw new customError("Payment account not found", statusCodes.NOT_FOUND);
  }

  await CrateTransaction.create(
    [
      {
        date: purchase.date || new Date(),
        transactionCategory: category._id,
        account: purchase.cashType,
        transactionDescription: `Purchase payment — ${purchase.invoiceNumber || purchase._id}`,
        transactionType: "cash payment",
        amount,
        balanceAfter: updatedAccount.balance,
        purchaseReference: purchase._id,
      },
    ],
    { session },
  );

  await bumpNsVersion("account");
};

// Undo whatever this purchase subtracted from an account — add the amount
// back and delete the audit record(s) tied to this purchase.
const reversePurchasePayment = async (session, purchaseId) => {
  const transactions = await CrateTransaction.find({ purchaseReference: purchaseId }).session(session);
  if (!transactions.length) return;

  for (const t of transactions) {
    await Account.findByIdAndUpdate(t.account, { $inc: { balance: t.amount } }, { session });
  }

  await CrateTransaction.deleteMany({ purchaseReference: purchaseId }).session(session);
  await bumpNsVersion("account");
};

// The line's figures as numbers. A form or client may post them as strings,
// and `stock + "5"` concatenated: stock 10 became "105", saved as 105.
const purchaseLineNumbers = (item) => {
  const number = (field) => {
    const value = item[field];
    if (value === undefined || value === null || value === "") return undefined;
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) {
      throw new customError(`${field} must be a number of 0 or more`, statusCodes.BAD_REQUEST);
    }
    return n;
  };
  const quantity = number("quantity");
  if (quantity !== undefined && !Number.isInteger(quantity)) {
    throw new customError("quantity must be a whole number", statusCodes.BAD_REQUEST);
  }
  return {
    purchasePrice: number("purchasePrice"),
    retailPrice: number("retailPrice"),
    wholesalePrice: number("wholesalePrice"),
    quantity,
  };
};

// What a purchase owes, worked out on the server the way the purchase form
// does: the lines it priced plus commission and shipping, less what was paid.
// The request's `payable` and `dueamount` are never used — `dueamount: 9999`
// once went straight onto the supplier's due.
const purchaseTotals = ({ subTotal, commission, shipping, paid }) => {
  const round2 = (n) => Math.round(n * 100) / 100;
  const payable = round2(subTotal + (Number(commission) || 0) + (Number(shipping) || 0));
  assertPaidWithinPayable(paid, payable);
  return { payable, dueamount: round2(payable - (Number(paid) || 0)) };
};

// Take a purchase's units back off the shelf (delete, or the old side of an
// edit). Refused when they have been sold since: `min: 0` does not apply to
// an $inc, so a bare decrement drove stock negative.
const takeBackPurchasedStock = async (allproduct, session) => {
  for (const { product, variant, quantity } of allproduct) {
    for (const [Model, id, field] of [
      [Product, product, "stock"],
      [Variant, variant, "stockVariant"],
    ]) {
      if (!id) continue;
      const result = await Model.updateOne(
        { _id: id, [field]: { $gte: quantity } },
        { $inc: { [field]: -quantity, purchaseQuantityStock: -quantity } },
        { session },
      );
      if (result.matchedCount === 0 && (await Model.exists({ _id: id }).session(session))) {
        throw new customError(
          "Some of the purchased units have already been sold, so the purchase cannot be undone",
          statusCodes.BAD_REQUEST,
        );
      }
    }
  }
};

// Search terms are matched literally: "(" made $regex throw (500) and ".*"
// matched every row
const escapeRegex = (str = "") => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

exports.createPurchase = asynchandeler(retryTransientErrors(async (req, res) => {
  const {
    invoiceNumber,
    supplierId,
    cashType,
    allproduct,
    commission = 0,
    shipping = 0,
    paid = 0,
    category,
    subCategory,
    brand,
    date,
  } = req.body;

  if (!allproduct || !Array.isArray(allproduct) || allproduct.length === 0) {
    throw new customError(
      "At least one product or variant is required",
      statusCodes.BAD_REQUEST,
    );
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    let subTotal = 0;
    const purchaseProducts = [];

    for (const item of allproduct) {
      const { product, variant, size, color } = item;
      const { purchasePrice, retailPrice, wholesalePrice, quantity } = purchaseLineNumbers(item);

      if (!purchasePrice || !retailPrice || !quantity) continue;

      const subTotalItem = purchasePrice * quantity;
      subTotal += subTotalItem;

      purchaseProducts.push({
        product: product || null,
        variant: variant || null,
        purchasePrice,
        retailPrice,
        wholesalePrice,
        subTotal: subTotalItem,
        quantity,
        size: size || null,
        color: color || null,
      });

      if (product) {
        const productInfo = await Product.findById(product).session(session);
        if (productInfo) {
          productInfo.stock = (productInfo.stock || 0) + quantity;
          productInfo.purchaseQuantityStock =
            (productInfo.purchaseQuantityStock || 0) + quantity;
          productInfo.wholesalePrice =
            wholesalePrice || productInfo.wholesalePrice;
          productInfo.purchasePrice =
            purchasePrice || productInfo.purchasePrice;
          productInfo.retailPrice = retailPrice || productInfo.retailPrice;
          if (size) productInfo.size = size || productInfo.size;
          if (color) productInfo.color = color || productInfo.color;
          await productInfo.save({ session });
        }
      }

      if (variant) {
        const variantInfo = await Variant.findById(variant).session(session);
        if (variantInfo) {
          variantInfo.stockVariant = (variantInfo.stockVariant || 0) + quantity;
          variantInfo.purchaseQuantityStock =
            (variantInfo.purchaseQuantityStock || 0) + quantity;
          variantInfo.wholesalePrice =
            wholesalePrice || variantInfo.wholesalePrice;
          variantInfo.purchasePrice =
            purchasePrice || variantInfo.purchasePrice;
          variantInfo.retailPrice = retailPrice || variantInfo.retailPrice;
          if (size) variantInfo.size = size || variantInfo.size;
          if (color) variantInfo.color = color || variantInfo.color;
          await variantInfo.save({ session });
        }
      }
    }

    const { payable, dueamount } = purchaseTotals({ subTotal, commission, shipping, paid });

    if (supplierId && dueamount !== 0) {
      const supplier =
        await SupplierModel.findById(supplierId).session(session);
      if (supplier) {
        supplier.openingDues = (supplier.openingDues || 0) + dueamount;
        await supplier.save({ session });
      }
    }

    const [purchase] = await Purchase.create(
      [
        {
          invoiceNumber,
          supplierId,
          cashType,
          allproduct: purchaseProducts,
          subTotal,
          commission,
          shipping,
          payable,
          paid,
          dueamount,
          category,
          subCategory,
          brand,
          // Falls back to the schema default (now) only when the caller
          // sends nothing — a picked date must never be silently overridden.
          ...(date ? { date } : {}),
        },
      ],
      { session },
    );

    // Paid amount leaves the selected (cashType) account's balance.
    await applyPurchasePayment(session, purchase);

    await session.commitTransaction();
    session.endSession();

    await bumpNsVersion(NS);
    // Also bump product cache — this endpoint mutates stock/stockVariant on
    // Product/Variant, which /product/* endpoints (incl. category-stock-detail) cache.
    await bumpNsVersion("product");

    return apiResponse.sendSuccess(
      res,
      statusCodes.CREATED,
      "Purchase created successfully",
      purchase.invoiceNumber,
    );
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
}));

// get all purchases
exports.getAllPurchases = asynchandeler(async (req, res) => {
  const cacheKey = await buildCacheKey(NS, "all");
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Purchases fetched successfully",
      { purchases: cached, fromCache: true },
    );
  }

  const purchases = await Purchase.find()
    .populate({
      path: "allproduct.product",
    })
    .populate({
      path: "allproduct.variant",
      populate: { path: "product" },
    })
    .populate("category subCategory brand cashType supplierId")
    .sort({ createdAt: -1 })
    .lean();

  if (!purchases || purchases.length === 0) {
    throw new customError("Purchases not found", statusCodes.NOT_FOUND);
  }

  await setCache(cacheKey, purchases, CACHE_TTL);

  return apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Purchases fetched successfully",
    { purchases },
  );
});

// get single product using slug
exports.getSinglePurchase = asynchandeler(async (req, res) => {
  const { id } = req.params;
  if (!id) {
    throw new customError("ID is required", statusCodes.BAD_REQUEST);
  }

  const cacheKey = await buildCacheKey(NS, `id:${id}`);
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Purchase fetched successfully",
      { purchase: cached, fromCache: true },
    );
  }

  const purchase = await Purchase.findById(id)
    .populate({
      path: "allproduct.product",
    })
    .populate({
      path: "allproduct.variant",
      populate: { path: "product" },
    })
    .populate("category subCategory brand cashType supplierId")
    .lean();

  if (!purchase) {
    throw new customError("Purchase not found", statusCodes.NOT_FOUND);
  }

  await setCache(cacheKey, purchase, CACHE_TTL);

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Purchase fetched successfully",
    { purchase, fromCache: false },
  );
});

// update purchase
exports.updatePurchase = asynchandeler(retryTransientErrors(async (req, res) => {
  const { id } = req.params;
  const {
    invoiceNumber,
    supplierId,
    cashType,
    allproduct,
    commission = 0,
    shipping = 0,
    paid = 0,
    category,
    subCategory,
    brand,
    date,
  } = req.body;

  // An edit replaces the purchase's lines, so it must send them
  if (!Array.isArray(allproduct) || allproduct.length === 0) {
    throw new customError(
      "At least one product or variant is required",
      statusCodes.BAD_REQUEST,
    );
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const existingPurchase = await Purchase.findById(id).session(session);
    if (!existingPurchase) {
      throw new customError("Purchase not found", statusCodes.NOT_FOUND);
    }

    // Revert Old Payment (give back what the old paid amount subtracted)
    await reversePurchasePayment(session, existingPurchase._id);

    // Revert Old Supplier Dues (Subtract the old due amount from supplier balance)
    if (existingPurchase.supplierId && existingPurchase.dueamount !== 0) {
      const oldSupplier = await SupplierModel.findById(
        existingPurchase.supplierId,
      ).session(session);
      if (oldSupplier) {
        oldSupplier.openingDues = Math.max(
          0,
          (oldSupplier.openingDues || 0) - existingPurchase.dueamount,
        );
        await oldSupplier.save({ session });
      }
    }

    // Apply New Products & Stock
    let subTotal = 0;
    const updatedProducts = [];

    for (const item of allproduct) {
      const { product, variant, size, color } = item;
      const { purchasePrice, retailPrice, wholesalePrice, quantity } = purchaseLineNumbers(item);

      if (!purchasePrice || !retailPrice || !quantity) continue;

      const subTotalItem = purchasePrice * quantity;
      subTotal += subTotalItem;

      updatedProducts.push({
        product: product || null,
        variant: variant || null,
        purchasePrice,
        retailPrice,
        wholesalePrice,
        subTotal: subTotalItem,
        quantity,
        size: size || null,
        color: color || null,
      });

      if (product) {
        const productInfo = await Product.findById(product).session(session);
        if (productInfo) {
          productInfo.stock = (productInfo.stock || 0) + quantity;
          productInfo.purchaseQuantityStock =
            (productInfo.purchaseQuantityStock || 0) + quantity;
          productInfo.wholesalePrice = wholesalePrice;
          productInfo.purchasePrice = purchasePrice;
          productInfo.retailPrice = retailPrice;
          if (size) productInfo.size = size;
          if (color) productInfo.color = color;
          await productInfo.save({ session });
        }
      }

      if (variant) {
        const variantInfo = await Variant.findById(variant).session(session);
        if (variantInfo) {
          variantInfo.stockVariant = (variantInfo.stockVariant || 0) + quantity;
          variantInfo.purchaseQuantityStock =
            (variantInfo.purchaseQuantityStock || 0) + quantity;
          variantInfo.wholesalePrice = wholesalePrice;
          variantInfo.purchasePrice = purchasePrice;
          variantInfo.retailPrice = retailPrice;
          if (size) variantInfo.size = size;
          if (color) variantInfo.color = color;
          await variantInfo.save({ session });
        }
      }
    }

    // The old lines come off after the new ones went on, so an edit that
    // keeps the units passes the stock guard even when they are partly sold
    await takeBackPurchasedStock(existingPurchase.allproduct, session);

    const { payable, dueamount } = purchaseTotals({ subTotal, commission, shipping, paid });

    // Apply New Supplier Dues
    if (supplierId && dueamount !== 0) {
      const supplier =
        await SupplierModel.findById(supplierId).session(session);
      if (supplier) {
        supplier.openingDues = (supplier.openingDues || 0) + dueamount;
        await supplier.save({ session });
      }
    }

    // Update Purchase Document
    existingPurchase.invoiceNumber =
      invoiceNumber || existingPurchase.invoiceNumber;
    existingPurchase.supplierId = supplierId || existingPurchase.supplierId;
    existingPurchase.cashType = cashType || existingPurchase.cashType;
    existingPurchase.category = category || existingPurchase.category;
    existingPurchase.subCategory = subCategory || existingPurchase.subCategory;
    existingPurchase.brand = brand || existingPurchase.brand;
    existingPurchase.allproduct = updatedProducts;
    existingPurchase.subTotal = subTotal;
    existingPurchase.commission = commission;
    existingPurchase.shipping = shipping;
    existingPurchase.payable = payable;
    existingPurchase.paid = paid;
    existingPurchase.dueamount = dueamount;
    existingPurchase.date = date || existingPurchase.date;

    await existingPurchase.save({ session });

    // Apply the new paid amount against the (possibly new) cashType account.
    await applyPurchasePayment(session, existingPurchase);

    await session.commitTransaction();
    session.endSession();

    await bumpNsVersion(NS);
    // Also bump product cache — this endpoint mutates stock/stockVariant on
    // Product/Variant, which /product/* endpoints (incl. category-stock-detail) cache.
    await bumpNsVersion("product");

    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Purchase updated successfully",
      existingPurchase,
    );
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
}));

// delete purchase
exports.deletePurchase = asynchandeler(retryTransientErrors(async (req, res) => {
  const { id } = req.params;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const purchase = await Purchase.findById(id).session(session);
    if (!purchase) {
      throw new customError("Purchase not found", statusCodes.NOT_FOUND);
    }

    // Rollback Stock
    await takeBackPurchasedStock(purchase.allproduct, session);

    // Rollback the paid amount back into its account.
    await reversePurchasePayment(session, purchase._id);

    // Rollback Supplier Dues
    if (purchase.supplierId && purchase.dueamount !== 0) {
      const supplier = await SupplierModel.findById(
        purchase.supplierId,
      ).session(session);
      if (supplier) {
        supplier.openingDues = Math.max(
          0,
          (supplier.openingDues || 0) - purchase.dueamount,
        );
        await supplier.save({ session });
      }
    }

    await Purchase.findByIdAndDelete(id).session(session);

    await session.commitTransaction();
    session.endSession();

    await bumpNsVersion(NS);
    // Also bump product cache — this endpoint mutates stock/stockVariant on
    // Product/Variant, which /product/* endpoints (incl. category-stock-detail) cache.
    await bumpNsVersion("product");

    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Purchase deleted successfully",
      null,
    );
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
}));

// search purchases by invoiceNumber | supplierId | cashType
exports.searchPurchase = asynchandeler(async (req, res) => {
  const { invoiceNumber, supplierId, cashType } = req.query;

  if (!invoiceNumber && !supplierId && !cashType) {
    throw new customError(
      "At least one search param is required (invoiceNumber, supplierId, cashType)",
      statusCodes.BAD_REQUEST,
    );
  }

  const cacheKey = await buildCacheKey(
    NS,
    `search:${JSON.stringify({ invoiceNumber, supplierId, cashType })}`,
  );
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Purchases fetched successfully",
      {
        purchases: cached,
        total: cached.length,
        fromCache: true,
      },
    );
  }

  const query = {};

  if (invoiceNumber) {
    query.invoiceNumber = { $regex: escapeRegex(invoiceNumber.trim()), $options: "i" };
  }
  if (supplierId) {
    if (!mongoose.Types.ObjectId.isValid(supplierId)) {
      throw new customError("Invalid supplierId", statusCodes.BAD_REQUEST);
    }
    query.supplierId = supplierId;
  }
  if (cashType) {
    if (!mongoose.Types.ObjectId.isValid(cashType)) {
      throw new customError("Invalid cashType id", statusCodes.BAD_REQUEST);
    }
    query.cashType = cashType;
  }

  const purchases = await Purchase.find(query)
    .populate({ path: "allproduct.product" })
    .populate({ path: "allproduct.variant", populate: { path: "product" } })
    .populate("category subCategory brand cashType supplierId")
    .sort({ createdAt: -1 })
    .lean();

  if (!purchases.length) {
    return apiResponse.sendSuccess(res, statusCodes.OK, "No purchases found", {
      purchases: [],
      total: 0,
      fromCache: false,
    });
  }

  await setCache(cacheKey, purchases, CACHE_TTL);

  return apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Purchases fetched successfully",
    {
      purchases,
      total: purchases.length,
      fromCache: false,
    },
  );
});
