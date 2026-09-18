/**
 * Strips the figures a shop keeps for itself from product data on its way to an
 * anonymous visitor.
 *
 * The catalogue endpoints serve two audiences from one route: signed-in staff
 * browsing the dashboard, and shoppers on the storefront, who send no token.
 * `purchasePrice` is what the shop paid; published alongside the retail price it
 * hands every visitor — competitors included — the store's margin on each line.
 * The derived margin virtuals give the same thing away.
 *
 * Staff keep the full document; only the un-authenticated view is reduced.
 */

// Cost figures and anything computed from them
const PRIVATE_FIELDS = [
  "purchasePrice",
  "profit",
  "wholesaleProfit",
  "profitMargin",
  "wholesaleProfitMargin",
];

const stripOne = (doc) => {
  if (!doc || typeof doc !== "object") return doc;

  const clean = { ...doc };
  for (const field of PRIVATE_FIELDS) delete clean[field];

  // Variants carry their own copy of the same cost fields
  if (Array.isArray(clean.variant)) clean.variant = clean.variant.map(stripOne);
  else if (clean.variant) clean.variant = stripOne(clean.variant);

  return clean;
};

/**
 * Removes private fields unless the caller is a signed-in staff member.
 *
 * Takes the request rather than a boolean so every call site asks the same
 * question the same way; `req.user` is set by authGuard and by guestOrAuth when
 * a token was presented, and is absent for a storefront visitor.
 */
const forAudience = (req, data) => {
  if (req?.user) return data;
  return Array.isArray(data) ? data.map(stripOne) : stripOne(data);
};

module.exports = { forAudience, stripOne, PRIVATE_FIELDS };
