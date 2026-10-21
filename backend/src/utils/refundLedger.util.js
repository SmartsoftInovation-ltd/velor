const Account = require("../models/account.model");
const CrateTransaction = require("../models/crateTransaction.model");
const { customError } = require("../lib/CustomError");
const { statusCodes } = require("../constant/constant");

// A sales-return refund leaves the refund account: its balance goes down by
// the refund, like every other payment out of an account.
const takeRefundFromAccount = async (accountId, amount, session) => {
  const account = await Account.findByIdAndUpdate(
    accountId,
    { $inc: { balance: -amount } },
    { new: true, session },
  );
  if (!account) {
    throw new customError("Refund account not found", statusCodes.NOT_FOUND);
  }
  return account.balance;
};

// Undo a refund transaction's effect on its account. Only rows marked
// `balanceApplied` ever moved the balance; older rows are left alone.
const giveRefundBack = async (transaction, session) => {
  if (!transaction?.balanceApplied) return;
  await Account.findByIdAndUpdate(
    transaction.account,
    { $inc: { balance: transaction.amount } },
    { session },
  );
};

// Delete refund transactions, putting their amounts back on their accounts
const deleteRefundTransactions = async (ids, session) => {
  const transactions = await CrateTransaction.find({ _id: { $in: ids } }).session(session);
  for (const transaction of transactions) await giveRefundBack(transaction, session);
  await CrateTransaction.deleteMany({ _id: { $in: ids } }, { session });
};

module.exports = { takeRefundFromAccount, giveRefundBack, deleteRefundTransactions };
