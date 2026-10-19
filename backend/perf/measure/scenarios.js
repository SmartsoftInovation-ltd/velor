/**
 * Scenario catalogue for MODE: measure. Worst-case tenant = megamart (biggest), ids from
 * seed-stats.json plus a few looked up once from the perf DB (cached in raw/context.json).
 *
 * Each scenario: { id, method, url, body, scenario, rf, cache?, runs?, before?, beforeEach? }
 * url is relative to /api/v1.
 */
const fs = require("fs");
const path = require("path");

const BACKEND = path.join(__dirname, "..", "..");
const OUT_DIR = path.join(BACKEND, "reports", "phase2", "measure");
const RAW_DIR = path.join(OUT_DIR, "raw");
const SEED_STATS = path.join(BACKEND, "reports", "phase2", "seed-stats.json");

// Fixed "now" of the seed = today. Ranges the UI allows: the date pickers are free, the widest real one is 2 years.
const END = "2026-10-19T23:59:59.999Z";
const RANGES = {
  "30d": { startDate: "2026-09-20T00:00:00.000Z", endDate: END },
  "1y": { startDate: "2025-10-20T00:00:00.000Z", endDate: END },
  "2y": { startDate: "2024-10-19T00:00:00.000Z", endDate: END },
};

const buildContext = async (mongoose) => {
  const file = path.join(RAW_DIR, "context.json");
  const stats = JSON.parse(fs.readFileSync(SEED_STATS, "utf8"));
  const big = stats.worstCase.biggestTenant;
  const wc = stats.worstCase.perTenant[big.slug];
  let ctx;
  if (fs.existsSync(file)) {
    ctx = JSON.parse(fs.readFileSync(file, "utf8"));
  } else {
    const { ObjectId } = mongoose.mongo;
    const db = mongoose.connection.db;
    const tid = new ObjectId(big.tenantId);
    const owner = await db.collection("users").findOne({ tenantId: tid, email: big.ownerEmail }, { projection: { _id: 1, tokenVersion: 1 } });
    const topProduct = await db.collection("products").find({ tenantId: tid }).sort({ totalSales: -1 }).limit(1).project({ _id: 1, name: 1, slug: 1 }).next();
    // product with the most variants among top sellers (variant ledger worst case)
    const topVariantAgg = await db.collection("sales").aggregate([
      { $match: { tenantId: tid, date: { $gte: new Date("2026-07-01") } } },
      { $unwind: "$searchItem" },
      { $match: { "searchItem.variantId": { $ne: null } } },
      { $group: { _id: { v: "$searchItem.variantId", p: "$searchItem.productId" }, n: { $sum: 1 } } },
      { $sort: { n: -1 } },
      { $limit: 1 },
    ], { allowDiskUse: true }).next();
    const topAccount = await db.collection("cratetransactions").aggregate([
      { $match: { tenantId: tid } },
      { $group: { _id: "$account", n: { $sum: 1 } } },
      { $sort: { n: -1 } },
      { $limit: 1 },
    ], { allowDiskUse: true }).next();
    const topSalesman = await db.collection("sales").aggregate([
      { $match: { tenantId: tid } },
      { $group: { _id: "$salesMen", n: { $sum: 1 } } },
      { $sort: { n: -1 } },
      { $limit: 1 },
    ], { allowDiskUse: true }).next();
    const topSubcategory = await db.collection("products").aggregate([
      { $match: { tenantId: tid } },
      { $group: { _id: "$subcategory", n: { $sum: 1 } } },
      { $sort: { n: -1 } },
      { $limit: 1 },
    ]).next();
    const sale = await db.collection("sales").find({ tenantId: tid }).sort({ _id: -1 }).limit(1).project({ _id: 1, invoiceNumber: 1 }).next();
    const order = await db.collection("orders").find({ tenantId: tid }).sort({ _id: -1 }).limit(1).project({ _id: 1, invoiceId: 1 }).next();
    const purchase = await db.collection("purchases").find({ tenantId: tid }).sort({ _id: -1 }).limit(1).project({ _id: 1 }).next();
    const counts = {};
    for (const c of ["sales", "products", "variants", "customers", "orders", "purchases", "cratetransactions", "stockadjusts", "auditlogs", "users", "salesreturns", "customerpaymentreciveds", "supplierduepayments", "purchasereturns"]) {
      counts[c] = await db.collection(c).countDocuments({ tenantId: tid });
    }
    // Lines for write scenarios: variants with stock, of distinct products
    const lineVariants = await db.collection("variants").find({ tenantId: tid, stockVariant: { $gte: 45 } }).limit(60).project({ _id: 1, product: 1, retailPrice: 1, sellingPrice: 1 }).toArray();
    const lineProducts = await db.collection("products").find({ tenantId: tid, stock: { $gt: 100 } }).limit(60).project({ _id: 1, retailPrice: 1 }).toArray();
    const account = await db.collection("accounts").findOne({ tenantId: tid });
    ctx = {
      tenantId: big.tenantId,
      tenantSlug: big.slug,
      ownerId: String(owner._id),
      ownerTv: owner.tokenVersion || 0,
      topCustomer: wc.topCustomer.id,
      topSupplier: wc.topSupplier.id,
      biggestCategory: wc.biggestCategory.id,
      biggestBrand: wc.biggestBrand.id,
      topProduct: String(topProduct._id),
      topProductSlug: topProduct.slug,
      topVariant: topVariantAgg ? String(topVariantAgg._id.v) : null,
      topVariantProduct: topVariantAgg ? String(topVariantAgg._id.p) : null,
      topAccount: topAccount ? String(topAccount._id) : null,
      topSalesman: topSalesman ? String(topSalesman._id) : null,
      topSubcategory: topSubcategory ? String(topSubcategory._id) : null,
      lastSale: String(sale._id),
      lastInvoice: sale.invoiceNumber,
      lastOrder: String(order._id),
      lastPurchase: String(purchase._id),
      account: account ? String(account._id) : null,
      counts,
      lineVariants: lineVariants.map((v) => ({ id: String(v._id), product: String(v.product), price: v.retailPrice || v.sellingPrice || 100 })),
      lineProducts: lineProducts.map((p) => ({ id: String(p._id), price: p.retailPrice || 100 })),
    };
    fs.mkdirSync(RAW_DIR, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(ctx, null, 1));
  }
  const jwt = require("jsonwebtoken");
  ctx.token = jwt.sign({ id: ctx.ownerId, sub: ctx.ownerId, tid: ctx.tenantId, tv: ctx.ownerTv, aud: "staff" }, process.env.ACCESS_TOKEN_SECRET || "x", { expiresIn: "6h" });
  return ctx;
};

const lastPage = (n, limit) => Math.max(1, Math.ceil(n / limit));

/** All scenarios, as a function of the context. */
const scenarios = (ctx) => {
  const S = [];
  const add = (s) => S.push(s);
  const c = ctx.counts || {};

  // ---------------- sales: list + POS search (RF-03, RF-07, RF-08) ----------------
  add({ id: "sales-list-p1", method: "GET", url: "/sales/get-sales?page=1&limit=50", rf: "RF-03", scenario: "paged list page 1, limit 50" });
  add({ id: "sales-list-p100", method: "GET", url: "/sales/get-sales?page=100&limit=50", rf: "RF-07", scenario: "page 100, limit 50" });
  add({ id: "sales-list-p1000", method: "GET", url: "/sales/get-sales?page=1000&limit=50", rf: "RF-07", scenario: "page 1000, limit 50" });
  add({ id: "sales-list-last", method: "GET", url: `/sales/get-sales?page=${lastPage(c.sales, 100)}&limit=100`, rf: "RF-07", scenario: `deepest page ${lastPage(c.sales, 100)}, limit 100 (max)` });
  add({ id: "sales-list-search", method: "GET", url: "/sales/get-sales?page=1&limit=50&search=1", rf: "RF-08", scenario: "invoice search '1' (broadest), page 1" });
  add({ id: "sales-list-all", method: "GET", url: "/sales/get-sales", rf: "RF-03", scenario: "no page/limit: whole tenant (1.10M sales) + 5 populates" });
  add({ id: "sales-pos-search-a", method: "GET", url: "/sales/get-sales-products?q=a", rf: "RF-08", scenario: "POS picker q=a (1 char)" });
  add({ id: "sales-pos-search-sh", method: "GET", url: "/sales/get-sales-products?q=sh", rf: "RF-08", scenario: "POS picker q=sh (2 chars)" });

  // ---------------- sales reports (RF-01, RF-02, RF-07) ----------------
  for (const [r, range] of Object.entries(RANGES)) {
    add({ id: `rep-sales-invoice-${r}`, method: "POST", url: "/report/sales-invoice?page=1&limit=50", body: range, rf: "RF-01", scenario: `range ${r}, page 1` });
    add({ id: `rep-invoice-profit-${r}`, method: "POST", url: "/report/invoice-profit?page=1&limit=50", body: range, rf: "RF-02", scenario: `range ${r}, page 1` });
    add({ id: `rep-product-profit-${r}`, method: "POST", url: "/report/product-profit?page=1&limit=50", body: range, rf: "RF-02", scenario: `range ${r}, page 1` });
  }
  const s2 = RANGES["2y"];
  add({ id: "rep-sales-invoice-2y-p100", method: "POST", url: "/report/sales-invoice?page=100&limit=50", body: s2, rf: "RF-07", scenario: "range 2y, page 100" });
  add({ id: "rep-sales-invoice-2y-p1000", method: "POST", url: "/report/sales-invoice?page=1000&limit=50", body: s2, rf: "RF-07", scenario: "range 2y, page 1000" });
  add({ id: "rep-sales-invoice-2y-last", method: "POST", url: `/report/sales-invoice?page=${lastPage(c.sales, 200)}&limit=200`, body: s2, rf: "RF-07", scenario: `range 2y, deepest page ${lastPage(c.sales, 200)} limit 200` });
  add({ id: "rep-invoice-profit-2y-last", method: "POST", url: `/report/invoice-profit?page=${lastPage(c.sales, 200)}&limit=200`, body: s2, rf: "RF-07", scenario: `range 2y, deepest page limit 200` });
  add({ id: "rep-sales-product-2y", method: "POST", url: "/report/sales-product?page=1&limit=50", body: s2, rf: "RF-01", scenario: "range 2y" });
  add({ id: "rep-sales-summary-2y", method: "POST", url: "/report/sales-summary?page=1&limit=50", body: s2, rf: "RF-01", scenario: "range 2y" });
  add({ id: "rep-sales-summary-30d", method: "POST", url: "/report/sales-summary?page=1&limit=50", body: RANGES["30d"], rf: "RF-01", scenario: "range 30d" });
  add({ id: "rep-customer-sales-invoice-2y", method: "POST", url: "/report/customer-sales-invoice?page=1&limit=50", body: { ...s2, customerId: ctx.topCustomer }, rf: "RF-01", scenario: "2y, top customer (21k invoices)" });
  add({ id: "rep-customer-invoice-profit-2y", method: "POST", url: "/report/customer-invoice-profit?page=1&limit=50", body: s2, rf: "RF-02", scenario: "2y, all customers" });
  add({ id: "rep-customer-invoice-profit-topcust", method: "POST", url: "/report/customer-invoice-profit?page=1&limit=50", body: { ...s2, customerId: ctx.topCustomer }, rf: "RF-02", scenario: "2y, top customer" });
  add({ id: "rep-top-sales-product-2y", method: "POST", url: "/report/top-sales-product?page=1&limit=50", body: { ...s2, top: 50 }, rf: "RF-02", scenario: "2y, top 50" });
  add({ id: "rep-top-customer-2y", method: "POST", url: "/report/top-customer?page=1&limit=50", body: { ...s2, top: 50 }, rf: "RF-02", scenario: "2y, top 50" });
  add({ id: "rep-top-salesman-2y", method: "POST", url: "/report/top-salesman?page=1&limit=50", body: { ...s2, top: 50 }, rf: "RF-01", scenario: "2y" });
  add({ id: "rep-top-user-2y", method: "POST", url: "/report/top-user?page=1&limit=50", body: { ...s2, top: 50 }, rf: "RF-01", scenario: "2y" });
  add({ id: "rep-user-sales-product-2y", method: "POST", url: "/report/user-sales-product?page=1&limit=50", body: s2, rf: "RF-01", scenario: "2y" });
  add({ id: "rep-user-sales-invoice-2y", method: "POST", url: "/report/user-sales-invoice?page=1&limit=50", body: s2, rf: "RF-01", scenario: "2y" });
  add({ id: "rep-salesman-sales-product-2y", method: "POST", url: "/report/salesman-sales-product?page=1&limit=50", body: { ...s2, salesMenId: ctx.topSalesman }, rf: "RF-01", scenario: "2y, top salesman" });
  add({ id: "rep-salesman-sales-invoice-2y", method: "POST", url: "/report/salesman-sales-invoice?page=1&limit=50", body: { ...s2, salesMenId: ctx.topSalesman }, rf: "RF-01", scenario: "2y, top salesman" });
  add({ id: "rep-upcoming-delivery-2y", method: "POST", url: "/report/upcoming-delivery-order?page=1&limit=50", body: s2, rf: "RF-01", scenario: "2y" });
  add({ id: "rep-product-sales-return-2y", method: "POST", url: "/report/product-sales-return?page=1&limit=50", body: s2, rf: "RF-01", scenario: "2y" });
  add({ id: "rep-product-sales-return-summary-2y", method: "POST", url: "/report/product-sales-return-summary?page=1&limit=50", body: s2, rf: "RF-01", scenario: "2y" });
  add({ id: "rep-push-sales-product-2y", method: "POST", url: "/report/push-sales-product?page=1&limit=50", body: { ...s2, top: 50 }, rf: "RF-16", scenario: "2y" });
  add({ id: "rep-customer-sales-product-2y", method: "POST", url: "/report/customer-sales-product?page=1&limit=50", body: { ...s2, customerId: ctx.topCustomer }, rf: "RF-01", scenario: "2y, top customer" });
  add({ id: "rep-customer-sales-summary-2y", method: "POST", url: "/report/customer-sales-summary?page=1&limit=50", body: { ...s2, customerId: ctx.topCustomer }, rf: "RF-01", scenario: "2y, top customer" });
  add({ id: "rep-product-ledger-product", method: "POST", url: "/report/product-ledger", body: { productId: ctx.topVariantProduct || ctx.topProduct }, rf: "RF-16", scenario: "product of the most-sold variant, no dates (all history)" });
  add({ id: "rep-product-ledger-variant", method: "POST", url: "/report/product-ledger", body: { variantId: ctx.topVariant }, rf: "RF-16", scenario: "top-selling variant, no dates" });
  add({ id: "rep-ledger-items-a", method: "GET", url: "/report/ledger-items?search=a", rf: "RF-08", scenario: "search=a" });
  add({ id: "rep-sales-customers", method: "GET", url: "/report/sales/customers", rf: "RF-13", scenario: "customer picker (distinct over sales)" });
  add({ id: "rep-sales-salesmen", method: "GET", url: "/report/sales/salesmen", rf: "RF-13", scenario: "salesman picker" });
  add({ id: "rep-customer-customers", method: "GET", url: "/report/customer/customers", rf: "RF-13", scenario: "customer report picker" });

  // ---------------- stock / product reports ----------------
  add({ id: "rep-stock", method: "POST", url: "/report/stock?page=1&limit=50", body: {}, rf: "RF-08", scenario: "no filters" });
  add({ id: "rep-stock-search", method: "POST", url: "/report/stock?page=1&limit=50", body: { search: "a" }, rf: "RF-08", scenario: "search=a" });
  add({ id: "rep-stock-details", method: "POST", url: "/report/stock-details?page=1&limit=50", body: {}, rf: "RF-08", scenario: "no filters" });
  add({ id: "rep-size-color-stock", method: "POST", url: "/report/size-color-stock?page=1&limit=50", body: {}, rf: "RF-07", scenario: "no filters" });
  add({ id: "rep-stock-adjustment-2y", method: "POST", url: "/report/stock-adjustment?page=1&limit=50", body: s2, rf: "RF-07", scenario: "2y" });
  add({ id: "rep-low-stock", method: "POST", url: "/report/low-stock?page=1&limit=50", body: {}, rf: "RF-18", scenario: "no filters" });

  // ---------------- purchase / supplier reports ----------------
  add({ id: "rep-purchase-invoice-2y", method: "POST", url: "/report/purchase-invoice?page=1&limit=50", body: s2, rf: "RF-07", scenario: "2y" });
  add({ id: "rep-purchase-product-2y", method: "POST", url: "/report/purchase-product?page=1&limit=50", body: s2, rf: "RF-07", scenario: "2y" });
  add({ id: "rep-purchase-summary-2y", method: "POST", url: "/report/purchase-summary?page=1&limit=50", body: s2, rf: "RF-07", scenario: "2y" });
  add({ id: "rep-purchase-return-2y", method: "POST", url: "/report/purchase-return?page=1&limit=50", body: s2, rf: "RF-07", scenario: "2y" });
  add({ id: "rep-supplier-purchase-invoice-2y", method: "POST", url: "/report/supplier-purchase-invoice?page=1&limit=50", body: { ...s2, supplierId: ctx.topSupplier }, rf: "RF-07", scenario: "2y, top supplier" });
  add({ id: "rep-supplier-ledger-2y", method: "POST", url: "/report/supplier-ledger?page=1&limit=50", body: { ...s2, supplierId: ctx.topSupplier }, rf: "RF-07", scenario: "2y, top supplier" });
  add({ id: "rep-supplier-balance-summary", method: "POST", url: "/report/supplier-balance-summary?page=1&limit=50", body: {}, rf: "RF-07", scenario: "all suppliers, all time" });
  add({ id: "rep-supplier-dues", method: "POST", url: "/report/supplier-dues?page=1&limit=50", body: {}, rf: "RF-07", scenario: "all suppliers" });
  add({ id: "rep-supplier-payment-2y", method: "POST", url: "/report/supplier-payment?page=1&limit=50", body: s2, rf: "RF-07", scenario: "2y" });
  add({ id: "rep-purchase-suppliers", method: "GET", url: "/report/purchase/suppliers", rf: "RF-13", scenario: "supplier picker (distinct over purchases)" });

  // ---------------- cash ledger (RF-09) ----------------
  add({ id: "rep-transaction-report-2y", method: "POST", url: "/report/transaction-report?page=1&limit=50", body: s2, rf: "RF-09", scenario: "2y, no account filter" });
  add({ id: "rep-transaction-report-2y-last", method: "POST", url: `/report/transaction-report?page=${lastPage(c.cratetransactions, 200)}&limit=200`, body: s2, rf: "RF-07", scenario: "2y, deepest page limit 200" });
  add({ id: "rep-transaction-summary-2y", method: "POST", url: "/report/transaction-summary?page=1&limit=50", body: s2, rf: "RF-09", scenario: "2y" });
  add({ id: "rep-all-transaction-summary-2y", method: "POST", url: "/report/all-transaction-summary?page=1&limit=50", body: s2, rf: "RF-09", scenario: "2y" });
  add({ id: "rep-accounts-ledger-2y", method: "POST", url: "/report/accounts-ledger?page=1&limit=50", body: { ...s2, accountId: ctx.topAccount }, rf: "RF-09", scenario: "2y, busiest account" });
  add({ id: "rep-account-day-transaction-2y", method: "POST", url: "/report/account-day-transaction?page=1&limit=50", body: { ...s2, accountId: ctx.topAccount }, rf: "RF-09", scenario: "2y, busiest account" });
  add({ id: "rep-account-transaction-summary-2y", method: "POST", url: "/report/account-transaction-summary", body: s2, rf: "RF-09", scenario: "2y" });
  add({ id: "rep-account-balance", method: "POST", url: "/report/account-balance", body: { asOfDate: END }, rf: "RF-09", scenario: "as of today" });
  add({ id: "rep-fund-handover-2y", method: "POST", url: "/report/fund-handover?page=1&limit=50", body: s2, rf: "RF-09", scenario: "2y" });
  add({ id: "inv-getallaccounts", method: "GET", url: "/invoice/getallaccounts", rf: "RF-06", scenario: "account dropdown" });
  add({ id: "inv-transaction-category", method: "GET", url: "/invoice/transaction-category", rf: "RF-06", scenario: "category dropdown" });
  add({ id: "inv-transaction-report-2y", method: "POST", url: "/invoice/transaction-report", body: s2, rf: "RF-06", scenario: "2y" });
  add({ id: "inv-cash-ledger-2y", method: "POST", url: "/invoice/cash-ledger-report?page=1&limit=50", body: s2, rf: "RF-09", scenario: "2y" });
  add({ id: "inv-invoicewise-report", method: "POST", url: "/invoice/invoicewise-report?page=1&limit=50", body: s2, rf: "RF-12", scenario: "2y orders" });
  add({ id: "inv-order-status", method: "POST", url: "/invoice/order-status", body: s2, rf: "RF-12", scenario: "2y orders" });
  add({ id: "inv-followup-report", method: "POST", url: "/invoice/followup-report", body: s2, rf: "RF-12", scenario: "2y orders, 6 populates" });
  add({ id: "inv-overall-stock", method: "POST", url: "/invoice/overallStock", body: {}, rf: "RF-18", scenario: "no filters" });
  add({ id: "txn-get-all-p1", method: "GET", url: "/transaction/get-alltransaction?page=1&limit=50", rf: "RF-07", scenario: "page 1" });
  add({ id: "txn-get-all-last", method: "GET", url: `/transaction/get-alltransaction?page=${lastPage(c.cratetransactions, 50)}&limit=50`, rf: "RF-07", scenario: "deepest page" });

  // ---------------- customers (RF-04) ----------------
  add({ id: "rep-customer-due-list", method: "POST", url: "/report/customer-due-list?page=1&limit=50", body: {}, rf: "RF-04", scenario: "no filter, all customers (330k)" });
  add({ id: "rep-customer-balance-summary", method: "POST", url: "/report/customer-balance-summary?page=1&limit=50", body: {}, rf: "RF-04", scenario: "no filter, all customers" });
  add({ id: "rep-customer-balance-summary-one", method: "POST", url: "/report/customer-balance-summary?page=1&limit=50", body: { customerId: ctx.topCustomer }, rf: "RF-04", scenario: "top customer" });
  add({ id: "rep-customer-ledger-2y", method: "POST", url: "/report/customer-ledger?page=1&limit=50", body: { ...s2, customerId: ctx.topCustomer }, rf: "RF-04", scenario: "2y, top customer (21k invoices)" });
  add({ id: "rep-customer-payment-2y", method: "POST", url: "/report/customer-payment?page=1&limit=50", body: s2, rf: "RF-07", scenario: "2y" });
  add({ id: "rep-customer-balance-filters", method: "GET", url: "/report/customer-balance-summary/filters", rf: "RF-06", scenario: "all customers sorted by name" });
  add({ id: "rep-customer-payment-customers", method: "GET", url: "/report/customer-payment/customers", rf: "RF-13", scenario: "picker" });
  add({ id: "cust-list", method: "GET", url: "/customer/get-customers", rf: "RF-06", scenario: "no filter (330k customers)" });
  add({ id: "cust-list-search", method: "GET", url: "/customer/get-customers?q=a", rf: "RF-08", scenario: "q=a" });
  add({ id: "cust-payments", method: "GET", url: "/customer/get-customer-payment-recived", rf: "RF-06", scenario: "all payments" });
  add({ id: "cust-payments-one", method: "GET", url: `/customer/get-customer-payment-recived?customer=${ctx.topCustomer}`, rf: "RF-18", scenario: "top customer" });
  add({ id: "cust-advances", method: "GET", url: "/customer/get-customer-advance-payment-reviced", rf: "RF-06", scenario: "all advances" });

  // ---------------- products / variants (RF-05, RF-06, RF-11) ----------------
  add({ id: "prod-perpage-p1", method: "GET", url: "/product/productperpage?page=1&limit=50", rf: "RF-11", scenario: "page 1" });
  add({ id: "prod-perpage-p100", method: "GET", url: "/product/productperpage?page=100&limit=50", rf: "RF-07", scenario: "page 100" });
  add({ id: "prod-perpage-p1000", method: "GET", url: "/product/productperpage?page=1000&limit=50", rf: "RF-07", scenario: "page 1000" });
  add({ id: "prod-perpage-last", method: "GET", url: `/product/productperpage?page=${lastPage(c.products, 50)}&limit=50`, rf: "RF-07", scenario: "deepest page" });
  add({ id: "prod-getproduct", method: "GET", url: "/product/getproduct", rf: "RF-06", scenario: "no filter: all 275k products, 3 populates" });
  add({ id: "prod-getproduct-slug", method: "GET", url: `/product/getproduct/${ctx.topProductSlug}`, rf: "RF-05", scenario: "single top product" });
  add({ id: "prod-single-variant", method: "GET", url: "/product/all-single-variant-products?page=1&limit=50", rf: "RF-11", scenario: "page 1" });
  add({ id: "prod-single-variant-search", method: "GET", url: "/product/all-single-variant-products?page=1&limit=50&search=a", rf: "RF-08", scenario: "search=a" });
  add({ id: "prod-multivariant", method: "GET", url: "/product/multiplevarinatproduct", rf: "RF-06", scenario: "no filter" });
  add({ id: "prod-discount-products", method: "GET", url: "/product/discount-products", rf: "RF-06", scenario: "no filter" });
  add({ id: "prod-search-a", method: "GET", url: "/product/search-product?q=a", rf: "RF-08", scenario: "q=a" });
  add({ id: "prod-price-range", method: "GET", url: "/product/price-range?minPrice=0&maxPrice=1000000", rf: "RF-18", scenario: "widest range" });
  add({ id: "prod-best-selling", method: "GET", url: "/product/best-selling-products", rf: "RF-05", scenario: "storefront" });
  add({ id: "prod-newarrival", method: "GET", url: "/product/newarrival", rf: "RF-05", scenario: "storefront" });
  add({ id: "variant-list", method: "GET", url: "/variant", rf: "RF-05", scenario: "no filter: all 496k variants + hook" });
  add({ id: "variant-search-a", method: "GET", url: "/search-variant?q=a", rf: "RF-08", scenario: "q=a" });
  add({ id: "inv-pushwebsalesvariant", method: "GET", url: "/invoice/pushwebsalesvariant", rf: "RF-06", scenario: "no filter" });
  add({ id: "inv-pushwebsalesproduct", method: "GET", url: "/invoice/pushwebsalesproduct", rf: "RF-06", scenario: "no filter" });
  add({ id: "stock-multivariant-p1", method: "GET", url: "/stock/getallmultiplevariant?page=1&limit=50", rf: "RF-11", scenario: "page 1" });
  add({ id: "stock-multivariant-last", method: "GET", url: `/stock/getallmultiplevariant?page=${lastPage(c.variants, 50)}&limit=50`, rf: "RF-07", scenario: "deepest page" });
  add({ id: "stock-adjust-list-p1", method: "GET", url: "/stock/stock-adjust?page=1&limit=50", rf: "RF-07", scenario: "page 1" });
  add({ id: "stock-adjust-list-last", method: "GET", url: `/stock/stock-adjust?page=${lastPage(c.stockadjusts, 50)}&limit=50`, rf: "RF-07", scenario: "deepest page" });
  add({ id: "stock-by-category", method: "GET", url: `/stock/stock-adjust/category/${ctx.biggestCategory}`, rf: "RF-06", scenario: "biggest category (62k products)" });
  if (ctx.topSubcategory && ctx.topSubcategory !== "null") add({ id: "stock-by-subcategory", method: "GET", url: `/stock/stock-adjust/subcategory/${ctx.topSubcategory}`, rf: "RF-06", scenario: "biggest subcategory" });

  // ---------------- orders (RF-12) ----------------
  add({ id: "order-all", method: "GET", url: "/order/allorders", rf: "RF-12", scenario: "no filter (220k orders), 3 populates" });
  add({ id: "order-by-date", method: "GET", url: `/order/filterorderbydate?startDate=${s2.startDate}&endDate=${s2.endDate}`, rf: "RF-12", scenario: "2y" });
  add({ id: "order-courier-pending", method: "GET", url: "/order/getallcourierpendingorder", rf: "RF-12", scenario: "no filter" });
  add({ id: "order-courier-info", method: "GET", url: "/order/getcourierinfo", rf: "RF-12", scenario: "no filter" });
  add({ id: "order-courier-sent", method: "GET", url: "/order/couriersendedorders", rf: "RF-12", scenario: "no filter" });
  add({ id: "order-count-amount", method: "GET", url: "/order/getordercountandamount", rf: "RF-12", scenario: "totals" });
  add({ id: "order-status-counts", method: "GET", url: "/order/getorderstatus", rf: "RF-12", scenario: "status counts" });
  add({ id: "order-datewise", method: "GET", url: "/order/datewiseordersummary", rf: "RF-12", scenario: "summary" });

  // ---------------- purchases / returns ----------------
  add({ id: "purchase-all", method: "GET", url: "/purchase/all-allpurchases", rf: "RF-06", scenario: "no filter (110k purchases), 3 populates incl. variant" });
  add({ id: "purchase-search", method: "GET", url: `/purchase/search-purchase?supplierId=${ctx.topSupplier}`, rf: "RF-06", scenario: "top supplier" });
  add({ id: "purchase-return-list", method: "GET", url: "/purchase-return", rf: "RF-07", scenario: "list" });
  add({ id: "sales-return-all", method: "GET", url: "/sales-return/allsalesreturn", rf: "RF-06", scenario: "all sales returns" });

  // ---------------- users / audit / sms ----------------
  add({ id: "users-all", method: "GET", url: "/auth/getallusers", rf: "RF-06", scenario: "all users (shoppers incl.)" });
  add({ id: "users-added-by-admin", method: "GET", url: "/auth/get-user-added-by-admin", rf: "RF-06", scenario: "staff list" });
  add({ id: "userperm-all", method: "GET", url: "/userpermission/get-all-users", rf: "RF-06", scenario: "all users" });
  add({ id: "audit-list", method: "GET", url: "/audit?limit=50", rf: "RF-18", scenario: "first page" });
  add({ id: "audit-entity", method: "GET", url: `/audit/entity/sale/${ctx.lastSale}`, rf: "RF-18", scenario: "sale timeline" });
  add({ id: "sms-recipient-counts", method: "GET", url: "/sms/recipient-counts", rf: "RF-06", scenario: "all recipients" });
  add({ id: "sms-user-phone", method: "GET", url: "/sms/user-phone", rf: "RF-06", scenario: "phone list" });
  add({ id: "sms-order-phone", method: "GET", url: "/sms/order-phone", rf: "RF-06", scenario: "phone list" });

  // ---------------- dashboard (RF-10) ----------------
  for (const r of ["today", "30d", "12m", "all"]) {
    add({ id: `dash-overview-${r}`, method: "GET", url: `/dashboard/overview?range=${r}`, rf: "RF-10", scenario: `range=${r}, cache miss` });
  }
  for (const w of ["invoices", "sales-summary", "transaction-summary", "inventory-summary", "customer-summary", "supplier-summary",
    "purchase-summary", "sold-items-summary", "inventory-value-summary", "stock-cost-summary", "product-status-summary",
    "supplier-payment-summary", "customer-due-payment-summary", "inflow-transaction-summary", "outflow-transaction-summary",
    "day-cash-summary", "accounts-balance-summary", "top-selling-products"]) {
    add({ id: `dash-${w}-12m`, method: "GET", url: `/dashboard/${w}?range=12m`, rf: "RF-10", scenario: "range=12m, cache miss" });
  }
  add({ id: "dash-overview-30d-hit", method: "GET", url: "/dashboard/overview?range=30d", cache: "hit", rf: "RF-10", scenario: "range=30d, cache hit (no writes)" });

  // ---------------- write paths, round-trips vs line count (RF-15) ----------------
  const saleBody = (n) => () => ({
    customerType: { type: "listed", customerId: ctx.topCustomer },
    salesMen: ctx.ownerId,
    searchItem: ctx.lineVariants.slice(0, n).map((v) => ({ productId: null, variantId: v.id, quantity: 1, salesRate: v.price, salesStatus: "sale" })),
    payable: ctx.lineVariants.slice(0, n).reduce((s, v) => s + v.price, 0),
    paid: ctx.lineVariants.slice(0, n).reduce((s, v) => s + v.price, 0),
    paymentMethod: ctx.account ? { singlePayment: { amount: ctx.lineVariants.slice(0, n).reduce((s, v) => s + v.price, 0), paymentTo: ctx.account } } : {},
    salesType: "retailsale",
    invoiceStatus: "complete",
    date: new Date("2026-10-19T10:00:00Z").toISOString(),
  });
  for (const n of [1, 10, 50]) {
    add({ id: `w-sale-create-${n}`, method: "POST", url: "/sales/create-sales", body: saleBody(n), rf: "RF-15", scenario: `create complete sale, ${n} variant line(s), listed top customer`, runs: 10 });
  }
  return S;
};

const loadScenario = (id, ctx) => {
  const s = scenarios(ctx).find((x) => x.id === id);
  if (!s) throw new Error(`unknown scenario ${id}`);
  return s;
};

module.exports = { scenarios, loadScenario, buildContext, RANGES, RAW_DIR, OUT_DIR };
