const Sales = require("../models/sales.model");
const { runForTenant } = require("../tenancy/context");
const { bumpNsVersion } = require("../utils/cache.util");
const { stampPurchasePrices } = require("../utils/saleCost.util");

// Stamps the catalogue's current purchasePrice onto the lines of sales saved
// before lines carried their own cost. The cost those goods were really
// bought at is no longer known, so today's price is the best available — but
// from here on a new purchase can no longer move the profit of these invoices.
module.exports = {
  name: "008-backfill-sale-purchase-price",
  up: ({ tenant }) =>
    runForTenant(tenant._id, async () => {
      const sales = await Sales.find({ searchItem: { $elemMatch: { purchasePrice: { $exists: false } } } })
        .select("searchItem")
        .lean();

      for (const sale of sales) {
        // Lines already stamped keep their cost; only the bare ones are filled
        const searchItem = await stampPurchasePrices(sale.searchItem, null, sale.searchItem);
        await Sales.updateOne({ _id: sale._id }, { $set: { searchItem } }, { timestamps: false });
      }

      // Cached profit reports and dashboard widgets were built from live prices
      if (sales.length) await bumpNsVersion("sales");

      return { stamped: sales.length };
    }),
};
