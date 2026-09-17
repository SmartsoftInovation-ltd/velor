const mongoose = require("mongoose");
const { tenantPlugin } = require("../tenancy/tenantPlugin");

const counterSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true, // EMPLOYEE, ORDER, INVOICE etc
      trim: true,
    },
    seq: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

counterSchema.plugin(tenantPlugin);
module.exports =
  mongoose.models.Counter || mongoose.model("Counter", counterSchema);
