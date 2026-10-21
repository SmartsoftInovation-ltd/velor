const { customError } = require("../lib/CustomError");
const { apiResponse } = require("../utils/apiResponse");
const { asynchandeler } = require("../lib/asyncHandeler");
const SalesReturn = require("../models/salesReturn.model");
const Product = require("../models/product.model");
const Variant = require("../models/variant.model");
const Sales = require("../models/sales.model");
const { customerModel } = require("../models/customer.model");
const CrateTransaction = require("../models/crateTransaction.model");
const { validateSalesReturn } = require("../validation/salesReturn.validation");
const {
  takeRefundFromAccount,
  giveRefundBack,
  deleteRefundTransactions,
} = require("../utils/refundLedger.util");
const { inTransaction } = require("../utils/transaction.util");
const { statusCodes } = require("../constant/constant");
const {
  getCache,
  setCache,
  bumpNsVersion,
  buildCacheKey,
} = require("@/utils/cache.util");

const NS = "salesReturn";
const CACHE_TTL = 60 * 60; // 1 hour

// Deduct the return amount from a listed customer's opening dues (floored at 0).
// Walking customers have no ledger entry — nothing to adjust.
async function applyCustomerDuesForReturn(customerType, amount, session) {
  if (customerType?.type !== "listed" || !customerType?.customerId) return;
  const customer = await customerModel.findById(customerType.customerId).session(session);
  if (!customer) return;
  customer.openingDues = Math.max(0, (customer.openingDues || 0) - amount);
  await customer.save({ session });
}

// Revert a previously-applied dues deduction (used on delete/update rollback).
async function revertCustomerDuesForReturn(customerType, amount, session) {
  if (customerType?.type !== "listed" || !customerType?.customerId) return;
  await customerModel.findByIdAndUpdate(
    customerType.customerId,
    { $inc: { openingDues: amount } },
    { session },
  );
}

// Record the refund as an outgoing cash transaction, describing whether it
// came from a listed customer's due balance or a walking customer.
async function recordReturnTransaction({ sale, returnDoc, refundMethod, session }) {
  const customerType = sale?.customerType;
  const isListed = customerType?.type === "listed";
  const customerLabel = isListed
    ? "listed customer"
    : (customerType?.walking?.customerName || "walking customer");

  const balanceAfter = await takeRefundFromAccount(refundMethod, returnDoc.totalReturnAmount, session);
  const [transaction] = await CrateTransaction.create(
    [
      {
        date: returnDoc.date || new Date(),
        account: refundMethod,
        transactionDescription: `Sales return refund — invoice ${sale?.invoiceNumber || ""} (${customerLabel})`.trim(),
        voucherNumber: sale?.invoiceNumber || "",
        transactionType: "cash payment",
        amount: returnDoc.totalReturnAmount,
        balanceAfter,
        balanceApplied: true,
        // Marks the row as auto-generated so the manual transaction list skips it.
        salesReturnReference: returnDoc._id,
      },
    ],
    { session },
  );
  return transaction;
}

// Only a completed sale took its goods off the shelf. A pending or draft sale
// never deducted stock, so a return against it would add stock that never left.
const assertSaleReturnable = (sale) => {
  if (sale.invoiceStatus !== "complete") {
    throw new customError(
      "Only a completed sale can be returned",
      statusCodes.BAD_REQUEST,
    );
  }
};

// The same line lookup create, update and delete use to flip salesStatus
const findSaleLine = (sale, item) =>
  sale.searchItem.find((si) =>
    item.variant
      ? si.variantId?.toString() === item.variant.toString()
      : si.productId?.toString() === item.product.toString(),
  );

// Add (sign 1) or take back (sign -1) a return's units on products and
// variants. Taking back is refused when the returned units are no longer on
// the shelf (sold again since): `min: 0` does not apply to an $inc, so a bare
// decrement drove stock negative.
const moveReturnStock = async (allproduct, sign, session) => {
  for (const item of allproduct) {
    const quantity = sign * item.quantity;
    const [Model, id, field] = item.variant
      ? [Variant, item.variant, "stockVariant"]
      : [Product, item.product, "stock"];
    if (!id) continue;
    const filter = sign < 0 ? { _id: id, [field]: { $gte: item.quantity } } : { _id: id };
    const result = await Model.updateOne(
      filter,
      { $inc: { [field]: quantity, salesReturnStock: quantity } },
      { session },
    );
    if (sign < 0 && result.matchedCount === 0 && (await Model.exists({ _id: id }).session(session))) {
      throw new customError(
        "The returned units are no longer in stock (sold again since), so the return cannot be undone",
        statusCodes.BAD_REQUEST,
      );
    }
  }
};

const bumpReturnCaches = async () => {
  await bumpNsVersion(NS);
  // Also bump product cache — this endpoint mutates stock/stockVariant and
  // salesReturnStock on Product/Variant, which /product/* endpoints cache.
  await bumpNsVersion("product");
  // The sales reports (sales summary, sales history) cache under the "sales"
  // namespace and read returns back out of this collection for their
  // RETURN (-) line. Without this bump a return raised after a report was
  // first viewed keeps showing 0 until the entry expires.
  await bumpNsVersion("sales");
  // The refund account's balance moved
  await bumpNsVersion("account");
};

// @desc create a new sales return
// Invoice-level deductions carried into a return.
//  - lessTaka is spread equally over every unit sold on the invoice, so each
//    returned unit gives back its share (e.g. 400 less over 2 units = 200 each).
//  - discountPercent is a share of the value, so it is taken off the returned
//    items' value at the same percent.
// Units are counted over "sale" and "return" lines: a line is flipped to
// "return" once returned, but it was still sold when the less was given, so
// the per-unit share must not grow as items come back. Unit prices come from
// the sale itself, not the request, so the refund cannot be inflated, and are
// net of the line's own discount. An item the sale never contained, or more
// units than it sold, is refused (400).
// What the customer paid for one unit of a line: its salesRate less the line's
// own discount (taka off each unit, or a percent). Refunding the bare
// salesRate would hand back more than a discounted item was sold for.
const netUnitPrice = (line) => {
  const rate = Number(line.salesRate) || 0;
  const discount = Number(line.discount) || 0;
  const net = line.discountType === "percent" ? rate * (1 - discount / 100) : rate - discount;
  return Math.max(0, Math.round(net * 100) / 100);
};

function computeReturnAmounts(sale, allproduct) {
  const lines = (sale.searchItem || []).filter((si) => si.salesStatus !== "exchange");
  const soldUnits = lines.reduce((sum, si) => sum + (Number(si.quantity) || 0), 0);
  const lessPerUnit = soldUnits > 0 ? (Number(sale.lessTaka) || 0) / soldUnits : 0;
  const discountPercent = Number(sale.discountPercent) || 0;

  const round2 = (n) => Math.round(n * 100) / 100;
  let gross = 0;
  let units = 0;
  // Units of each product/variant asked back so far, so two request rows for
  // the same item cannot together exceed what was sold
  const requested = new Map();
  const items = allproduct.map((item) => {
    const key = item.variant ? `v:${item.variant}` : `p:${item.product}`;
    const matching = lines.filter((si) =>
      item.variant
        ? si.variantId?.toString() === item.variant.toString()
        : si.productId?.toString() === String(item.product),
    );
    // Only what the invoice sold can come back, and only at the invoice's price
    if (matching.length === 0) {
      throw new customError("This product is not on the sale", statusCodes.BAD_REQUEST);
    }
    const quantity = Number(item.quantity) || 0;
    const sold = matching.reduce((sum, si) => sum + (Number(si.quantity) || 0), 0);
    const total = (requested.get(key) || 0) + quantity;
    if (total > sold) {
      throw new customError(
        `Cannot return ${total} units: the sale sold ${sold}`,
        statusCodes.BAD_REQUEST,
      );
    }
    requested.set(key, total);
    const unitPrice = netUnitPrice(matching[0]);
    gross += unitPrice * quantity;
    units += quantity;
    return { ...item, unitPrice, subtotal: round2(unitPrice * quantity) };
  });

  const discountAmount = round2((gross * discountPercent) / 100);
  const lessTakaShare = round2(lessPerUnit * units);
  return {
    allproduct: items,
    grossReturnAmount: round2(gross),
    discountPercent,
    discountAmount,
    lessTakaShare,
    totalReturnAmount: Math.max(0, round2(gross - discountAmount - lessTakaShare)),
  };
}

exports.computeReturnAmounts = computeReturnAmounts;

exports.createSalesReturn = asynchandeler(async (req, res) => {
  const body = await validateSalesReturn(req);

  const returnDoc = await inTransaction(async (session) => {
    // A fresh copy per attempt: a retried transaction must start from the request
    const data = { ...body };

    // The refund is worked out here from the sale, not taken from the form.
    const originalSale = await Sales.findById(data.invoiceNumber).session(session);
    if (!originalSale) {
      throw new customError("Original Sale not found", statusCodes.NOT_FOUND);
    }
    assertSaleReturnable(originalSale);
    Object.assign(data, computeReturnAmounts(originalSale, data.allproduct));

    const [created] = await SalesReturn.create([data], { session }).catch((error) => {
      // The unique index caught a parallel return for the same invoice
      if (error?.code === 11000) {
        throw new customError(
          "A sales return already exists for this invoice",
          statusCodes.BAD_REQUEST,
        );
      }
      throw error;
    });

    // 1. Restock products and variants & flag the returned lines
    await moveReturnStock(data.allproduct, 1, session);
    for (const item of data.allproduct) {
      const targetItem = findSaleLine(originalSale, item);
      if (targetItem) targetItem.salesStatus = "return";
    }

    // 2. Update original Sales record (increment return field + searchItem status)
    originalSale.return = (originalSale.return || 0) + data.totalReturnAmount;
    await originalSale.save({ session });

    // 3. Listed customer -> deduct from opening dues. Walking customer -> skip.
    await applyCustomerDuesForReturn(
      originalSale.customerType,
      data.totalReturnAmount,
      session,
    );

    // 4. Record the refund as a transaction either way, and link it back.
    // `created`, not `data`: `data` is the request body and has no _id, so the
    // refund row was saved with an empty salesReturnReference and then showed
    // up on /transaction-list as if it had been typed by hand.
    const transaction = await recordReturnTransaction({
      sale: originalSale,
      returnDoc: created,
      refundMethod: data.refundMethod,
      session,
    });
    await SalesReturn.findByIdAndUpdate(
      created._id,
      { transaction: transaction._id },
      { session },
    );

    return SalesReturn.findById(created._id)
      .populate({
        path: "invoiceNumber",
        select: "-paymentMethod -searchItem",
      })
      .populate("refundMethod")
      .populate("allproduct.product")
      .populate("allproduct.variant")
      .session(session);
  });

  await bumpReturnCaches();

  apiResponse.sendSuccess(
    res,
    statusCodes.CREATED,
    "Sales Return created successfully",
    returnDoc
  );
});

//@desc get all sales return
exports.getAllSalesReturn = asynchandeler(async (req, res) => {
  const cacheKey = await buildCacheKey(NS, "all");
  const cached = await getCache(cacheKey);
  
  if (cached) {
    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Sales Returns fetched successfully",
      { salesReturns: cached, fromCache: true }
    );
  }

  const salesReturns = await SalesReturn.find()
    .populate({
      path: "invoiceNumber",
      select: "-paymentMethod -searchItem",
    })
    .populate("refundMethod")
    .populate("allproduct.product")
    .populate("allproduct.variant")
    .sort({ createdAt: -1 })
    .lean();

  if (!salesReturns || salesReturns.length === 0) {
    throw new customError("No sales returns found", statusCodes.NOT_FOUND);
  }

  await setCache(cacheKey, salesReturns, CACHE_TTL);

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Sales Returns fetched successfully",
    { salesReturns }
  );
});

//@desc get single sales return using ID
exports.getSingleSalesReturn = asynchandeler(async (req, res) => {
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
      "Sales Return fetched successfully",
      { salesReturn: cached, fromCache: true }
    );
  }

  const salesReturn = await SalesReturn.findById(id)
    .populate({
      path: "invoiceNumber",
      select: "-paymentMethod -searchItem",
    })
    .populate("refundMethod")
    .populate("allproduct.product")
    .populate("allproduct.variant")
    .lean();

  if (!salesReturn) {
    throw new customError("Sales Return not found", statusCodes.NOT_FOUND);
  }

  await setCache(cacheKey, salesReturn, CACHE_TTL);

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Sales Return fetched successfully",
    { salesReturn }
  );
});

// @desc delete sales return
exports.deleteSalesReturn = asynchandeler(async (req, res) => {
  const { id } = req.params;

  await inTransaction(async (session) => {
    const salesReturn = await SalesReturn.findById(id).session(session);
    if (!salesReturn) {
      throw new customError("Sales Return not found", statusCodes.NOT_FOUND);
    }

    const originalSale = await Sales.findById(salesReturn.invoiceNumber).session(session);

    // 1. Take the restock back & reset the lines to "sale"
    await moveReturnStock(salesReturn.allproduct, -1, session);
    if (originalSale) {
      for (const item of salesReturn.allproduct) {
        const targetItem = findSaleLine(originalSale, item);
        if (targetItem) targetItem.salesStatus = "sale";
      }

      // 2. Rollback Sales record (decrement return field)
      originalSale.return = Math.max(0, (originalSale.return || 0) - salesReturn.totalReturnAmount);
      await originalSale.save({ session });

      // 3. Rollback listed customer's opening dues
      await revertCustomerDuesForReturn(
        originalSale.customerType,
        salesReturn.totalReturnAmount,
        session,
      );
    }

    // 4. Remove the refund transaction, putting the refund back on its account
    if (salesReturn.transaction) {
      await deleteRefundTransactions([salesReturn.transaction], session);
    }

    await SalesReturn.findByIdAndDelete(id).session(session);
  });

  await bumpReturnCaches();

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Sales Return deleted successfully",
    null
  );
});

// @desc update sales return
exports.updateSalesReturn = asynchandeler(async (req, res) => {
  const { id } = req.params;
  const body = await validateSalesReturn(req);

  const updatedReturn = await inTransaction(async (session) => {
    const data = { ...body };

    const existingReturn = await SalesReturn.findById(id).session(session);
    if (!existingReturn) {
      throw new customError("Sales Return not found", statusCodes.NOT_FOUND);
    }

    const oldSale = await Sales.findById(existingReturn.invoiceNumber).session(session);
    // Normally the invoice does not change: then old and new are one document.
    // Loading it twice and saving both copies failed with a VersionError.
    const sameSale = oldSale && oldSale._id.toString() === String(data.invoiceNumber);
    const newSale = sameSale
      ? oldSale
      : await Sales.findById(data.invoiceNumber).session(session);
    if (!newSale) {
      throw new customError("Original Sale not found", statusCodes.NOT_FOUND);
    }
    assertSaleReturnable(newSale);
    Object.assign(data, computeReturnAmounts(newSale, data.allproduct));

    // The new return's units are added before the old ones are taken back,
    // so an edit that keeps units on the shelf passes the stock guard even
    // when the product's stock is at 0
    await moveReturnStock(data.allproduct, 1, session);

    // --- STEP 1: REVERT OLD STATE ---
    await moveReturnStock(existingReturn.allproduct, -1, session);
    if (oldSale) {
      for (const item of existingReturn.allproduct) {
        const targetItem = findSaleLine(oldSale, item);
        if (targetItem) targetItem.salesStatus = "sale";
      }
      oldSale.return = Math.max(0, (oldSale.return || 0) - existingReturn.totalReturnAmount);
      if (!sameSale) await oldSale.save({ session });
      await revertCustomerDuesForReturn(
        oldSale.customerType,
        existingReturn.totalReturnAmount,
        session,
      );
    }

    // --- STEP 2: APPLY NEW STATE ---
    for (const item of data.allproduct) {
      const targetItem = findSaleLine(newSale, item);
      if (targetItem) targetItem.salesStatus = "return";
    }
    newSale.return = (newSale.return || 0) + data.totalReturnAmount;
    await newSale.save({ session });
    await applyCustomerDuesForReturn(
      newSale.customerType,
      data.totalReturnAmount,
      session,
    );

    // 2e. Replace the refund transaction: the old refund goes back on its
    // account, the new one comes out of the (possibly different) refund account
    let transactionId = existingReturn.transaction;
    const oldTransaction = transactionId
      ? await CrateTransaction.findById(transactionId).session(session)
      : null;
    if (oldTransaction) {
      await giveRefundBack(oldTransaction, session);
      const isListed = newSale.customerType?.type === "listed";
      const customerLabel = isListed
        ? "listed customer"
        : (newSale.customerType?.walking?.customerName || "walking customer");
      const balanceAfter = await takeRefundFromAccount(data.refundMethod, data.totalReturnAmount, session);
      await CrateTransaction.findByIdAndUpdate(
        transactionId,
        {
          date: data.date || new Date(),
          account: data.refundMethod,
          transactionDescription: `Sales return refund — invoice ${newSale.invoiceNumber || ""} (${customerLabel})`.trim(),
          voucherNumber: newSale.invoiceNumber || "",
          transactionType: "cash payment",
          amount: data.totalReturnAmount,
          balanceAfter,
          balanceApplied: true,
          // Backfills the tag on rows created before it existed.
          salesReturnReference: id,
        },
        { session },
      );
    } else {
      const transaction = await recordReturnTransaction({
        sale: newSale,
        returnDoc: { ...data, _id: id },
        refundMethod: data.refundMethod,
        session,
      });
      transactionId = transaction._id;
    }

    // 3. Update the return document
    return SalesReturn.findByIdAndUpdate(
      id,
      { $set: { ...data, transaction: transactionId } },
      { new: true, session }
    );
  });

  await bumpReturnCaches();

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Sales Return updated successfully",
    updatedReturn
  );
});
