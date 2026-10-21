const Coupon = require("../models/coupon.model");
const { customError } = require("../lib/CustomError");
const { statusCodes } = require("../constant/constant");

/**
 * Take one use of a coupon. The usage limit is re-checked inside the same
 * atomic update that counts the use, so parallel checkouts cannot all pass a
 * read of `usedCount` that is already stale. A coupon with no limit always
 * matches.
 */
const claimCouponUse = async (couponId) => {
  const claimed = await Coupon.findOneAndUpdate(
    {
      _id: couponId,
      $expr: {
        $or: [
          { $eq: [{ $ifNull: ["$usageLimit", null] }, null] },
          { $lt: [{ $ifNull: ["$usedCount", 0] }, "$usageLimit"] },
        ],
      },
    },
    { $inc: { usedCount: 1 } },
  );
  if (!claimed) {
    throw new customError("This coupon has already been fully used", statusCodes.BAD_REQUEST);
  }
};

// Give back a use taken by claimCouponUse, for an order that was not placed
const releaseCouponUse = (couponId) =>
  Coupon.updateOne({ _id: couponId, usedCount: { $gt: 0 } }, { $inc: { usedCount: -1 } });

module.exports = { claimCouponUse, releaseCouponUse };
