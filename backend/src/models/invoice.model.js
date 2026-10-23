const mongoose = require("mongoose");
const { tenantPlugin } = require("../tenancy/tenantPlugin");
const Counter = require("./counter.model");
const { getInvoicePrefix } = require("../integrations/config");
const { Schema } = mongoose;

// Define the schema for the invoice model
const invoiceSchema = new Schema(
  {
    // Sequential, never reused per store: INV-<prefix>-01, INV-<prefix>-02, …
    invoiceSerialId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    // A unique identifier for the invoice
    invoiceId: {
      type: String,
      required: true,
      unique: true,
    },
    // Reference to the order this invoice belongs to
    order: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      unique: true,
    },
    // Invoice details
    customerDetails: {},
    // The total amount of all products before discounts and delivery charges
    totalAmount: {
      type: Number,
      required: true,
    },
    // The amount of discount applied from a coupon
    discountAmount: {
      type: Number,
      default: 0,
    },
    // The total final amount to be paid by the customer
    finalAmount: {
      type: Number,
      required: true,
    },
    // The delivery charge amount
    deliveryChargeAmount: {
      type: Number,
      required: true,
    },
    // An optional URL to the generated PDF invoice (e.g., in cloud storage)
    invoiceUrl: {
      type: String,
    },
    // An optional URL to the payment gateway's hosted invoice page
    paymentGatewayUrl: {
      type: String,
    },
    ProductInfo: {},
  },
  {
    timestamps: true, // Automatically add createdAt and updatedAt fields
  }
);

invoiceSchema.statics.assignSerial = async function (doc, session) {
  const counter = await Counter.findOneAndUpdate(
    { key: "INVOICE_SERIAL" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, session },
  );

  const padded = String(counter.seq).padStart(2, "0");
  doc.invoiceSerialId = `INV-${await getInvoicePrefix()}-${padded}`;
  await this.updateOne(
    { _id: doc._id },
    { $set: { invoiceSerialId: doc.invoiceSerialId } },
    { session },
  );
};

// Auto-generate a sequential, never-reused invoiceSerialId after first save
invoiceSchema.post("save", async function (doc, next) {
  try {
    if (doc.invoiceSerialId) return next();
    await doc.constructor.assignSerial(doc, doc.$session());
    next();
  } catch (error) {
    next(error);
  }
});

invoiceSchema.plugin(tenantPlugin);
// Create the Invoice model from the schema
const Invoice =
  mongoose.models.Invoice || mongoose.model("Invoice", invoiceSchema);

// Export the model for use in other files
module.exports = Invoice;
