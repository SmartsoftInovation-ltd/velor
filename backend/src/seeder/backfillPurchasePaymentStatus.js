require("dotenv").config();
require("module-alias/register");
const { default: mongoose } = require("mongoose");
const Purchase = require("../models/purchase.model");
const { bumpNsVersion } = require("../utils/cache.util");

// Stamps paymentStatus on purchases saved before the field existed. The rule is
// the model's own, so this can never drift from what new writes produce:
//   0 paid -> "due", paid below payable -> "partial", paid covering it -> "paid".
//
// Uses updateOne rather than doc.save() to avoid re-running the stock and
// supplier-dues side effects that a full save would trigger. The update hook
// only reapplies the status when paid/payable are touched, so writing the
// status directly here is safe.
async function backfillPurchasePaymentStatus() {
  const purchases = await Purchase.find({}).select("paid payable paymentStatus").lean();

  let updated = 0;
  let unchanged = 0;

  for (const purchase of purchases) {
    const status = Purchase.derivePaymentStatus(purchase.paid, purchase.payable);
    if (purchase.paymentStatus === status) {
      unchanged += 1;
      continue;
    }
    await Purchase.updateOne({ _id: purchase._id }, { $set: { paymentStatus: status } });
    updated += 1;
  }

  console.log(
    `Purchase paymentStatus backfill: ${updated} updated, ${unchanged} already correct, ${purchases.length} total.`,
  );

  await bumpNsVersion("purchase");
  console.log("Bumped 'purchase' cache namespace to invalidate stale Redis entries.");
}

mongoose
  .connect(process.env.DATABASE_URL)
  .then(() => {
    console.log("Connected to MongoDB");
    return backfillPurchasePaymentStatus();
  })
  .then(() => {
    console.log("Purchase payment status backfill completed successfully.");
    return mongoose.disconnect();
  })
  .catch((err) => {
    console.error("Error backfilling purchase payment status:", err);
    process.exit(1);
  });
