const mongoose = require("mongoose");
const { tenantPlugin } = require("../tenancy/tenantPlugin");
const Counter = require("./counter.model");
const { getInvoicePrefix } = require("../integrations/config");
const fundHandoverDescriptionSchema = new mongoose.Schema(
  {
    // Sequential, never-reused display serial — e.g. MH-INV-01
    handoverSerialId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },

    date: {
      type: Date,
      required: true,
      trim: true,
    },
    transactionDescription: {
      type: String,
      lowercase: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    voucherNumber: {
      type: String,
      trim: true,
    },
    fundPaymentMode: {
      type: mongoose.Types.ObjectId,
      ref: "Account",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { timestamps: true }
);

// Auto-generate a sequential, never-reused handoverSerialId after first save
fundHandoverDescriptionSchema.post("save", async function (doc, next) {
  try {
    if (doc.handoverSerialId) return next();

    const session = doc.$session();

    const counter = await Counter.findOneAndUpdate(
      { key: "MONEY_HANDOVER_SERIAL" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true, session },
    );

    const padded = String(counter.seq).padStart(2, "0");
    doc.handoverSerialId = `MH-${await getInvoicePrefix()}-${padded}`;
    await doc.constructor.updateOne(
      { _id: doc._id },
      { $set: { handoverSerialId: doc.handoverSerialId } },
      { session },
    );
    next();
  } catch (error) {
    next(error);
  }
});

fundHandoverDescriptionSchema.plugin(tenantPlugin);
module.exports =
  mongoose.models.FundHandoverDescription ||
  mongoose.model("FundHandoverDescription", fundHandoverDescriptionSchema);
