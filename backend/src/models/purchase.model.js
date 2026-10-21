const mongoose = require("mongoose");
const { tenantPlugin } = require("../tenancy/tenantPlugin");
const { customError } = require("../lib/CustomError");
const { statusCodes } = require("../constant/constant");
const Counter = require("./counter.model");
const { getInvoicePrefix } = require("../integrations/config");
const purchaseSchema = new mongoose.Schema(
  {
    serial: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },

    invoiceNumber: {
      type: String,
      unique: true,
      required: true,
      trim: true,
    },
    date: {
      type: Date,
      default: Date.now,
    },

    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supplier",
      required: true,
    },

    cashType: {
      type: mongoose.Schema.Types.ObjectId,
      ref:"Account"
    },

    // inline product schema
    allproduct: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
        },
        variant: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Variant",
        },

        purchasePrice: {
          type: Number,
        },
        retailPrice: {
          type: Number,
        },
        wholesalePrice: {
          type: Number,
        },
        subTotal: {
          type: Number,
          default: 0,
        },
        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
        size: {
          type: String,
          trim: true,
        },
        color: {
          type: String,
          trim: true,
        },
      },
    ],

    subTotal: {
      type: Number,
      default: 0,
    },
    commission: {
      type: Number,
      default: 0,
    },
    shipping: {
      type: Number,
      default: 0,
    },
    payable: {
      type: Number,
      default: 0,
    },
    dueamount: {
      type: Number,
      default: 0,
    },
    paid: {
      type: Number,
      default: 0,
    },

    // Derived from paid vs payable, never trusted from the request body:
    // 0 paid -> "due", paid below payable -> "partial", paid covering payable
    // -> "paid". Kept as a stored field rather than computed on read so the
    // purchase report can filter and index on it.
    paymentStatus: {
      type: String,
      enum: ["paid", "partial", "due"],
      default: "due",
      index: true,
    },

    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
    },
    subCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subcategory",
    },
    brand: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Brand",
    },
  },
  { timestamps: true },
);

// Single source of truth for the status rule, shared by the document hook and
// the update hooks below so every write path agrees.
//
// A zero or negative payable (a fully-discounted or empty purchase) has nothing
// left to owe, so it counts as settled rather than falling through to "due".
function derivePurchasePaymentStatus(paid, payable) {
  const paidAmount = Number(paid) || 0;
  const payableAmount = Number(payable) || 0;
  if (payableAmount <= 0) return "paid";
  if (paidAmount <= 0) return "due";
  if (paidAmount >= payableAmount) return "paid";
  return "partial";
}

purchaseSchema.statics.derivePaymentStatus = derivePurchasePaymentStatus;

// Recompute on every document save, so create/update paths cannot drift.
purchaseSchema.pre("save", function (next) {
  this.paymentStatus = derivePurchasePaymentStatus(this.paid, this.payable);
  next();
});

// findOneAndUpdate / updateOne / updateMany bypass document middleware, so the
// same rule is reapplied here. Only runs when the update actually touches paid
// or payable; otherwise the stored status is already correct and re-reading the
// document on every unrelated update would be wasted work.
async function reapplyPaymentStatusOnUpdate(next) {
  try {
    const update = this.getUpdate();
    if (!update) return next();

    const set = update.$set || update;
    const inc = update.$inc || {};
    const touchesPaid = "paid" in set || "paid" in inc;
    const touchesPayable = "payable" in set || "payable" in inc;
    if (!touchesPaid && !touchesPayable) return next();

    const current = await this.model.findOne(this.getQuery()).select("paid payable").lean();

    const nextPaid =
      "paid" in set ? set.paid : (current?.paid || 0) + (inc.paid || 0);
    const nextPayable =
      "payable" in set ? set.payable : (current?.payable || 0) + (inc.payable || 0);

    const status = derivePurchasePaymentStatus(nextPaid, nextPayable);
    if (update.$set) update.$set.paymentStatus = status;
    else update.paymentStatus = status;
    this.setUpdate(update);
    next();
  } catch (error) {
    next(error);
  }
}

purchaseSchema.pre("findOneAndUpdate", reapplyPaymentStatusOnUpdate);
purchaseSchema.pre("updateOne", reapplyPaymentStatusOnUpdate);
purchaseSchema.pre("updateMany", reapplyPaymentStatusOnUpdate);

purchaseSchema.pre("save", async function (next) {
  try {
    const existingInvoiceNumber = await this.constructor.findOne({
      invoiceNumber: this.invoiceNumber,
    });
    if (
      existingInvoiceNumber &&
      existingInvoiceNumber._id.toString() !== this._id.toString()
    ) {
      return next(
        new customError(
          "Invoice Number already exists",
          statusCodes.BAD_REQUEST,
        ),
      );
    }
    next();
  } catch (error) {
    next(error);
  }
});
// check invoiceid is unique or not
purchaseSchema.index({ invoiceNumber: 1 }, { unique: true });

// Purchase invoice report — date-range scan, optionally narrowed by supplier
purchaseSchema.index({ date: -1 });
purchaseSchema.index({ supplierId: 1, date: -1 });
// Supplier purchase invoice report — status filter within a date range
purchaseSchema.index({ paymentStatus: 1, date: -1 });
// Phase 2: reports price a page of items from the purchases that hold them
purchaseSchema.index({ "allproduct.product": 1, date: -1 });
purchaseSchema.index({ "allproduct.variant": 1, date: -1 });

// Auto-generate a sequential, never-reused serial after first save
purchaseSchema.post("save", async function (doc, next) {
  try {
    if (doc.serial) return next();

    const session = doc.$session();

    const counter = await Counter.findOneAndUpdate(
      { key: "PURCHASE_SERIAL" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true, session },
    );

    const padded = String(counter.seq).padStart(2, "0");
    doc.serial = `PUR-${await getInvoicePrefix()}-${padded}`;
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

purchaseSchema.plugin(tenantPlugin);
const Purchase =
  mongoose.models.Purchase || mongoose.model("Purchase", purchaseSchema);

module.exports = Purchase;
