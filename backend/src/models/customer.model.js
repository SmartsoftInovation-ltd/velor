const mongoose = require("mongoose");
const { tenantPlugin } = require("../tenancy/tenantPlugin");
const { searchWordsPlugin } = require("../utils/searchWords.util");
const { customError } = require("../lib/CustomError");
const { statusCodes } = require("../constant/constant");

const { default: slugify } = require("slugify");
const Counter = require("./counter.model");
const { getInvoicePrefix } = require("../integrations/config");
const customerTypeSchema = mongoose.Schema({
  customerType: {
    type: String,
    trim: true,
    default: "",
    // example enum if you want:
    // enum: ["regular", "wholesale", "vip", ""],
  },
  slug: {
    type: String,
  },
});

// make a slug
customerTypeSchema.pre("save", function (next) {
  if (this.isModified("customerType")) {
    this.slug = slugify(this.customerType, {
      lower: true,
      strict: true,
      trim: true,
    });
  }
  next();
});

// check if slug already exist or not
customerTypeSchema.pre("save", async function (next) {
  try {
    const existing = await this.constructor.findOne({ slug: this.slug });
    if (existing && existing._id.toString() !== this._id.toString()) {
      return next(
        new customError(
          `Customer type with name "${this.customerType}" already exists`,
          statusCodes.BAD_REQUEST,
        ),
      );
    }
    next();
  } catch (error) {
    next(error);
  }
});

//when findoneandupdate then update the slug
customerTypeSchema.pre("findOneAndUpdate", async function (next) {
  const update = this.getUpdate();
  if (update.customerType) {
    update.slug = slugify(update.customerType, {
      lower: true,
      strict: true,
      trim: true,
    });
  }
  next();
});

customerTypeSchema.plugin(tenantPlugin);
const CustomerType =
  mongoose.models.CustomerType ||
  mongoose.model("CustomerType", customerTypeSchema);

// customer model

const customerSchema = new mongoose.Schema(
  {
    customSerialId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },

    customerId: {
      type: String,
      trim: true,
      unique: true,
      index: true,
    },

    customerType: {
      type: mongoose.Types.ObjectId,
      ref: "CustomerType",
      required: [true, "Customer type is required"],
      trim: true,
    },

    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
      minlength: 2,
      maxlength: 100,
    },

    mobileNumber: {
      type: String,
      required: [true, "Mobile number is required"],
      trim: true,
      unique: true,
      validate: {
        validator: function (v) {
          // BD mobile: 01 + operator digit 3–9 + 8 digits, optionally with 880 / +880
          return /^(?:\+?880|0)1[3-9]\d{8}$/.test(v);
        },
        message: "Invalid mobile number format",
      },
    },

    // Optional second number, same format; not unique
    secondaryMobileNumber: {
      type: String,
      trim: true,
      default: "",
      validate: {
        validator: (v) => !v || /^(?:\+?880|0)1[3-9]\d{8}$/.test(v),
        message: "Invalid secondary mobile number format",
      },
    },

    occupation: {
      type: String,
      trim: true,
      default: "",
    },

    nidNumber: {
      type: String,
      trim: true,
    },

    // The live running due. Sales, payments and returns all move this, so it
    // is never edited by hand — the edit form shows it read-only.
    openingDues: {
      type: Number,
      default: 0,
      min: [0, "Opening dues cannot be negative"],
    },

    // The due the customer was carried in with, captured once at creation from
    // openingDues and never touched by transactions. Editable afterwards so a
    // wrong starting figure can be corrected.
    initialDue: {
      type: Number,
      default: 0,
      min: [0, "Initial due cannot be negative"],
    },

    advancePaymentRecived: {
      type: Number,
      default: 0,
      min: [0, "Advance payment recived cannot be negative"],
    },

    regularDiscountPercent: {
      type: Number,
      default: 0,
      min: [0, "Discount cannot be negative"],
      max: [100, "Discount cannot be more than 100"],
    },
    dueLimit: {
      type: Number,
      default: 0,
      min: [0, "Due limit cannot be negative"],
    },

    emailAddress: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
      validate: {
        validator: function (v) {
          if (!v) return true; // optional
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        },
        message: "Invalid email address",
      },
    },

    image: {
      url: { type: String, default: "" },
      publicId: { type: String, default: "" },
      // Cloudinary account the asset lives in (tenants can change accounts)
      cloudName: { type: String, default: "" },
      status: {
        type: String,
        enum: ["pending", "processing", "uploaded", "failed"],
        default: "pending",
      },
      localPath: { type: String, default: "" },
      tries: { type: Number, default: 0 },
      lastError: { type: String, default: "" },
    },

    remarks: {
      type: String,
      trim: true,
      default: "",
      maxlength: 1000,
    },

    presentAddress: {
      type: String,
      trim: true,
      default: "",
      maxlength: 1000,
    },

    permanentAddress: {
      type: String,
      trim: true,
      default: "",
      maxlength: 1000,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

/**
 * Auto set customerId = mobileNumber (your UI says "Enter Mobile Number As ID")
 */
customerSchema.pre("save", function (next) {
  if (!this.customerId && this.mobileNumber) {
    this.customerId = this.mobileNumber;
  }
  next();
});

/**
 * Uniqueness check with customError
 * - customerId unique
 * - mobileNumber unique
 */
customerSchema.pre("save", async function (next) {
  try {
    const Customer = this.constructor;

    // check customerId
    if (this.customerId) {
      const existingById = await Customer.findOne({
        customerId: this.customerId,
      });
      if (existingById && existingById._id.toString() !== this._id.toString()) {
        return next(
          new customError(
            `Customer with ID ${this.customerId} already exists`,
            statusCodes.BAD_REQUEST,
          ),
        );
      }
    }

    // check mobileNumber
    if (this.mobileNumber) {
      const existingByMobile = await Customer.findOne({
        mobileNumber: this.mobileNumber,
      });
      if (
        existingByMobile &&
        existingByMobile._id.toString() !== this._id.toString()
      ) {
        return next(
          new customError(
            `Customer with mobile ${this.mobileNumber} already exists`,
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

// Auto-generate a sequential, never-reused customSerialId after first save
customerSchema.post("save", async function (doc, next) {
  try {
    if (doc.customSerialId) return next();

    const session = doc.$session();

    const counter = await Counter.findOneAndUpdate(
      { key: "CUSTOMER_SERIAL" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true, session },
    );

    const padded = String(counter.seq).padStart(2, "0");
    doc.customSerialId = `CUS-${await getInvoicePrefix()}-${padded}`;
    await doc.constructor.updateOne(
      { _id: doc._id },
      { $set: { customSerialId: doc.customSerialId } },
      { session },
    );
    next();
  } catch (error) {
    next(error);
  }
});

// Indexed word-prefix search on the name (the report customer picker, BUG-P2-002).
// Before tenantPlugin, which puts tenantId in front of the indexes declared so far.
customerSchema.plugin(searchWordsPlugin, { field: "fullName" });
// The due list sorts customers by what they owe (BUG-P2-009)
customerSchema.index({ openingDues: -1, fullName: 1, _id: 1 });
// The balance summary lists customers by name
customerSchema.index({ fullName: 1, _id: 1 });

customerSchema.plugin(tenantPlugin);
const customerModel =
  mongoose.models.Customer || mongoose.model("Customer", customerSchema);

// customer payment recived model schema

const customerPaymentRecivedSchema = new mongoose.Schema(
  {
    paymentId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },

    customer: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, "Customer id is required"],
      trim: true,
      ref: "Customer",
    },

    referenceInvoice: {
      type: String,
      trim: true,
      default: "",
    },

    // Snapshot of the customer's due balance at the moment this payment
    // was recorded — required so historical rows keep showing their own
    // before/after figures instead of the customer's current live due.
    dueBeforePayment: {
      type: Number,
      default: 0,
      min: 0,
    },

    remainingDue: {
      type: Number,
      default: 0,
      min: 0,
    },

    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    lessAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    cashBack: {
      type: Number,
      default: 0,
      min: 0,
    },

    date: {
      type: Date,
    },

    paymentMode: {
      type: mongoose.Schema.Types.ObjectId,
      trim: true,
      ref: "Account",
    },

    remarks: {
      type: String,
      trim: true,
      default: "",
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Auto-generate a sequential, never-reused paymentId after first save
customerPaymentRecivedSchema.post("save", async function (doc, next) {
  try {
    if (doc.paymentId) return next();

    const session = doc.$session();

    const counter = await Counter.findOneAndUpdate(
      { key: "CUSTOMER_PAYMENT" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true, session },
    );

    const padded = String(counter.seq).padStart(2, "0");
    doc.paymentId = `CPR-${await getInvoicePrefix()}-${padded}`;
    await doc.constructor.updateOne(
      { _id: doc._id },
      { $set: { paymentId: doc.paymentId } },
      { session },
    );
    next();
  } catch (error) {
    next(error);
  }
});

// Phase 2 (BUG-P2-009): a customer's payments, by date
customerPaymentRecivedSchema.index({ customer: 1, date: -1 });
// The customer payment report pages the range newest first (BUG-P2-009)
customerPaymentRecivedSchema.index({ date: -1, _id: -1 });

customerPaymentRecivedSchema.plugin(tenantPlugin);
const customerPaymentRecived =
  mongoose.models.CustomerPaymentRecived ||
  mongoose.model("CustomerPaymentRecived", customerPaymentRecivedSchema);

// advance customer payment

const customerAdvancePaymentRecivedSchema = new mongoose.Schema(
  {
    paymentId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },

    customer: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, "Customer name is required"],
      trim: true,
      ref: "Customer",
    },

    // form shows current balance (optional store)
    balance: {
      type: Number,
      default: 0,
      min: [0, "Balance cannot be negative"],
    },

    paidAmount: {
      type: Number,
      min: [0, "Paid amount cannot be negative"],
    },

    advanceCashBack: {
      type: Number,
      default: 0,
      min: [0, "Advance cash back cannot be negative"],
    },

    paymentMode: {
      type: mongoose.Schema.Types.ObjectId,
      trim: true,
      ref: "Account",
      required: [true, "Payment mode is required"],
    },

    date: {
      type: Date,
    },

    remarks: {
      type: String,
      trim: true,
      default: "",
      maxlength: 500,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

// Auto-generate a sequential, never-reused paymentId after first save
customerAdvancePaymentRecivedSchema.post("save", async function (doc, next) {
  try {
    if (doc.paymentId) return next();

    const session = doc.$session();

    const counter = await Counter.findOneAndUpdate(
      { key: "CUSTOMER_ADVANCE_PAYMENT" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true, session },
    );

    const padded = String(counter.seq).padStart(2, "0");
    doc.paymentId = `CAP-${await getInvoicePrefix()}-${padded}`;
    await doc.constructor.updateOne(
      { _id: doc._id },
      { $set: { paymentId: doc.paymentId } },
      { session },
    );
    next();
  } catch (error) {
    next(error);
  }
});

// The customer payment report pages the range newest first (BUG-P2-009)
customerAdvancePaymentRecivedSchema.index({ date: -1, _id: -1 });

customerAdvancePaymentRecivedSchema.plugin(tenantPlugin);
const customerAdvancePaymentModel =
  mongoose.models.CustomerAdvancePaymentRecived ||
  mongoose.model(
    "CustomerAdvancePaymentRecived",
    customerAdvancePaymentRecivedSchema,
  );

module.exports = {
  CustomerType,
  customerModel,
  customerPaymentRecived,
  customerAdvancePaymentModel,
};
