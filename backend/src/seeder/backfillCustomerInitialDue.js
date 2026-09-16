require("dotenv").config();
require("module-alias/register");
const mongoose = require("mongoose");
const { customerModel } = require("../models/customer.model");
const { bumpNsVersion } = require("../utils/cache.util");

// Seeds initialDue for customers created before the field existed.
//
// New customers get initialDue from openingDues at creation, when the two are
// the same figure. For an existing customer that moment has passed: openingDues
// has already been moved by sales, payments and returns, and the original
// carried-in amount was never stored. Copying the current openingDues is
// therefore an approximation, not a reconstruction — it is right for a customer
// with no transactions yet, and a starting point to correct by hand otherwise.
// The edit form exposes initialDue precisely so it can be fixed.
async function backfillCustomerInitialDue({ dryRun = false } = {}) {
  const pending = await customerModel
    .find({ $or: [{ initialDue: { $exists: false } }, { initialDue: null }] })
    .select("_id fullName openingDues");

  const total = pending.length;
  let updated = 0;

  for (const customer of pending) {
    const value = Number(customer.openingDues || 0);

    if (dryRun) {
      console.log(`  would set ${customer.fullName || customer._id} -> initialDue=${value}`);
      continue;
    }

    await customerModel.updateOne(
      { _id: customer._id },
      { $set: { initialDue: value } },
    );
    updated++;
  }

  // The customer list endpoint caches its response, and these were plain
  // updateOne writes, so the cached copy still holds the pre-backfill rows.
  if (updated > 0) await bumpNsVersion("customer");

  return { total, updated };
}

module.exports = { backfillCustomerInitialDue };

if (require.main === module) {
  (async () => {
    const dryRun = process.argv.includes("--dry");

    try {
      await mongoose.connect(process.env.DATABASE_URL);
      console.log(`Connected.${dryRun ? " DRY RUN — no writes." : ""}`);

      const { total, updated } = await backfillCustomerInitialDue({ dryRun });

      if (total === 0) {
        console.log("\nNothing to do — every customer already has an initialDue.");
      } else {
        console.log(
          dryRun
            ? `\nDry run complete. ${total} customer(s) would be seeded. Re-run without --dry to apply.`
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
