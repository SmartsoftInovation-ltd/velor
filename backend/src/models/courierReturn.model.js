const mongoose = require("mongoose");
const { tenantPlugin } = require("../tenancy/tenantPlugin");

const courierReturnSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
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
    receivedQuantity: { type: Number, default: 0 },
    courierName: { type: String, trim: true, default: "N/A" },
  },
  { timestamps: true },
);

courierReturnSchema.plugin(tenantPlugin);
const CourierReturn =
  mongoose.models.CourierReturn ||
  mongoose.model("CourierReturn", courierReturnSchema);
module.exports = CourierReturn;
