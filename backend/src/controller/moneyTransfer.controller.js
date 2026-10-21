const { customError } = require("../lib/CustomError");
const MoneyTransfer = require("../models/moneyTransfer.model");
const Account = require("../models/account.model");
const { apiResponse } = require("../utils/apiResponse");
const { asynchandeler } = require("../lib/asyncHandeler");
const { statusCodes } = require("../constant/constant");
const { inTransaction } = require("../utils/transaction.util");
const { bumpNsVersion } = require("@/utils/cache.util");

// A transfer's accounts and amount, checked before any money moves
const transferTerms = ({ fromAccount, toAccount, amount }) => {
  if (!fromAccount || !toAccount || amount === undefined || amount === null || amount === "") {
    throw new customError(
      "fromAccount, toAccount and amount are required",
      statusCodes.BAD_REQUEST,
    );
  }
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) {
    throw new customError("Amount must be more than 0", statusCodes.BAD_REQUEST);
  }
  if (String(fromAccount) === String(toAccount)) {
    throw new customError(
      "Choose two different accounts for a transfer",
      statusCodes.BAD_REQUEST,
    );
  }
  return { fromAccount, toAccount, amount: value };
};

const moveBalance = async (accountId, change, session) => {
  const account = await Account.findByIdAndUpdate(
    accountId,
    { $inc: { balance: change } },
    { new: true, session },
  );
  if (!account) throw new customError("Account not found", statusCodes.NOT_FOUND);
};

// Take the amount out of one account and into the other (sign -1 undoes it)
const applyTransfer = async ({ fromAccount, toAccount, amount }, session, sign = 1) => {
  await moveBalance(fromAccount, -sign * amount, session);
  await moveBalance(toAccount, sign * amount, session);
};

// create money transfer
exports.createMoneyTransfer = asynchandeler(async (req, res) => {
  const { transactionDesction, voucherNumber } = req.body;
  // The schema field is `Date` (what the dashboard sends and reads); `date`
  // is accepted too. Written as `date` it was dropped by strict mode.
  const transferDate = req.body.Date ?? req.body.date;
  const terms = transferTerms(req.body);

  const result = await inTransaction(async (session) => {
    await applyTransfer(terms, session);
    const [created] = await MoneyTransfer.create(
      [
        {
          ...(transferDate ? { Date: transferDate } : {}),
          ...terms,
          transactionDesction,
          voucherNumber,
          balanceApplied: true,
        },
      ],
      { session },
    );
    return created;
  });

  await bumpNsVersion("account");

  apiResponse.sendSuccess(
    res,
    statusCodes.CREATED,
    "Money Transfer created",
    result,
  );
});

// get all money transfer
exports.getAllMoneyTransfer = asynchandeler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
  const skip = (page - 1) * limit;

  const query = {};
  if (req.query.serial) {
    query.transferSerialId = req.query.serial;
  }

  const [transfers, total] = await Promise.all([
    MoneyTransfer.find(query)
      .populate("fromAccount")
      .populate("toAccount")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    MoneyTransfer.countDocuments(query),
  ]);

  if (!transfers.length && page === 1) {
    return apiResponse.sendSuccess(res, statusCodes.OK, "Money Transfer not found", {
      transfers: [],
      total: 0,
      page,
      limit,
      hasNextPage: false,
    });
  }

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Money Transfer fetched",
    { transfers, total, page, limit, hasNextPage: page * limit < total },
  );
});

// get single money transfer
exports.getSingleMoneyTransfer = asynchandeler(async (req, res) => {
  const { id } = req.params;
  const result = await MoneyTransfer.findOne({ _id: id })
    .populate("fromAccount")
    .populate("toAccount");
  if (!result) {
    throw new customError("Money Transfer not found", statusCodes.NOT_FOUND);
  }
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Money Transfer fetched",
    result,
  );
});

// update single money transfer
exports.updateMoneyTransfer = asynchandeler(async (req, res) => {
  const { id } = req.params;
  if (!id) {
    throw new customError("Id is required", 400);
  }

  const result = await inTransaction(async (session) => {
    const existing = await MoneyTransfer.findById(id).session(session);
    if (!existing) {
      throw new customError("Money Transfer not found", statusCodes.NOT_FOUND);
    }
    const terms = transferTerms({
      fromAccount: req.body.fromAccount ?? existing.fromAccount,
      toAccount: req.body.toAccount ?? existing.toAccount,
      amount: req.body.amount ?? existing.amount,
    });

    // The old transfer is undone and the new one applied, so a changed amount
    // or account moves exactly the difference
    if (existing.balanceApplied) await applyTransfer(existing, session, -1);
    await applyTransfer(terms, session);

    // Only the transfer's own fields; the body is never written as is
    Object.assign(existing, terms, { balanceApplied: true });
    for (const field of ["transactionDesction", "voucherNumber"]) {
      if (req.body[field] !== undefined) existing[field] = req.body[field];
    }
    const transferDate = req.body.Date ?? req.body.date;
    if (transferDate !== undefined) existing.Date = transferDate;
    await existing.save({ session });
    return existing;
  });

  await bumpNsVersion("account");

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Money Transfer updated",
    result,
  );
});

// delete single money transfer
exports.deleteMoneyTransfer = asynchandeler(async (req, res) => {
  const { id } = req.params;
  if (!id) {
    throw new customError("Id is required", statusCodes.BAD_REQUEST);
  }

  const result = await inTransaction(async (session) => {
    const existing = await MoneyTransfer.findOneAndDelete({ _id: id }, { session });
    if (!existing) {
      throw new customError("Money Transfer not found", statusCodes.NOT_FOUND);
    }
    // The money goes back to the account it came from
    if (existing.balanceApplied) await applyTransfer(existing, session, -1);
    return existing;
  });

  await bumpNsVersion("account");

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Money Transfer deleted",
    result,
  );
});
