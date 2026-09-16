require("dotenv").config();
require("module-alias/register");
const mongoose = require("mongoose");
const SalesReturn = require("../models/salesReturn.model");
const Counter = require("../models/counter.model");
const { env } = require("../config/env.config");
const { bumpNsVersion } = require("../utils/cache.util");

// Assigns a returnId to sales returns created before the field existed.
//
// The model's post-save hook only fires on new documents, so rows already in
// the collection have no returnId and the list would fall back to showing
// nothing for them. They are numbered oldest-first so the sequence matches the
// order the returns were actually made.
//
// The shared Counter is advanced past everything assigned here, so a return
// created after this runs continues the sequence instead of colliding with it.
async function backfillSalesReturnId({ dryRun = false } = {}) {
  const pending = await SalesReturn.find({
    $or: [{ returnId: { $exists: false } }, { returnId: null }, { returnId: "" }],
  })
    .sort({ createdAt: 1, _id: 1 })
    .select("_id createdAt");

  const total = pending.length;
  if (total === 0) return { total: 0, updated: 0, startSeq: 0, endSeq: 0 };

  // Reserve the whole block in one atomic bump so a concurrent create cannot
  // take an id from the middle of the range being assigned here.
  const counter = await Counter.findOneAndUpdate(
    { key: "SALES_RETURN" },
    { $inc: { seq: total } },
    { new: true, upsert: true },
  );

  const startSeq = counter.seq - total + 1;
  let updated = 0;

  for (let i = 0; i < total; i++) {
    const seq = startSeq + i;
    const returnId = `RET-${env.INVOICE_PREFIX}-${String(seq).padStart(2, "0")}`;

    if (dryRun) {
      console.log(`  would set ${pending[i]._id} -> ${returnId}`);
      continue;
    }

    await SalesReturn.updateOne({ _id: pending[i]._id }, { $set: { returnId } });
    updated++;
  }

  // A dry run must not keep the ids it only pretended to assign.
  if (dryRun) {
    await Counter.updateOne({ key: "SALES_RETURN" }, { $inc: { seq: -total } });
  }

  // The list endpoint caches its response, and these were plain updateOne
  // writes, so the cached copy still holds the pre-backfill rows.
  if (updated > 0) await bumpNsVersion("salesReturn");

  return { total, updated, startSeq, endSeq: startSeq + total - 1 };
}

module.exports = { backfillSalesReturnId };

if (require.main === module) {
  (async () => {
    const dryRun = process.argv.includes("--dry");

    try {
      await mongoose.connect(process.env.DATABASE_URL);
      console.log(`Connected.${dryRun ? " DRY RUN — no writes." : ""}`);

      const { total, updated, startSeq, endSeq } = await backfillSalesReturnId({
        dryRun,
      });

      if (total === 0) {
        console.log("\nNothing to do — every sales return already has a returnId.");
      } else {
        console.log(
          dryRun
            ? `\nDry run complete. ${total} return(s) would be numbered. Re-run without --dry to apply.`
            : `\nDone. total=${total} updated=${updated} range=${startSeq}..${endSeq}`,
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
