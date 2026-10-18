const TransitionCategory = require("../models/transitionCategory.model");
const { runForTenant } = require("../tenancy/context");
const { SYSTEM_CATEGORY_SLUGS } = require("../utils/systemCategory.util");

// Marks the categories the payment flows created before isSystem existed, so
// they leave the category list and the Add Transaction dropdown straight away
// instead of on their next payment. Matched by slug, the same way the flows
// find them.
module.exports = {
  name: "011-mark-system-transaction-categories",
  up: ({ tenant }) =>
    runForTenant(tenant._id, async () => {
      const result = await TransitionCategory.updateMany(
        { slug: { $in: SYSTEM_CATEGORY_SLUGS }, isSystem: { $ne: true } },
        { $set: { isSystem: true } },
      );
      return { marked: result.modifiedCount };
    }),
};
