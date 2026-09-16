require("dotenv").config();
require("module-alias/register");
const mongoose = require("mongoose");
const { SupplierModel } = require("../models/supplier.model");
const { bumpNsVersion } = require("../utils/cache.util");

// Seeds initialDue for suppliers created before the field existed.
//
// New suppliers get initialDue from openingDues at creation, when the two are
// the same figure. For an existing supplier that moment has passed: openingDues
// has already been moved by purchases, payments and returns, and the original
// carried-in amount was never stored. Copying the current openingDues is
// therefore an approximation, not a reconstruction — it is right for a supplier
// with no transactions yet, and a starting point to correct by hand otherwise.
// The edit form exposes initialDue precisely so it can be fixed.
async function backfillSupplierInitialDue({ dryRun = false } = {}) {
  const pending = await SupplierModel.find({
    $or: [{ initialDue: { $exists: false } }, { initialDue: null }],
  }).select("_id supplierName openingDues");

  const total = pending.length;
  let updated = 0;

  for (const supplier of pending) {
    const value = Number(supplier.openingDues || 0);

    if (dryRun) {
      console.log(
        `  would set ${supplier.supplierName || supplier._id} -> initialDue=${value}`,
      );
      continue;
    }

    await SupplierModel.updateOne(
      { _id: supplier._id },
      { $set: { initialDue: value } },
    );
    updated++;
  }

  // The supplier list endpoint caches its response, and these were plain
  // updateOne writes, so the cached copy still holds the pre-backfill rows.
  if (updated > 0) await bumpNsVersion("supplier");

  return { total, updated };
}

module.exports = { backfillSupplierInitialDue };

if (require.main === module) {
  (async () => {
    const dryRun = process.argv.includes("--dry");

    try {
      await mongoose.connect(process.env.DATABASE_URL);
      console.log(`Connected.${dryRun ? " DRY RUN — no writes." : ""}`);

      const { total, updated } = await backfillSupplierInitialDue({ dryRun });

      if (total === 0) {
        console.log("\nNothing to do — every supplier already has an initialDue.");
      } else {
        console.log(
          dryRun
            ? `\nDry run complete. ${total} supplier(s) would be seeded. Re-run without --dry to apply.`
            : `\nDone. total=${total} updated=${updated}`,
        );
      }
    } catch (err) {
      console.error("Backfill failed:", err.message);
      process.exitCode = 1;
    } finally {
      await mongoose.disconnect();
    }
  })();
}
