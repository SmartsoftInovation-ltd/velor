const User = require("../models/user.model");

/**
 * Storefront shoppers may sign up with a mobile number alone, so `email` is
 * no longer required on users. The per-store unique email index must then
 * skip accounts without one: as a plain unique index it would count every
 * missing email as the same null, and only one phone-only shopper could exist
 * per store.
 *
 * The old index has the same name and keys but no partial filter, and MongoDB
 * refuses to create the new one over it, so it is dropped and rebuilt. Any
 * email stored as null or "" is removed before the rebuild, because the
 * partial filter ($exists) would still count those; that has to wait until
 * the old index is gone, which would itself refuse two missing emails.
 * Re-running is harmless.
 */
const NAME = "tenantId_1_email_1";
const PARTIAL = { email: { $exists: true } };

module.exports = {
  name: "018-optional-user-email",
  up: async () => {
    const collection = User.collection;
    const indexes = await collection.indexes().catch((error) => {
      if (error.codeName === "NamespaceNotFound") return null;
      throw error;
    });
    if (!indexes) return { skipped: "no users collection" };

    const existing = indexes.find((index) => index.name === NAME);
    const alreadyPartial = existing?.unique && existing.partialFilterExpression?.email?.$exists === true;
    if (existing && !alreadyPartial) await collection.dropIndex(NAME);

    const blanks = await collection.updateMany({ email: { $in: [null, ""] } }, { $unset: { email: "" } });
    if (alreadyPartial) return { blanksCleared: blanks.modifiedCount, rebuilt: false };

    await collection.createIndex({ tenantId: 1, email: 1 }, { name: NAME, unique: true, partialFilterExpression: PARTIAL });
    return { blanksCleared: blanks.modifiedCount, rebuilt: true };
  },
};
