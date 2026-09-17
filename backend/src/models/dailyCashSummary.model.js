const mongoose = require("mongoose");
const { tenantPlugin } = require("../tenancy/tenantPlugin");

// One row per calendar day. `date` is stored at midnight (local server time)
// so a day's row can be looked up with a plain equality match instead of a
// range query. `openingBalance` is copied from the previous day's
// `closingBalance` at creation time so it never has to be recomputed later —
// today's closing becomes tomorrow's opening automatically the next time
// this day's row is lazily created.
const dailyCashSummarySchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
      unique: true,
      index: true,
    },

    openingBalance: {
      type: Number,
      default: 0,
    },

    totalReceive: {
      type: Number,
      default: 0,
    },

    totalPayment: {
      type: Number,
      default: 0,
    },

    closingBalance: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

dailyCashSummarySchema.plugin(tenantPlugin);
const DailyCashSummary =
  mongoose.models.DailyCashSummary ||
  mongoose.model("DailyCashSummary", dailyCashSummarySchema);

module.exports = DailyCashSummary;
