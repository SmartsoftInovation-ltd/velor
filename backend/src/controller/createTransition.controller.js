const { customError } = require("../lib/CustomError");
const CreateTransaction = require("../models/crateTransaction.model");
const Account = require("../models/account.model");
const TransactionCategory = require("../models/transitionCategory.model");
const { apiResponse } = require("../utils/apiResponse");
const { asynchandeler } = require("../lib/asyncHandeler");
const { statusCodes } = require("../constant/constant");
const { bumpNsVersion } = require("@/utils/cache.util");
const { inTransaction } = require("../utils/transaction.util");

const ACCOUNT_NS = "account";

// cash recived = (+), cash payment = (-)
const balanceDelta = (transactionType, amount) =>
  transactionType === "cash recived" ? amount : -amount;

// The direction comes from transactionType, so the amount must be a positive
// number: a negative one inverted it (a "cash payment" raised the balance).
const positiveAmount = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new customError("Amount must be a number greater than 0", statusCodes.BAD_REQUEST);
  }
  return amount;
};

// A manual transaction's own fields: the only ones create and edit write
const TRANSACTION_FIELDS = [
  "date",
  "transactionCategory",
  "account",
  "transactionDescription",
  "voucherNumber",
  "transactionType",
  "amount",
];

const moveAccount = async (accountId, change, session) => {
  const account = await Account.findByIdAndUpdate(
    accountId,
    { $inc: { balance: change } },
    { new: true, session },
  );
  if (!account) throw new customError("Account not found", statusCodes.NOT_FOUND);
  return account;
};

// The transaction list is the ledger for entries typed by hand on
// /add-transaction, so it filters the auto-generated rows out — they are
// already reported on the dashboard and in each module's own list. Account
// balances still count every row.
const { MANUAL_ENTRY_ONLY } = require("../utils/manualEntry.util");

// Exported so a test can pin it against the schema: a reference field added to
// the model but not to this filter silently leaks that module's rows here.
exports.MANUAL_ENTRY_ONLY = MANUAL_ENTRY_ONLY;

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

  const value = positiveAmount(amount);

  // The balance and the row are written in one transaction: a row that fails
  // validation (a bad date, say) no longer leaves the money moved
  const transaction = await inTransaction(async (session) => {
    const updatedAccount = await moveAccount(account, balanceDelta(transactionType, value), session);
    const [created] = await CreateTransaction.create(
      [
        {
          date,
          transactionCategory,
          account,
          transactionDescription,
          voucherNumber,
          transactionType,
          amount: value,
          balanceAfter: updatedAccount.balance,
        },
      ],
      { session },
    );
    return created;
  });

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
    // Read through the partial index that holds only manual entries
    CreateTransaction.find(MANUAL_ENTRY_ONLY)
      .populate("account transactionCategory")
      .sort({ createdAt: -1, _id: -1 })
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
  const transaction = await inTransaction(async (session) => {
    const deleted = await CreateTransaction.findOneAndDelete(
      { _id: id, ...MANUAL_ENTRY_ONLY },
      { session },
    );
    if (!deleted) {
      throw new customError("Transaction not found", statusCodes.NOT_FOUND);
    }

    // reverse this transaction's effect on the account balance
    await Account.findByIdAndUpdate(
      deleted.account,
      { $inc: { balance: -balanceDelta(deleted.transactionType, deleted.amount) } },
      { session },
    );
    return deleted;
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
  const amount = positiveAmount(req.body.amount ?? existing.amount);
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

  // Only the transaction's own fields; the body is never spread in (it could
  // set a module reference and turn a manual row into an auto-generated one)
  const changes = Object.fromEntries(
    TRANSACTION_FIELDS.filter((field) => req.body[field] !== undefined).map((field) => [field, req.body[field]]),
  );

  const transaction = await inTransaction(async (session) => {
    // reverse old effect on the old account, apply new effect on the new account
    await Account.findByIdAndUpdate(
      existing.account,
      { $inc: { balance: -balanceDelta(existing.transactionType, existing.amount) } },
      { session },
    );
    const updatedAccount = await moveAccount(account, balanceDelta(transactionType, amount), session);

    return CreateTransaction.findOneAndUpdate(
      { _id: id },
      { ...changes, amount, balanceAfter: updatedAccount.balance },
      { new: true, runValidators: true, session },
    );
  });

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
