const mongoose = require("mongoose");
const Counter = require("./counter.model");
const { env } = require("../config/env.config");

const crateTransactionSchema = new mongoose.Schema(
  {
    // Sequential, never-reused display serial — e.g. TRXID-INV-01
    transactionSerialId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },

    date: {
      type: Date,
      default: Date.now,
    },
    transactionCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TransitionCategory",
    },
    account: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
    },
    transactionDescription: {
      type: String,
      trim: true,
    },
    voucherNumber: {
      type: String,
      trim: true,
    },
    transactionType: {
      type: String,
      enum: ["cash recived", "cash payment"],
    },
    amount: {
      type: Number,
      required: true,
    },
    // account balance right after this transaction applied — audit trail snapshot
    balanceAfter: {
      type: Number,
      default: 0,
    },
    // set only for transactions auto-generated from a sale payment — lets
    // update/delete on that sale find and reverse the matching transaction(s)
    saleReference: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sales",
    },
    // set only for transactions auto-generated from a supplier due payment —
    // lets update/delete on that payment find and reverse the matching transaction
    supplierPaymentReference: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SupplierDuePayment",
    },
    // set only for transactions auto-generated from a customer payment —
    // lets update/delete on that payment find and reverse the matching transaction
    customerPaymentReference: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CustomerPaymentRecived",
    },
    // set only for transactions auto-generated from a customer advance payment
    customerAdvancePaymentReference: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CustomerAdvancePaymentRecived",
    },
    // set only for transactions auto-generated from a purchase's paid amount —
    // lets update/delete on that purchase find and reverse the matching transaction
    purchaseReference: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Purchase",
    },
    // set only for refund transactions auto-generated from a sales return. The
    // return doc also stores the transaction id; this back-pointer is what marks
    // the row as auto-generated so the manual transaction list can exclude it.
    salesReturnReference: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SalesReturn",
    },
  },
  { timestamps: true }
);

crateTransactionSchema.index({ saleReference: 1 });
crateTransactionSchema.index({ supplierPaymentReference: 1 });
crateTransactionSchema.index({ customerPaymentReference: 1 });
crateTransactionSchema.index({ customerAdvancePaymentReference: 1 });
crateTransactionSchema.index({ purchaseReference: 1 });
crateTransactionSchema.index({ salesReturnReference: 1 });

crateTransactionSchema.index({ account: 1, createdAt: -1 });

// Auto-generate a sequential, never-reused transactionSerialId after first save
crateTransactionSchema.post("save", async function (doc, next) {
  try {
    if (doc.transactionSerialId) return next();

    const session = doc.$session();

    const counter = await Counter.findOneAndUpdate(
      { key: "TRANSACTION_SERIAL" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true, session },
    );

    const padded = String(counter.seq).padStart(2, "0");
    doc.transactionSerialId = `TRXID-${env.INVOICE_PREFIX}-${padded}`;
    await doc.constructor.updateOne(
      { _id: doc._id },
      { $set: { transactionSerialId: doc.transactionSerialId } },
      { session },
    );
    next();
  } catch (error) {
    next(error);
  }
});

module.exports =
  mongoose.models.CrateTransaction ||
  mongoose.model("CrateTransaction", crateTransactionSchema);
