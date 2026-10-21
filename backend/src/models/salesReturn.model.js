const mongoose = require("mongoose");
const { tenantPlugin } = require("../tenancy/tenantPlugin");
const { customError } = require("../lib/CustomError");
const { statusCodes } = require("../constant/constant");
const Counter = require("./counter.model");
const { getInvoicePrefix } = require("../integrations/config");
const salesReturnSchema = new mongoose.Schema(
  {
    returnId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },

    // Indexed by the unique { tenantId, invoiceNumber } index below
    invoiceNumber: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sales",
      required: true,
    },
    refundMethod: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      required: true,
    },
    transaction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CrateTransaction",
      default: null,
    },
    returnReason: {
      type: String,
      trim: true,
      required: true,
    },
    allproduct: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          default:null,
        
        },
        variant: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Variant",
          default:null,
        },
        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
        unitPrice: {
          type: Number,
          required: true,
        },
        subtotal: {
          type: Number,
          required: true,
        },
      },
    ],
    // Refund breakdown: items at their sale price, less the invoice discount %
    // and the returned units' share of the invoice's less-taka.
    grossReturnAmount: { type: Number, default: 0 },
    discountPercent: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    lessTakaShare: { type: Number, default: 0 },
    totalReturnAmount: {
      type: Number,
      required: true,
      default: 0,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    remarks: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true },
);



// Duplicate check hook for invoiceNumber (redundant due to unique:true but good for custom error)
salesReturnSchema.pre("save", async function (next) {
  try {
    if (this.isModified("invoiceNumber")) {
      // Read inside the caller's transaction. The unique index below is what
      // actually holds under parallel requests; this check gives the message.
      const existing = await this.constructor.findOne({
        invoiceNumber: this.invoiceNumber,
        _id: { $ne: this._id },
      }).session(this.$session());
      if (existing) {
        return next(
          new customError(
            `SalesReturn with invoice number ${this.invoiceNumber} already exists`,
            statusCodes.BAD_REQUEST,
          ),
        );
      }
    }
    next();
  } catch (error) {
    next(error);
  }
});

// Auto-generate a sequential, never-reused returnId after first save — e.g.
// RET-INV-01. The counter is atomic, so concurrent returns can't collide the
// way a count-the-rows-and-increment scheme can.
salesReturnSchema.post("save", async function (doc, next) {
  try {
    if (doc.returnId) return next();

    const session = doc.$session();

    const counter = await Counter.findOneAndUpdate(
      { key: "SALES_RETURN" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true, session },
    );

    const padded = String(counter.seq).padStart(2, "0");
    doc.returnId = `RET-${await getInvoicePrefix()}-${padded}`;
    await doc.constructor.updateOne(
      { _id: doc._id },
      { $set: { returnId: doc.returnId } },
      { session },
    );
    next();
  } catch (error) {
    next(error);
  }
});

// One return per invoice. Without the index, parallel requests could each pass
// the pre-save check and create two returns (two refunds, double restock).
// Built by migration 012 where autoIndex is off.
salesReturnSchema.index({ tenantId: 1, invoiceNumber: 1 }, { unique: true });

salesReturnSchema.plugin(tenantPlugin);
const SalesReturn =
  mongoose.models.SalesReturn ||
  mongoose.model("SalesReturn", salesReturnSchema);

module.exports = SalesReturn;
