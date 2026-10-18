const { default: slugify } = require("slugify");
const TransitionCategory = require("../models/transitionCategory.model");

// The transaction categories the app books its own money movements under.
// Each payment flow files every transaction it writes under one of these, so
// there is exactly one document per category per store, created on first use
// and reused after that. They are marked isSystem: hidden from the category
// list and the Add Transaction dropdown, and closed to edit and delete, so a
// seller cannot rename one and split the reports across two categories.
const SYSTEM_CATEGORIES = {
  SALES_PAYMENT: { name: "Sales Payment", allowedType: "cash recived" },
  CUSTOMER_PAYMENT: { name: "Customer Payment Received", allowedType: "cash recived" },
  CUSTOMER_ADVANCE_PAYMENT: { name: "Customer Advance Payment", allowedType: "cash recived" },
  PURCHASE_PAYMENT: { name: "Purchase Payment", allowedType: "cash payment" },
  SUPPLIER_PAYMENT: { name: "Supplier Payment", allowedType: "cash payment" },
  PURCHASE_RETURN_REFUND: { name: "Purchase Return Refund", allowedType: "cash recived" },
};

const slugOf = (name) => slugify(name, { lower: true, strict: true });

// Find-or-create in one atomic upsert, matched by slug so casing differences in
// older rows still match and two concurrent payments cannot race two copies
// into existence. $set marks a row created before isSystem existed on its
// next use.
const getSystemCategory = (definition, session) => {
  const slug = slugOf(definition.name);
  return TransitionCategory.findOneAndUpdate(
    { slug },
    {
      $set: { isSystem: true },
      $setOnInsert: { name: definition.name, allowedType: definition.allowedType, slug },
    },
    { new: true, upsert: true, session },
  );
};

const SYSTEM_CATEGORY_SLUGS = Object.values(SYSTEM_CATEGORIES).map((c) => slugOf(c.name));

module.exports = { SYSTEM_CATEGORIES, SYSTEM_CATEGORY_SLUGS, getSystemCategory };
