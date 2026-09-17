const mongoose = require("mongoose");
const { tenantPlugin } = require("../tenancy/tenantPlugin");
const Counter = require("./counter.model");
const { env } = require("../config/env.config");

const purchaseReturnSchema = new mongoose.Schema(
  {
    serial: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },

    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supplier",
      required: [true, "Supplier is required"],
      index: true,
    },
    returnDate: {
      type: Date,
      default: Date.now,
    },
    // Account the supplier's refund is paid into. The full totalReturnAmount
    // is credited here when the return is created, mirroring how a purchase
    // debits its cashType account.
    cashType: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      required: [true, "Refund account is required"],
    },
    remarks: {
      type: String,
      trim: true,
      maxlength: [500, "Remarks cannot exceed 500 characters"],
      default: "",
    },
    totalReturnAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    products: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          default: null,
        },
        variant: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Variant",
          default: null,
        },
        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
        purchasePrice: {
          type: Number,
          required: true,
          min: 0,
        },
        subtotal: {
          type: Number,
          required: true,
          min: 0,
        },
      },
    ],
  },
  { timestamps: true },
);

purchaseReturnSchema.index({ supplier: 1, createdAt: -1 });
purchaseReturnSchema.index({ returnDate: -1 });

// Auto-generate a sequential, never-reused serial after first save
purchaseReturnSchema.post("save", async function (doc, next) {
  try {
    if (doc.serial) return next();

    const session = doc.$session();

    const counter = await Counter.findOneAndUpdate(
      { key: "PURCHASE_RETURN_SERIAL" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true, session },
    );

    const padded = String(counter.seq).padStart(2, "0");
    doc.serial = `PURR-${env.INVOICE_PREFIX}-${padded}`;
    await doc.constructor.updateOne(
      { _id: doc._id },
      { $set: { serial: doc.serial } },
      { session },
    );
    next();
  } catch (error) {
    next(error);
  }
});

purchaseReturnSchema.plugin(tenantPlugin);
const PurchaseReturn =
  mongoose.models.PurchaseReturn ||
  mongoose.model("PurchaseReturn", purchaseReturnSchema);

module.exports = PurchaseReturn;
