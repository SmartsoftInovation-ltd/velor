const Sales = require("../models/sales.model");
const { runForTenant } = require("../tenancy/context");
const { bumpNsVersion } = require("../utils/cache.util");

// Sales saved before `createdBy` existed only recorded `discountGivenBy`: the
// user who created the sale, or whoever edited it last. That is the best
// record of the seller there is, so it is copied across once — from here on
// an edit moves discountGivenBy but leaves createdBy alone.
module.exports = {
  name: "009-backfill-sale-created-by",
  up: ({ tenant }) =>
    runForTenant(tenant._id, async () => {
      const result = await Sales.updateMany(
        { createdBy: null, discountGivenBy: { $ne: null } },
        [{ $set: { createdBy: "$discountGivenBy" } }],
        { timestamps: false },
      );

      if (result.modifiedCount) await bumpNsVersion("sales");

      return { assigned: result.modifiedCount };
    }),
};
