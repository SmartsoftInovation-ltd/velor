const mongoose = require("mongoose");
const { default: slugify } = require("slugify");
const Purchase = require("../models/purchase.model");
const Product = require("../models/product.model");
const Variant = require("../models/variant.model");
const { SupplierModel } = require("../models/supplier.model");
const Account = require("../models/account.model");
const CrateTransaction = require("../models/crateTransaction.model");
const TransitionCategory = require("../models/transitionCategory.model");
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

const NS = "purchase";
const CACHE_TTL = 60 * 60; // 1 hour

const PURCHASE_PAYMENT_CATEGORY_NAME = "Purchase Payment";
const PURCHASE_PAYMENT_CATEGORY_SLUG = slugify(PURCHASE_PAYMENT_CATEGORY_NAME, {
  lower: true,
  strict: true,
});

// Purchase payments are always money going out — reuse (or lazily create) one
// fixed category locked to "cash payment". Matched by slug rather than name:
// slug is always lowercased by slugify, so it still finds a pre-existing row
// saved with different name casing (e.g. "purchase payment" from an older
// insert) instead of missing it and trying to insert a second row that then
// collides on the model's unique slug index. findOneAndUpdate with upsert
// does the find-or-create atomically in one round trip — a separate findOne
// then create() raced under load: two concurrent purchases could both see no
// existing category, then both try to create it, and the second create's
// pre-save duplicate-slug check (or the unique index itself) would throw
// "already exists".
const getPurchasePaymentCategory = async (session) => {
  const category = await TransitionCategory.findOneAndUpdate(
    { slug: PURCHASE_PAYMENT_CATEGORY_SLUG },
    {
      $setOnInsert: {
        name: PURCHASE_PAYMENT_CATEGORY_NAME,
        allowedType: "cash payment",
        slug: PURCHASE_PAYMENT_CATEGORY_SLUG,
      },
    },
    { new: true, upsert: true, session },
  );

  return category;
};

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

exports.createPurchase = asynchandeler(async (req, res) => {
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
    dueamount,
    payable,
    date,
  } = req.body;

  assertPaidWithinPayable(paid, payable);

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
      const {
        product,
        variant,
        purchasePrice,
        retailPrice,
        wholesalePrice,
        quantity,
        size,
        color,
      } = item;

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

    // const payable = subTotal + shipping + commission;
    // const dueamount = payable - paid;

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
});

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
exports.updatePurchase = asynchandeler(async (req, res) => {
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
    dueamount,
    payable,
    date,
  } = req.body;

  if (payable !== undefined) assertPaidWithinPayable(paid, payable);

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const existingPurchase = await Purchase.findById(id).session(session);
    if (!existingPurchase) {
      throw new customError("Purchase not found", statusCodes.NOT_FOUND);
    }

    // Revert Old Stock using $inc for efficiency and atomicity
    for (const item of existingPurchase.allproduct) {
      const { product, variant, quantity } = item;
      if (product) {
        await Product.findByIdAndUpdate(product, {
          $inc: { stock: -quantity, purchaseQuantityStock: -quantity },
        }).session(session);
      }
      if (variant) {
        await Variant.findByIdAndUpdate(variant, {
          $inc: { stockVariant: -quantity, purchaseQuantityStock: -quantity },
        }).session(session);
      }
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
      const {
        product,
        variant,
        purchasePrice,
        retailPrice,
        wholesalePrice,
        quantity,
        size,
        color,
      } = item;

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

    // const payable = subTotal + shipping + commission;
    // const dueamount = payable - paid;

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
    existingPurchase.payable = payable ?? existingPurchase.payable;
    existingPurchase.paid = paid;
    existingPurchase.dueamount = dueamount ?? existingPurchase.dueamount;
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
});

// delete purchase
exports.deletePurchase = asynchandeler(async (req, res) => {
  const { id } = req.params;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const purchase = await Purchase.findById(id).session(session);
    if (!purchase) {
      throw new customError("Purchase not found", statusCodes.NOT_FOUND);
    }

    // Rollback Stock
    for (const item of purchase.allproduct) {
      const { product, variant, quantity } = item;
      if (product) {
        await Product.findByIdAndUpdate(product, {
          $inc: { stock: -quantity, purchaseQuantityStock: -quantity },
        }).session(session);
      }
      if (variant) {
        await Variant.findByIdAndUpdate(variant, {
          $inc: { stockVariant: -quantity, purchaseQuantityStock: -quantity },
        }).session(session);
      }
    }

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
});

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
    query.invoiceNumber = { $regex: invoiceNumber.trim(), $options: "i" };
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
