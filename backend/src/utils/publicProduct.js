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
 * Staff keep the full document; anonymous visitors and signed-in shoppers get
 * the reduced view.
 */

// Cost figures and anything computed from them
// (a margin plus the retail price gives the cost away just the same)
const PRIVATE_FIELDS = [
  "purchasePrice",
  "profit",
  "wholesaleProfit",
  "profitMargin",
  "wholesaleProfitMargin",
  "retailProfitMarginByAmount",
  "wholesaleProfitMarginByAmount",
  "retailProfitMarginByPercentage",
  "wholesaleProfitMarginPercentage",
  "retailProfitMarginAmount",
  "retailProfitMarginPercentage",
  "wholesaleProfitMarginAmount",
  "calculatedWholesaleProfitMarginPercentage",
];

// Where a catalogue document nests another one that carries the same fields:
// a product's variants, a variant row's parent product, and the variants the
// price-range lookup joins in
const NESTED = ["variant", "product", "variantdocs"];

const stripOne = (doc) => {
  if (!doc || typeof doc !== "object") return doc;

  const clean = { ...doc };
  for (const field of PRIVATE_FIELDS) delete clean[field];

  // Nested products and variants carry their own copy of the same cost fields
  for (const key of NESTED) {
    if (Array.isArray(clean[key])) clean[key] = clean[key].map(stripOne);
    else if (clean[key]) clean[key] = stripOne(clean[key]);
  }

  return clean;
};

/**
 * Removes private fields unless the caller is a signed-in staff member.
 *
 * Takes the request rather than a boolean so every call site asks the same
 * question the same way. `req.user` is set for any valid token, a storefront
 * shopper's included, so being signed in is not enough: staff are the users
 * holding a role, the same test that decides a token's audience.
 */
const isStaff = (req) => Boolean(req?.user?.roles?.length);

const forAudience = (req, data) => {
  if (isStaff(req)) return data;
  return Array.isArray(data) ? data.map(stripOne) : stripOne(data);
};

module.exports = { forAudience, isStaff, stripOne, PRIVATE_FIELDS };
