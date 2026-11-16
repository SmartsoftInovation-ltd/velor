const User = require("../models/user.model");

/**
 * Stamps `accountType` on every user saved before the field existed, so
 * dashboard and storefront sign-in no longer infer it from roles.
 *
 *   - holds a role                      → staff
 *   - no role, but added by a staff user → staff (created in the dashboard and
 *     never given a role; it must not work on the storefront)
 *   - everything else                   → shopper (storefront sign-ups)
 *
 * Runs across every store at once: the type depends only on the document.
 * Re-running is harmless, it touches only users without the field.
 */
const UNSET = { accountType: { $exists: false } };

module.exports = {
  name: "019-user-account-type",
  up: async () => {
    const collection = User.collection;
    const staff = await collection.updateMany(
      { ...UNSET, $or: [{ "roles.0": { $exists: true } }, { createdBy: { $type: "objectId" } }] },
      { $set: { accountType: "staff" } },
    );
    const shoppers = await collection.updateMany(UNSET, { $set: { accountType: "shopper" } });
    return { staff: staff.modifiedCount, shoppers: shoppers.modifiedCount };
  },
};
