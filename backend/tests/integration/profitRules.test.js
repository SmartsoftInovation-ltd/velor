const mongoose = require("mongoose");
const { faker } = require("@faker-js/faker");
const { connectTestDb, clearTestDb, disconnectTestDb } = require("../helpers/db");
const { closeAppRedis } = require("../helpers/redis");
const { runForTenant } = require("../../src/tenancy/context");
const Sales = require("../../src/models/sales.model");
const Product = require("../../src/models/product.model");
const Variant = require("../../src/models/variant.model");
const SalesReturn = require("../../src/models/salesReturn.model");
const { saleProfitStages, saleLineProfitStages } = require("../../src/utils/saleProfit.util");
const { computeReturnAmounts } = require("../../src/controller/salesReturn.controller");

/**
 * The profit formula of .claude/rules/profit-calculation.md, written a second
 * time in plain JavaScript as an oracle, and compared with the one real
 * implementation (src/utils/saleProfit.util.js) over randomly generated
 * invoices. Every rule bullet that decides a number is exercised: line
 * discounts (amount/percent), invoice percent, less-taka, refunds, returned
 * units' cost, exchange lines, unexplained "return" lines, every invoice
 * status, stamped cost vs catalogue fallback, variant cost 0 as a real cost.
 */
const round2 = (n) => Math.round(n * 100) / 100;

const oracle = (sale, { products, variants, returns }) => {
  const returned = returns.flatMap((r) => r.allproduct || []);
  let grossSales = 0;
  let itemDiscount = 0;
  let buyPrice = 0;
  for (const line of sale.searchItem) {
    const status = line.salesStatus || "sale";
    const qty = line.quantity || 0;
    const returnedQty = Math.min(
      qty,
      returned
        .filter((r) => (r.variant ? String(r.variant) === String(line.variantId) : r.product && String(r.product) === String(line.productId)))
        .reduce((s, r) => s + (r.quantity || 0), 0),
    );
    const counts = status === "sale" || (status === "return" && returnedQty > 0);
    if (!counts) continue;
    const gross = (line.salesRate || 0) * qty;
    grossSales += gross;
    itemDiscount += line.discountType === "percent" ? (gross * (line.discount || 0)) / 100 : (line.discount || 0) * qty;
    // Cost: stamped on the line, else the variant's (0 is a real cost), else the product's
    const variantCost = line.variantId ? variants.get(String(line.variantId)) : undefined;
    const unitCost = line.purchasePrice ?? variantCost ?? products.get(String(line.productId)) ?? 0;
    buyPrice += (qty - returnedQty) * unitCost;
  }
  const discountAmount = ((grossSales - itemDiscount) * (sale.discountPercent || 0)) / 100 + (sale.lessTaka || 0);
  return {
    grossSales,
    itemDiscountAmount: itemDiscount,
    totalDiscountAmount: itemDiscount + discountAmount,
    buyPrice,
    profit: round2(grossSales - itemDiscount - discountAmount - (sale.return || 0) - buyPrice),
  };
};

describe("profit formula (saleProfit.util) against an independent oracle", () => {
  const tenantId = new mongoose.Types.ObjectId();
  const inTenant = (fn) => runForTenant(tenantId, fn);
  const insert = (Model, doc) => inTenant(() => Model.collection.insertOne({ tenantId, createdAt: new Date(), updatedAt: new Date(), ...doc }));

  beforeAll(connectTestDb);
  afterEach(clearTestDb);
  afterAll(async () => {
    await closeAppRedis();
    await disconnectTestDb();
  });

  const profitOf = async (saleId) => (await inTenant(() => Sales.aggregate([{ $match: { _id: saleId } }, ...saleProfitStages()])))[0];
  const linesOf = (saleId) => inTenant(() => Sales.aggregate([{ $match: { _id: saleId } }, ...saleLineProfitStages()]));

  // ------------------------------------------------------------------ catalogue
  const seedCatalogue = async () => {
    const products = new Map();
    const variants = new Map();
    const productIds = [];
    const variantIds = [];
    for (let i = 0; i < 4; i += 1) {
      const _id = new mongoose.Types.ObjectId();
      const purchasePrice = faker.number.int({ min: 50, max: 800 });
      await insert(Product, { _id, name: `P${i}`, purchasePrice });
      products.set(String(_id), purchasePrice);
      productIds.push(_id);
    }
    // one variant costs 0 (a real cost), one has no cost at all (falls back to its product)
    for (const [i, cost] of [[0, 0], [1, undefined], [2, 120]]) {
      const _id = new mongoose.Types.ObjectId();
      await insert(Variant, { _id, product: productIds[i], variantName: `V${i}`, ...(cost === undefined ? {} : { purchasePrice: cost }) });
      if (cost !== undefined) variants.set(String(_id), cost);
      variantIds.push({ _id, product: productIds[i] });
    }
    return { products, variants, productIds, variantIds };
  };

  const randomSale = (catalogue) => {
    const kind = faker.helpers.arrayElement(["none", "line", "percent", "less"]);
    const used = new Set();
    const lines = [];
    const n = faker.number.int({ min: 1, max: 4 });
    for (let i = 0; i < n; i += 1) {
      // A product appears at most once per invoice (see the BUG-050 case below)
      const useVariant = faker.datatype.boolean();
      const target = useVariant ? faker.helpers.arrayElement(catalogue.variantIds) : { _id: faker.helpers.arrayElement(catalogue.productIds) };
      const key = String(useVariant ? target._id : target._id);
      const productKey = String(useVariant ? target.product : target._id);
      if (used.has(key) || used.has(productKey)) continue;
      used.add(key);
      used.add(productKey);
      const line = {
        ...(useVariant ? { variantId: target._id, productId: target.product } : { productId: target._id }),
        quantity: faker.number.int({ min: 1, max: 6 }),
        salesRate: faker.number.int({ min: 100, max: 2000 }),
        salesStatus: faker.helpers.weightedArrayElement([
          { weight: 8, value: "sale" },
          { weight: 1, value: "exchange" },
          { weight: 1, value: "return" }, // a "return" line with no SalesReturn: never a sale
        ]),
      };
      if (kind === "line") {
        line.discountType = faker.helpers.arrayElement(["amount", "percent"]);
        line.discount = line.discountType === "amount" ? faker.number.int({ min: 1, max: 50 }) : faker.number.int({ min: 1, max: 30 });
      }
      if (faker.datatype.boolean()) line.purchasePrice = faker.number.int({ min: 10, max: 900 }); // stamped
      lines.push(line);
    }
    return {
      _id: new mongoose.Types.ObjectId(),
      invoiceNumber: `INV-${faker.string.alphanumeric(6)}`,
      date: new Date(),
      customerType: { type: "walking" },
      invoiceStatus: faker.helpers.arrayElement(["complete", "draft", "pending"]),
      discountPercent: kind === "percent" ? faker.number.int({ min: 1, max: 20 }) : 0,
      lessTaka: kind === "less" ? faker.number.int({ min: 1, max: 300 }) : 0,
      total: 99999999, // client-written; must be ignored
      return: 0,
      searchItem: lines,
    };
  };

  // Raises a sales return for part of one sold line, the way the controller does
  const addReturn = async (sale) => {
    const sold = sale.searchItem.filter((l) => (l.salesStatus || "sale") === "sale");
    if (!sold.length) return [];
    const line = faker.helpers.arrayElement(sold);
    const quantity = faker.number.int({ min: 1, max: line.quantity });
    const item = line.variantId ? { variant: line.variantId, product: null, quantity } : { product: line.productId, variant: null, quantity };
    const amounts = computeReturnAmounts(sale, [item]);
    line.salesStatus = "return"; // the controller flips the whole line
    sale.return = amounts.totalReturnAmount;
    const doc = { invoiceNumber: sale._id, allproduct: amounts.allproduct, totalReturnAmount: amounts.totalReturnAmount };
    await insert(SalesReturn, doc);
    return [doc];
  };

  it("matches the oracle on 60 random invoices (with and without sales returns)", async () => {
    faker.seed(424242);
    const catalogue = await seedCatalogue();
    const failures = [];
    for (let i = 0; i < 60; i += 1) {
      const sale = randomSale(catalogue);
      if (!sale.searchItem.length) continue;
      const returns = faker.datatype.boolean({ probability: 0.4 }) ? await addReturn(sale) : [];
      await insert(Sales, sale);
      const actual = await profitOf(sale._id);
      const expected = oracle(sale, { ...catalogue, returns });
      for (const key of Object.keys(expected)) {
        if (Math.abs((actual[key] ?? 0) - expected[key]) > 0.011) failures.push({ invoice: sale.invoiceNumber, key, expected: expected[key], actual: actual[key] });
      }
    }
    expect(failures).toEqual([]);
  });

  it("per-line profits add up to the invoice profit when nothing was returned", async () => {
    faker.seed(777);
    const catalogue = await seedCatalogue();
    for (let i = 0; i < 25; i += 1) {
      const sale = randomSale(catalogue);
      sale.searchItem.forEach((l) => (l.salesStatus = "sale"));
      if (!sale.searchItem.length) continue;
      await insert(Sales, sale);
      const invoice = await profitOf(sale._id);
      const lines = await linesOf(sale._id);
      const sum = lines.reduce((s, l) => s + l.line.profit, 0);
      expect(Math.abs(sum - invoice.profit)).toBeLessThanOrEqual(0.02 * lines.length);
    }
  });

  it("per-line profits leave the returned units out, the invoice takes the refund off: both agree", async () => {
    faker.seed(31337);
    const catalogue = await seedCatalogue();
    for (let i = 0; i < 25; i += 1) {
      const sale = randomSale(catalogue);
      sale.searchItem.forEach((l) => (l.salesStatus = "sale"));
      if (!sale.searchItem.length) continue;
      await addReturn(sale);
      await insert(Sales, sale);
      const invoice = await profitOf(sale._id);
      const lines = await linesOf(sale._id);
      const sum = lines.reduce((s, l) => s + l.line.profit, 0);
      expect(Math.abs(sum - invoice.profit)).toBeLessThanOrEqual(0.02 * (lines.length + 1));
    }
  });

  it("a variant cost of 0 is a real cost; a variant with no cost falls back to its product", async () => {
    const productId = new mongoose.Types.ObjectId();
    const freeVariant = new mongoose.Types.ObjectId();
    const unpricedVariant = new mongoose.Types.ObjectId();
    await insert(Product, { _id: productId, name: "Base", purchasePrice: 300 });
    await insert(Variant, { _id: freeVariant, product: productId, purchasePrice: 0 });
    await insert(Variant, { _id: unpricedVariant, product: productId });
    const sale = { _id: new mongoose.Types.ObjectId(), customerType: { type: "walking" }, searchItem: [
      { productId, variantId: freeVariant, quantity: 2, salesRate: 500, salesStatus: "sale" },
      { productId, variantId: unpricedVariant, quantity: 1, salesRate: 500, salesStatus: "sale" },
    ] };
    await insert(Sales, sale);
    const p = await profitOf(sale._id);
    expect(p.buyPrice).toBe(300); // 2 × 0 + 1 × 300
    expect(p.profit).toBe(1200);
  });

  it("VAT, delivery, labour and advance adjustment never reach profit", async () => {
    const productId = new mongoose.Types.ObjectId();
    await insert(Product, { _id: productId, name: "Base", purchasePrice: 100 });
    const plain = { _id: new mongoose.Types.ObjectId(), customerType: { type: "walking" }, searchItem: [{ productId, quantity: 1, salesRate: 500, salesStatus: "sale" }] };
    const loaded = { ...plain, _id: new mongoose.Types.ObjectId(), vatPercent: 15, deliveryCost: 120, labourCost: 50, customerAdvancePaymentAdjust: 200, payable: 9999 };
    await insert(Sales, plain);
    await insert(Sales, loaded);
    expect((await profitOf(loaded._id)).profit).toBe((await profitOf(plain._id)).profit);
  });

  it("rounds profit to 2 decimals per invoice", async () => {
    const productId = new mongoose.Types.ObjectId();
    await insert(Product, { _id: productId, name: "Base", purchasePrice: 0 });
    const sale = { _id: new mongoose.Types.ObjectId(), customerType: { type: "walking" }, discountPercent: 3, searchItem: [{ productId, quantity: 1, salesRate: 333.33, salesStatus: "sale" }] };
    await insert(Sales, sale);
    const { profit } = await profitOf(sale._id);
    expect(profit).toBe(Math.round(profit * 100) / 100);
    expect(profit).toBeCloseTo(333.33 * 0.97, 2);
  });

  // BUG-050: returned quantity is matched per line, not per return: when one
  // product sits on two lines of an invoice, one returned unit is taken off
  // both lines, so twice the cost leaves buyPrice
  test.failing("one returned unit lowers the buy price by one unit even when the product is on two lines [BUG-050]", async () => {
    const productId = new mongoose.Types.ObjectId();
    await insert(Product, { _id: productId, name: "Twice", purchasePrice: 100 });
    const sale = {
      _id: new mongoose.Types.ObjectId(),
      customerType: { type: "walking" },
      return: 500,
      searchItem: [
        { productId, quantity: 2, salesRate: 500, salesStatus: "return", purchasePrice: 100 },
        { productId, quantity: 2, salesRate: 500, salesStatus: "return", purchasePrice: 100 },
      ],
    };
    await insert(SalesReturn, { invoiceNumber: sale._id, allproduct: [{ product: productId, variant: null, quantity: 1 }] });
    await insert(Sales, sale);
    const p = await profitOf(sale._id);
    // 4 sold, 1 returned: 3 units still carry cost
    expect(p.buyPrice).toBe(300);
    expect(p.profit).toBe(2000 - 500 - 300);
  });
});
