require("dotenv").config();
const mongoose = require("mongoose");
const { tenantPlugin } = require("../tenancy/tenantPlugin");
const Counter = require("./counter.model");
const { getInvoicePrefix } = require("../integrations/config");
/** -------------------------
 * Sub Schemas
 * ------------------------*/

// walking customer (embedded)
const walkingCustomerSchema = new mongoose.Schema(
  {
    customerName: { type: String, trim: true },
    mobileNumber: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    address: { type: String, trim: true },
  },
  { _id: false },
);

// searchItem (embedded array)
const searchItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    variantId: { type: mongoose.Schema.Types.ObjectId, ref: "Variant" },

    salesStatus: {
      type: String,
      enum: ["sale", "return", "exchange"],
      default: "sale",
    },

    barcode: { type: String, trim: true },
    productDescription: { type: String, trim: true },

    color: { type: String, trim: true },
    size: { type: String, trim: true },

    quantity: { type: Number, default: 1, min: 0 },
    groupQuantity: { type: Number, default: 0, min: 0 },
    unit: { type: String, trim: true },

    salesRate: { type: Number, default: 0, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    // Whether `discount` is a flat taka amount off each unit or a percentage
    // of the line. Without this the value is ambiguous on read: editing a sale
    // could not tell 10% from ৳10 and had to assume one of them, silently
    // changing the price. Defaults to "amount" so sales saved before this
    // field existed keep the behaviour they were read with.
    discountType: {
      type: String,
      enum: ["amount", "percent"],
      default: "amount",
    },

    subtotal: { type: Number, default: 0, min: 0 },

    // What one unit cost when the line was sold, stamped server-side from the
    // variant's or product's purchasePrice. Absent on sales saved before this
    // field existed; profit then falls back to the catalogue's current price.
    purchasePrice: { type: Number, min: 0 },
  },
  { _id: false },
);

// payments (embedded)
const singlePaymentSchema = new mongoose.Schema(
  {
    amount: { type: Number, default: 0, min: 0 },
    paymentTo: { type: mongoose.Types.ObjectId, ref: "Account", trim: true },
    remark: { type: String, trim: true },
  },
  { _id: false },
);

const multiplePaymentSchema = new mongoose.Schema(
  {
    amount: { type: Number, default: 0, min: 0 },
    paymentTo: { type: mongoose.Types.ObjectId, ref: "Account", trim: true },
    remark: { type: String, trim: true },
  },
  { _id: false },
);

const paymentMethodSchema = new mongoose.Schema(
  {
    singlePayment: { type: singlePaymentSchema, default: null },
    multiplePayment: { type: [multiplePaymentSchema], default: [] },
  },
  { _id: false },
);

// customerType (walking or listed)
const customerTypeSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["walking", "listed"],
      default: "walking",
      required: true,
    },
    walking: { type: walkingCustomerSchema, default: null },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
  },
  { _id: false },
);

/** -------------------------
 * Sales Schema
 * ------------------------*/

const salesSchema = new mongoose.Schema(
  {
    date: { type: Date, default: Date.now },
    deliveryDate: { type: Date },

    invoiceNumber: { type: String, trim: true, unique: true, index: true },

    customerType: { type: customerTypeSchema, required: true },

    searchItem: { type: [searchItemSchema], default: [] },

    // Optional: a sale may be made without naming a salesman
    salesMen: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },

    // The logged-in user who made the sale. Set once, server-side, when the
    // sale is created and never changed by an edit — unlike discountGivenBy
    // below, which moves to whoever last edited it. The user sales invoice
    // report lists a user's sales by this.
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },

    // The logged-in user (seller/admin) who created this sale and is
    // accountable for any discount applied. Set server-side from req.user,
    // never trusted from the request body. Populated in reports.
    discountGivenBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    invoiceStatus: {
      type: String,
      enum: ["complete", "draft", "pending"],
      default: "draft",
    },

    remark: { type: String, trim: true },
    sendSms: { type: Boolean, default: false },

    total: { type: Number, default: 0, min: 0 },
    return: { type: Number, default: 0, min: 0 },

    discountPercent: { type: Number, default: 0, min: 0, max: 100 },
    vatPercent: { type: Number, default: 0, min: 0, max: 100 },

    deliveryCost: { type: Number, default: 0, min: 0 },
    labourCost: { type: Number, default: 0, min: 0 },

    lessTaka: { type: Number, default: 0, min: 0 },
    customerAdvancePaymentAdjust: { type: Number, default: 0, min: 0 },

    payable: { type: Number, default: 0, min: 0 },
    // What the customer actually handed over.
    paid: { type: Number, default: 0, min: 0 },
    // Change given back — only ever the overpay above payable.
    changes: { type: Number, default: 0, min: 0 },
    // Cash the shop kept: paid - changes. Stored rather than derived so
    // reports can sum it directly, and set server-side on every write so it
    // cannot drift from the two fields above.
    netPaid: { type: Number, default: 0, min: 0 },

    presentDue: { type: Number, default: 0, min: 0 },
    previousDue: { type: Number, default: 0, min: 0 },
    balance: { type: Number, default: 0 },

    paymentMethod: { type: paymentMethodSchema, default: {} },

    paymentStatus: {
      type: String,
      enum: ["paid", "partial", "due"],
      default: "due",
    },

    salesType: {
      type: String,
      enum: ["wholesale", "retailsale", "retailsaleorder", "wholesaleorder"],
      default: "retailsale",
    },
  },
  { timestamps: true },
);

// Auto-generate a sequential, never-reused invoiceNumber after first save —
// e.g. INV-INV-01. The counter is atomic, so concurrent sales can't collide the
// way a find-the-last-invoice-and-increment scan can.
salesSchema.post("save", async function (doc, next) {
  try {
    if (doc.invoiceNumber) return next();

    const session = doc.$session();

    const counter = await Counter.findOneAndUpdate(
      { key: "SALES_INVOICE" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true, session },
    );

    const padded = String(counter.seq).padStart(2, "0");
    doc.invoiceNumber = `INV-${await getInvoicePrefix()}-${padded}`;
    await doc.constructor.updateOne(
      { _id: doc._id },
      { $set: { invoiceNumber: doc.invoiceNumber } },
      { session },
    );
    next();
  } catch (error) {
    next(error);
  }
});

// Phase 2 (BUG-P2-002/006/009): reports and widgets filter by date, customer
// or salesman, and the sales list pages newest first. The tenant plugin puts
// tenantId in front of each. Built by migration 014 where autoIndex is off.
salesSchema.index({ date: -1, _id: -1 });
salesSchema.index({ createdAt: -1, _id: -1 });
salesSchema.index({ "customerType.customerId": 1, date: -1 });
salesSchema.index({ salesMen: 1, date: -1 });
// The sales list's paid/due counts and due total (get-sales-stats)
salesSchema.index({ paymentStatus: 1, createdAt: -1 });
// The customer due list counts listed customers' due invoices (BUG-P2-009)
salesSchema.index({ paymentStatus: 1, invoiceStatus: 1, "customerType.customerId": 1 });
// The customer balance summary's totals: what listed customers were billed and
// paid, read from this index alone (it carries payable and netPaid), not from
// half a million sale documents (BUG-P2-009)
salesSchema.index({ invoiceStatus: 1, "customerType.customerId": 1, date: 1, payable: 1, netPaid: 1 });

salesSchema.plugin(tenantPlugin);
const Sales = mongoose.models.Sales || mongoose.model("Sales", salesSchema);

module.exports = Sales;
