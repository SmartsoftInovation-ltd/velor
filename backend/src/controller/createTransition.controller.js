const { customError } = require("../lib/CustomError");
const CreateTransaction = require("../models/crateTransaction.model");
const Account = require("../models/account.model");
const TransactionCategory = require("../models/transitionCategory.model");
const { apiResponse } = require("../utils/apiResponse");
const { asynchandeler } = require("../lib/asyncHandeler");
const { statusCodes } = require("../constant/constant");
const { bumpNsVersion } = require("@/utils/cache.util");

const ACCOUNT_NS = "account";

// cash recived = (+), cash payment = (-)
const balanceDelta = (transactionType, amount) =>
  transactionType === "cash recived" ? amount : -amount;

// Sales, sales returns, purchases and customer/supplier payments all write into
// this same collection, each tagging its row with the reference field that lets
// the originating record reverse it later. The transaction list is the ledger
// for entries typed by hand on /add-transaction, so it filters those auto-
// generated rows out — they are already reported on the dashboard and in each
// module's own list. Account balances still count every row.
const MANUAL_ENTRY_ONLY = {
  saleReference: { $eq: null },
  supplierPaymentReference: { $eq: null },
  customerPaymentReference: { $eq: null },
  customerAdvancePaymentReference: { $eq: null },
  purchaseReference: { $eq: null },
  salesReturnReference: { $eq: null },
};

// create transaction controller
exports.createTransaction = asynchandeler(async (req, res) => {
  const {
    date,
    transactionCategory,
    account,
    transactionDescription,
    voucherNumber,
    transactionType,
    amount,
  } = req.body;
  if (
    !date ||
    !transactionCategory ||
    !account ||
    !transactionDescription ||
    !transactionType ||
    !amount
  ) {
    throw new customError("All fields are required", statusCodes.BAD_REQUEST);
  }

  const category = await TransactionCategory.findById(transactionCategory);
  if (!category) {
    throw new customError("Transaction category not found", statusCodes.NOT_FOUND);
  }
  if (category.allowedType !== transactionType) {
    throw new customError(
      `"${category.name}" only allows "${category.allowedType}" transactions`,
      statusCodes.BAD_REQUEST,
    );
  }

  const updatedAccount = await Account.findByIdAndUpdate(
    account,
    { $inc: { balance: balanceDelta(transactionType, amount) } },
    { new: true },
  );
  if (!updatedAccount) {
    throw new customError("Account not found", statusCodes.NOT_FOUND);
  }

  const transaction = await CreateTransaction.create({
    date,
    transactionCategory,
    account,
    transactionDescription,
    voucherNumber,
    transactionType,
    amount,
    balanceAfter: updatedAccount.balance,
  });
  if (!transaction) {
    throw new customError("Transaction not created", statusCodes.BAD_REQUEST);
  }

  await bumpNsVersion(ACCOUNT_NS);

  apiResponse.sendSuccess(
    res,
    statusCodes.CREATED,
    "Transaction created successfully",
    transaction,
  );
});

// geta all transaction
exports.getAllTransaction = asynchandeler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
  const skip = (page - 1) * limit;

  const [rawTransactions, total] = await Promise.all([
    CreateTransaction.find(MANUAL_ENTRY_ONLY)
      .populate("account transactionCategory")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    CreateTransaction.countDocuments(MANUAL_ENTRY_ONLY),
  ]);

  if (!rawTransactions.length && page === 1) {
    return apiResponse.sendSuccess(res, statusCodes.OK, "Transactions not found", {
      transactions: [],
      total: 0,
      page,
      limit,
      hasNextPage: false,
    });
  }

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Transactions fetched successfully",
    { transactions: rawTransactions, total, page, limit, hasNextPage: page * limit < total },
  );
});

// get single transaction
exports.getSingleTransaction = asynchandeler(async (req, res) => {
  const { id } = req.params;
  const transaction = await CreateTransaction.findOne({ _id: id }).populate(
    "account transactionCategory",
  );
  if (!transaction) {
    throw new customError("Transaction not found", statusCodes.NOT_FOUND);
  }
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Transaction fetched successfully",
    transaction,
  );
});

// delete transaction
exports.deleteTransaction = asynchandeler(async (req, res) => {
  const { id } = req.params;
  // Scoped to manual entries: an auto-generated row is owned by the sale,
  // purchase or payment that created it and is reversed from there, so deleting
  // it here would leave that record pointing at a transaction that no longer
  // exists.
  const transaction = await CreateTransaction.findOneAndDelete({
    _id: id,
    ...MANUAL_ENTRY_ONLY,
  });
  if (!transaction) {
    throw new customError("Transaction not found", statusCodes.NOT_FOUND);
  }

  // reverse this transaction's effect on the account balance
  await Account.findByIdAndUpdate(transaction.account, {
    $inc: { balance: -balanceDelta(transaction.transactionType, transaction.amount) },
  });
  await bumpNsVersion(ACCOUNT_NS);

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Transaction deleted successfully",
    transaction,
  );
});

// update transaction
exports.updateTransaction = asynchandeler(async (req, res) => {
  const { id } = req.params;
  // Manual entries only — see the note on deleteTransaction.
  const existing = await CreateTransaction.findOne({
    _id: id,
    ...MANUAL_ENTRY_ONLY,
  });
  if (!existing) {
    throw new customError("Transaction not found", statusCodes.NOT_FOUND);
  }

  const account = req.body.account || existing.account;
  const transactionType = req.body.transactionType || existing.transactionType;
  const amount = req.body.amount ?? existing.amount;
  const transactionCategory = req.body.transactionCategory || existing.transactionCategory;

  const category = await TransactionCategory.findById(transactionCategory);
  if (!category) {
    throw new customError("Transaction category not found", statusCodes.NOT_FOUND);
  }
  if (category.allowedType !== transactionType) {
    throw new customError(
      `"${category.name}" only allows "${category.allowedType}" transactions`,
      statusCodes.BAD_REQUEST,
    );
  }

  // reverse old effect on the old account, apply new effect on the new account
  await Account.findByIdAndUpdate(existing.account, {
    $inc: { balance: -balanceDelta(existing.transactionType, existing.amount) },
  });
  const updatedAccount = await Account.findByIdAndUpdate(
    account,
    { $inc: { balance: balanceDelta(transactionType, amount) } },
    { new: true },
  );
  if (!updatedAccount) {
    throw new customError("Account not found", statusCodes.NOT_FOUND);
  }

  const transaction = await CreateTransaction.findOneAndUpdate(
    { _id: id },
    { ...req.body, balanceAfter: updatedAccount.balance },
    { new: true },
  );

  await bumpNsVersion(ACCOUNT_NS);

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Transaction updated successfully",
    transaction,
  );
});

// get transaction history for a single account — full audit trail of balance changes
exports.getTransactionsByAccount = asynchandeler(async (req, res) => {
  const { accountId } = req.params;

  const account = await Account.findById(accountId).lean();
  if (!account) {
    return apiResponse.sendSuccess(res, statusCodes.OK, "Account not found", {
      account: null,
      transactions: [],
    });
  }

  const transactions = await CreateTransaction.find({ account: accountId })
    .populate("transactionCategory")
    .sort({ createdAt: -1 })
    .lean();

  if (!transactions.length) {
    return apiResponse.sendSuccess(res, statusCodes.OK, "Transactions not found", {
      account,
      transactions: [],
    });
  }

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Transactions fetched successfully",
    { account, transactions },
  );
});
