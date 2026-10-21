const mongoose = require("mongoose");
const { expandBracketKeys } = require("../../src/utils/parseFormData.util");
const { forAudience, stripOne, PRIVATE_FIELDS } = require("../../src/utils/publicProduct");
const { computeReturnAmounts } = require("../../src/controller/salesReturn.controller");

describe("expandBracketKeys (multipart field names → nested objects)", () => {
  it("builds nested objects and arrays from bracketed keys", () => {
    expect(
      expandBracketKeys({
        name: "Shirt",
        "metaKeywords[0]": "a",
        "metaKeywords[1]": "b",
        "dimensions[width]": "12",
        "seo[ogImage][url]": "https://x",
        "variants[0][color]": "red",
        "variants[1][color]": "blue",
      }),
    ).toEqual({
      name: "Shirt",
      metaKeywords: ["a", "b"],
      dimensions: { width: "12" },
      seo: { ogImage: { url: "https://x" } },
      variants: [{ color: "red" }, { color: "blue" }],
    });
  });

  it("handles an empty or missing body", () => {
    expect(expandBracketKeys()).toEqual({});
    expect(expandBracketKeys({})).toEqual({});
  });

  // BUG-065: a field named "__proto__[x]" or "constructor[prototype][x]" walks
  // into Object.prototype and writes there — prototype pollution of the whole
  // server process (every tenant), reachable by any staff member who can
  // create a product, variant or employee
  it.each([["__proto__[pollutedA]"], ["constructor[prototype][pollutedA]"]])(
    "never writes outside the result object (%s) [BUG-065]",
    (key) => {
      try {
        expandBracketKeys({ [key]: "yes" });
        expect({}.pollutedA).toBeUndefined();
      } finally {
        delete Object.prototype.pollutedA;
      }
    },
  );
});

describe("publicProduct.forAudience", () => {
  const doc = { name: "Shirt", purchasePrice: 400, retailPrice: 900, profit: 500, variant: [{ purchasePrice: 300, retailPrice: 500 }] };

  it("strips cost figures (and the variants' copies) for an anonymous caller", () => {
    const clean = forAudience({}, doc);
    for (const field of PRIVATE_FIELDS) expect(clean).not.toHaveProperty(field);
    expect(clean.variant[0]).not.toHaveProperty("purchasePrice");
    expect(clean.retailPrice).toBe(900);
    expect(doc.purchasePrice).toBe(400); // the input is not mutated
  });

  it("keeps everything for signed-in staff, and handles arrays and non-objects", () => {
    expect(forAudience({ user: { _id: 1, roles: ["role-id"] } }, doc)).toBe(doc);
    // A signed-in shopper holds no role: same view as an anonymous visitor
    expect(forAudience({ user: { _id: 2, roles: [] } }, doc)).not.toHaveProperty("purchasePrice");
    expect(forAudience({}, [doc, doc]).every((d) => d.purchasePrice === undefined)).toBe(true);
    expect(stripOne(null)).toBeNull();
    expect(stripOne({ variant: { purchasePrice: 1 } }).variant).toEqual({});
  });
});

describe("computeReturnAmounts (sales-return refund)", () => {
  const productId = new mongoose.Types.ObjectId();
  const sale = (overrides = {}) => ({
    searchItem: [{ productId, quantity: 4, salesRate: 1000, salesStatus: "sale" }],
    discountPercent: 0,
    lessTaka: 0,
    ...overrides,
  });
  const item = (quantity, extra = {}) => ({ product: productId, quantity, ...extra });

  it("refunds the units at the sale's own price, ignoring the requested price", () => {
    const r = computeReturnAmounts(sale(), [item(2, { unitPrice: 9999 })]);
    expect(r).toMatchObject({ grossReturnAmount: 2000, totalReturnAmount: 2000 });
    expect(r.allproduct[0]).toMatchObject({ unitPrice: 1000, subtotal: 2000 });
  });

  it.each([
    ["an amount discount per unit", { discount: 100, discountType: "amount" }, 1800],
    ["a percent discount", { discount: 10, discountType: "percent" }, 1800],
  ])("takes %s off the refunded units", (_n, lineDiscount, expected) => {
    const s = sale({ searchItem: [{ productId, quantity: 4, salesRate: 1000, salesStatus: "sale", ...lineDiscount }] });
    expect(computeReturnAmounts(s, [item(2)]).totalReturnAmount).toBe(expected);
  });

  it("takes the invoice percent and the units' share of less-taka off", () => {
    const r = computeReturnAmounts(sale({ discountPercent: 10, lessTaka: 400 }), [item(1)]);
    // 1000 − 10% − 400/4
    expect(r).toMatchObject({ discountAmount: 100, lessTakaShare: 100, totalReturnAmount: 800 });
  });

  it("counts lines already flipped to 'return' when sharing less-taka, ignores exchange lines", () => {
    const s = sale({
      lessTaka: 300,
      searchItem: [
        { productId, quantity: 2, salesRate: 1000, salesStatus: "return" },
        { productId: new mongoose.Types.ObjectId(), quantity: 1, salesRate: 50, salesStatus: "sale" },
        { productId: new mongoose.Types.ObjectId(), quantity: 7, salesRate: 50, salesStatus: "exchange" },
      ],
    });
    expect(computeReturnAmounts(s, [item(1)]).lessTakaShare).toBe(100);
  });

  it("never returns a negative refund, and rounds to paisa", () => {
    expect(computeReturnAmounts(sale({ lessTaka: 999999 }), [item(1)]).totalReturnAmount).toBe(0);
    const r = computeReturnAmounts(sale({ searchItem: [{ productId, quantity: 3, salesRate: 333.333, salesStatus: "sale" }] }), [item(1)]);
    expect(r.totalReturnAmount).toBe(333.33);
  });

  it("matches a variant line by variant id", () => {
    const variantId = new mongoose.Types.ObjectId();
    const s = sale({ searchItem: [{ productId, variantId, quantity: 2, salesRate: 700, salesStatus: "sale" }] });
    expect(computeReturnAmounts(s, [{ variant: variantId, quantity: 1 }]).totalReturnAmount).toBe(700);
  });
});
