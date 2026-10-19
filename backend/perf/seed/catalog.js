/**
 * Per-tenant reference data and the catalogue (categories, brands, products,
 * variants), customers, suppliers, employees and shopper users.
 * Returns compact in-memory handles that the transaction generators pick from.
 */
const { ObjectId } = require("mongodb");
const L = require("./lib");

const CUSTOMER_TYPES = [
  ["Regular", "regular"],
  ["Wholesale", "wholesale"],
  ["VIP", "vip"],
];
const ACCOUNTS = [
  ["Cash", 70],
  ["bKash", 14],
  ["Bank - DBBL", 10],
  ["Nagad", 6],
  ["Card - POS", 0],
  ["Petty Cash", 0],
];
const SYSTEM_TXN_CATEGORIES = [
  ["Sales Payment", "cash recived", "salesPayment"],
  ["Customer Payment Received", "cash recived", "customerPayment"],
  ["Customer Advance Payment", "cash recived", "customerAdvance"],
  ["Purchase Payment", "cash payment", "purchasePayment"],
  ["Supplier Payment", "cash payment", "supplierPayment"],
  ["Purchase Return Refund", "cash recived", "purchaseReturnRefund"],
];
const CUSTOM_TXN_CATEGORIES = [
  ["Shop Rent", "cash payment"],
  ["Staff Salary", "cash payment"],
  ["Electricity Bill", "cash payment"],
  ["Internet Bill", "cash payment"],
  ["Sales Refund", "cash payment"],
  ["Owner Investment", "cash recived"],
];

const seo = (title = "") => ({
  metaTitle: title.slice(0, 70),
  metaDescription: "",
  metaKeywords: [],
  canonicalUrl: "",
  focusKeyword: "",
  ogTitle: "",
  ogDescription: "",
  ogImage: L.emptyImage(),
  twitterCard: "summary_large_image",
  structuredData: null,
  noIndex: false,
  noFollow: false,
});

/** Small lookup collections at realistic per-store size. */
async function seedLookups(w, t, cfg, rng, C) {
  const created = L.dateAt(0, rng); // store opened 2 years ago
  const base = { tenantId: t._id, createdAt: created, updatedAt: created, __v: 0 };

  t.customerTypes = [];
  for (const [name, slug] of CUSTOMER_TYPES) {
    const _id = new ObjectId();
    t.customerTypes.push(_id);
    await w.add(C.customerTypes, { _id, tenantId: t._id, customerType: name, slug, __v: 0 });
  }

  t.accounts = ACCOUNTS.map(([name, weight]) => ({ _id: new ObjectId(), name, weight, balance: 0 }));
  t.accountPick = t.accounts.filter((a) => a.weight > 0).map((a) => [a, a.weight]);

  t.txnCats = {};
  for (const [name, allowedType, key] of SYSTEM_TXN_CATEGORIES) {
    const _id = new ObjectId();
    t.txnCats[key] = _id;
    await w.add(C.transitionCategories, { ...base, _id, name, slug: L.slugify(name), isActive: true, allowedType, isSystem: true });
  }
  t.customTxnCats = [];
  for (const [name, allowedType] of CUSTOM_TXN_CATEGORIES) {
    const _id = new ObjectId();
    t.customTxnCats.push({ _id, allowedType, name });
    await w.add(C.transitionCategories, { ...base, _id, name, slug: L.slugify(name), isActive: true, allowedType, isSystem: false });
  }

  t.deliveries = [];
  for (const [name, charge] of [["Inside Dhaka", 60], ["Outside Dhaka", 120], ["Sub Area", 100]]) {
    const _id = new ObjectId();
    t.deliveries.push({ _id, charge });
    await w.add(C.deliveries, { _id, tenantId: t._id, name, deliveryCharge: charge, description: `${name} delivery`, __v: 0 });
  }

  const nCoupons = Math.max(5, Math.round(cfg.coupons * t.share));
  for (let i = 1; i <= nCoupons; i++) {
    const start = L.randomDate(rng);
    const expire = new Date(start.getTime() + rng.int(7, 90) * L.DAY);
    const code = `${t.prefix}SAVE${i}`;
    await w.add(C.coupons, {
      ...base, _id: L.oidAt(start), createdAt: start, updatedAt: start,
      customSerialId: `CPN-${t.prefix}-${String(i).padStart(2, "0")}`, slug: code.toLowerCase(), code,
      discountType: rng.chance(0.7) ? "percentage" : "fixed", discountValue: rng.int(5, 25),
      minOrderAmount: rng.pick([0, 500, 1000, 2000]), maxDiscountAmount: rng.chance(0.5) ? 500 : null,
      couponStartAt: start, expireAt: expire, usageLimit: rng.chance(0.5) ? rng.int(50, 1000) : null,
      usedCount: rng.int(0, 200), isActive: expire.getTime() > L.NOW,
    });
  }

  // Employees (salesmen)
  t.employees = [];
  const nEmp = Math.max(8, Math.round(cfg.employees * t.share));
  for (let i = 1; i <= nEmp; i++) {
    const at = L.randomDate(rng);
    const _id = L.oidAt(at);
    t.employees.push(_id);
    await w.add(C.employees, {
      ...base, _id, createdAt: at, updatedAt: at,
      employeeId: `EMP-${t.prefix}-${String(i).padStart(3, "0")}`, fullName: L.personName(rng),
      nidNumber: rng.digits(10), gender: rng.chance(0.65) ? "male" : "female",
      mobile: L.bdMobile(t.index * 1e6 + i, 7), email: `emp${i}@${t.slug}.perf`,
      presentAddress: L.address(rng), permanentAddress: L.address(rng), joiningDate: at,
      image: L.emptyImage(),
      salary: { basicSalary: 12000, houseRent: 4000, medicalAllowance: 1000, othersAllowance: 0, specialAllowance: 0, providentFund: 0, grossSalary: 17000, netSalary: 17000 },
      isActive: rng.chance(0.9), deletedAt: null, isDeleted: false,
    });
  }
  t.employeeZipf = L.makeZipf(t.employees.length, 0.8, rng);

  // Suppliers
  t.suppliers = [];
  const nSup = Math.max(10, Math.round(cfg.suppliers * t.share));
  for (let i = 1; i <= nSup; i++) {
    const at = L.randomDate(rng);
    const _id = L.oidAt(at);
    const mobile = L.bdMobile(t.index * 1e6 + i, 8);
    t.suppliers.push(_id);
    const due = rng.chance(0.4) ? rng.int(1000, 300000) : 0;
    await w.add(C.suppliers, {
      ...base, _id, createdAt: at, updatedAt: at,
      supplierSerialId: `SUPL-${t.prefix}-${String(i).padStart(2, "0")}`, supplierId: mobile,
      supplierName: `${rngCompany(rng)} ${i}`, contactPersonName: L.personName(rng),
      contactPersonDesignation: rng.pick(["Manager", "Sales Rep", "Owner", ""]), mobile,
      supplierAddress: L.address(rng), openingDues: due, initialDue: due, totalPurchaseDue: due,
      isActive: rng.chance(0.95), deletedAt: null,
    });
  }
  t.supplierZipf = L.makeZipf(t.suppliers.length, 1.0, rng);

  // Staff users (sellers). Owner is created through the app model in index.js;
  // the rest copy its password hash so measure mode can sign in as any of them.
  t.staff = [{ _id: t.ownerId, name: t.ownerName, email: t.ownerEmail }];
  const nStaff = Math.max(3, Math.round(cfg.staff * t.share));
  for (let i = 1; i <= nStaff; i++) {
    const at = L.randomDate(rng);
    const _id = L.oidAt(at);
    const name = L.personName(rng);
    const email = `staff${i}@${t.slug}.perf`;
    t.staff.push({ _id, name, email });
    await w.add(C.users, userDoc(t, _id, at, name, email, `01${6}${String(t.index * 1e6 + i).padStart(8, "0")}`, [t.ownerRoleId], rng));
  }
  t.staffZipf = L.makeZipf(t.staff.length, 0.9, rng);
}

const COMPANY = ["Bismillah Traders", "Karim Enterprise", "Padma Textiles", "Meghna Distribution", "Jamuna Supply", "Shapla Fashion", "Rupali Imports", "Sonar Bangla Agro", "Dhaka Wholesale", "Chittagong Trading", "Nabil Garments", "Square Distributors", "Akij Supply", "Pran Agency"];
const rngCompany = (rng) => rng.pick(COMPANY);

const userDoc = (t, _id, at, name, email, phone, roles, rng) => ({
  _id, tenantId: t._id, name, email, password: t.passwordHash, image: L.emptyImage(),
  isEmailVerified: rng.chance(0.6), isPhoneVerified: rng.chance(0.4), roles, permissions: [],
  phone, address: L.address(rng), city: "Dhaka", country: "Bangladesh",
  newsLetterSubscribe: rng.chance(0.2), resetPasswordAttempts: 0, discountLimit: roles.length ? 10 : 0,
  twoFactorEnabled: false, isBlocked: rng.chance(0.005), isActive: rng.chance(0.98),
  lastlogin: new Date(Math.min(L.NOW, at.getTime() + rng.int(0, 300) * L.DAY)),
  mustChangePassword: false, tokenVersion: 0, createdAt: at, updatedAt: at, __v: 0,
});

/** Categories (Zipf-sized), subcategories, brands, products and variants. */
async function seedCatalog(w, t, cfg, rng, C, stats) {
  const nCat = Math.max(8, Math.round(cfg.categories * Math.sqrt(t.share)));
  const nBrand = Math.max(10, Math.round(cfg.brands * Math.sqrt(t.share)));
  t.categories = [];
  for (let i = 1; i <= nCat; i++) {
    const at = L.dateAt(rng.next() * 0.3, rng);
    const _id = L.oidAt(at);
    const name = `${rng.pick(L.NOUN)} ${i}`;
    const cat = { _id, subs: [] };
    t.categories.push(cat);
    await w.add(C.categories, {
      _id, tenantId: t._id, categorySerialId: `CAT-${t.prefix}-${String(i).padStart(2, "0")}`, name,
      slug: L.slugify(name), image: L.image(rng, "category"), discount: null, sizeChart: null,
      isActive: rng.chance(0.95), createdAt: at, updatedAt: at, __v: 0,
    });
    const nSub = rng.int(2, 8);
    for (let j = 1; j <= nSub; j++) {
      const sid = new ObjectId();
      cat.subs.push(sid);
      const sname = `${rng.pick(L.ADJ)} ${name} ${j}`;
      await w.add(C.subcategories, {
        _id: sid, tenantId: t._id, category: _id, name: sname, slug: L.slugify(`${sname}-${i}`),
        discount: null, sizeChart: null, isActive: true, createdAt: at, updatedAt: at, __v: 0,
      });
    }
  }
  t.brands = [];
  for (let i = 1; i <= nBrand; i++) {
    const at = L.dateAt(rng.next() * 0.3, rng);
    const _id = L.oidAt(at);
    t.brands.push(_id);
    const name = `${rngCompany(rng).split(" ")[0]} Brand ${i}`;
    await w.add(C.brands, {
      _id, tenantId: t._id, name, slug: L.slugify(name), image: L.image(rng, "brand"), sizeChart: null,
      isActive: true, createdAt: at, updatedAt: at, __v: 0,
    });
  }

  // 80/20 skew: a few categories and brands own most products.
  const catZipf = L.makeZipf(nCat, 1.15, rng);
  const brandZipf = L.makeZipf(nBrand, 1.1, rng);
  const nProducts = Math.max(50, Math.round(cfg.products * t.share));
  t.products = new Array(nProducts);
  const catCount = new Uint32Array(nCat);
  const brandCount = new Uint32Array(nBrand);
  let variants = 0;

  for (let i = 0; i < nProducts; i++) {
    const at = L.dateAt(L.dayFraction((i + rng.next()) / nProducts), rng); // catalogue grows over time
    const _id = L.oidAt(at);
    const ci = catZipf.sample();
    catCount[ci]++;
    const cat = t.categories[ci];
    const sub = rng.chance(0.85) ? rng.pick(cat.subs) : undefined;
    const bi = rng.chance(0.8) ? brandZipf.sample() : -1;
    if (bi >= 0) brandCount[bi]++;
    const pp = rng.int(8, 400) * 10; // 80 – 4,000 taka cost
    const rp = Math.round(pp * rng.float(1.15, 1.8) / 10) * 10;
    const wp = Math.round((pp + (rp - pp) * 0.5) / 10) * 10;
    const multi = rng.chance(cfg.multiVariantShare);
    const name = `${rng.pick(L.ADJ)} ${rng.pick(L.NOUN)} ${rng.pick(L.COLORS)} ${t.prefix}${i + 1}`;
    const slug = L.slugify(name);
    const isActive = rng.chance(0.92);
    const stock = multi ? 0 : rng.weighted([[0, 8], [rng.int(1, 10), 22], [rng.int(10, 200), 70]]);
    const p = { _id, name, cat: cat._id, sub, brand: bi >= 0 ? t.brands[bi] : null, pp, rp, wp, multi, barCode: `2${t.index}${String(i + 1).padStart(10, "0")}`, size: "N/A", color: "N/A", variants: null };

    const variantIds = [];
    if (multi) {
      const colors = L.makeRng(i ^ 0x9e37).shuffle([...L.COLORS]).slice(0, rng.int(1, 3));
      const sizes = L.makeRng(i ^ 0x7f4a).shuffle([...L.SIZES]).slice(0, rng.int(2, 4));
      p.variants = [];
      for (const color of colors) {
        for (const size of sizes) {
          variants++;
          const vat = new Date(at.getTime() + rng.int(0, 600) * 1000);
          const vid = L.oidAt(vat);
          const vpp = pp + rng.pick([0, 0, 0, 20, 50]);
          const vrp = Math.round(vpp * (rp / pp) / 10) * 10;
          const vwp = Math.round((vpp + (vrp - vpp) * 0.5) / 10) * 10;
          const variantName = `${name} - ${color} / ${size}`;
          const v = { _id: vid, barCode: `3${t.index}${String(variants).padStart(10, "0")}`, size, color, pp: vpp, rp: vrp, wp: vwp };
          p.variants.push(v);
          variantIds.push(vid);
          const vstock = rng.weighted([[0, 12], [rng.int(1, 5), 28], [rng.int(5, 60), 60]]);
          await w.add(C.variants, {
            _id: vid, tenantId: t._id, product: _id, slug: L.slugify(variantName), variantName,
            sku: `9${t.index}${String(variants).padStart(9, "0")}`, barCode: v.barCode, size, color,
            thumbnail: rng.chance(0.6) ? L.image(rng, "variant") : L.emptyImage(), image: [],
            seo: seo(), weight: 0, dimensions: { width: 0, height: 0, depth: 0 },
            stockVariant: vstock, initialStock: vstock, posSold: 0, webSold: 0, purchaseReturnStock: 0,
            salesReturnStock: 0, purchaseQuantityStock: rng.int(0, 200), stockAdjustmentPlus: 0, stockAdjustmentMinus: 0,
            alertVariantStock: 5, purchasePrice: vpp, retailPrice: vrp, wholesalePrice: vwp,
            retailProfitMarginByPercentage: 0, wholesaleProfitMarginPercentage: 0, unit: "Piece",
            specifications: null, alertQuantity: 5, stockAlert: vstock < 5, instock: vstock > 0,
            isActive: isActive && rng.chance(0.97), totalSales: 0, salesReturn: [], byReturn: [], courierReturn: [],
            discount: null, sizeChart: null, createdAt: vat, updatedAt: vat, __v: 0,
          });
        }
      }
    }

    t.products[i] = p;
    const nImg = rng.weighted([[0, 10], [1, 40], [2, 25], [3, 15], [4, 10]]);
    const tags = [];
    for (let k = rng.int(0, 5); k > 0; k--) tags.push(rng.pick(L.NOUN).toLowerCase());
    await w.add(C.products, {
      _id, tenantId: t._id, slug, name, description: L.sentence(rng, 25, 120), category: cat._id,
      ...(sub && { subcategory: sub }), brand: p.brand, variant: variantIds, discount: null, sizeChart: null,
      image: Array.from({ length: nImg }, () => L.image(rng, "product")), thumbnail: nImg ? L.image(rng, "product") : L.emptyImage(),
      seo: seo(rng.chance(0.3) ? name : ""), tag: tags, manufactureCountry: rng.pick(["Bangladesh", "China", "India", "Thailand"]),
      rating: Math.round(rng.float(0, 5) * 10) / 10, warrantyInformation: "No warranty info",
      shippingInformation: "Shipping details not available", weight: rng.int(0, 2000),
      dimensions: { width: 0, height: 0, depth: 0 },
      availabilityStatus: stock > 0 || multi ? "In Stock" : "Out of Stock",
      sku: `SKU${t.index}${String(i + 1).padStart(8, "0")}`, barCode: p.barCode,
      unit: rng.weighted([["Piece", 80], ["Kg", 8], ["Packet", 8], ["pair", 4]]),
      variantType: multi ? "multipleVariant" : "singleVariant", size: "N/A", color: "N/A",
      stock, initialStock: stock, purchaseReturnStock: 0, salesReturnStock: 0, purchaseQuantityStock: rng.int(0, 500),
      posSold: 0, webSold: 0, warehouseLocation: `Rack ${rng.int(1, 40)}`, purchasePrice: pp, retailPrice: rp,
      retailProfitMarginByPercentage: Math.round(((rp - pp) / pp) * 100) % 100, wholesalePrice: wp,
      wholesaleProfitMarginPercentage: Math.round(((wp - pp) / pp) * 100) % 100, specifications: null,
      alertQuantity: 5, stockAlert: stock < 5, instock: stock > 0, stockAdjustmentPlus: 0, stockAdjustmentMinus: 0,
      isActive, totalSales: 0, salesReturn: [], byReturn: [], courierReturn: [], createdAt: at, updatedAt: at, __v: 0,
    });
  }
  t.productZipf = L.makeZipf(nProducts, 1.0, rng); // best sellers

  const topCat = catCount.reduce((b, c, i) => (c > catCount[b] ? i : b), 0);
  const topBrand = brandCount.reduce((b, c, i) => (c > brandCount[b] ? i : b), 0);
  stats.catalog[t.slug] = {
    categories: nCat, brands: nBrand, products: nProducts, variants,
    biggestCategory: { id: String(t.categories[topCat]._id), products: catCount[topCat] },
    biggestBrand: { id: String(t.brands[topBrand]), products: brandCount[topBrand] },
  };
}

/** Customers (POS) with soft-deletes, and storefront shopper users. */
async function seedPeople(w, t, cfg, rng, C) {
  const nCust = Math.max(50, Math.round(cfg.customers * t.share));
  t.customers = new Array(nCust);
  for (let i = 0; i < nCust; i++) {
    const at = L.dateAt(L.dayFraction((i + rng.next()) / nCust), rng);
    const _id = L.oidAt(at);
    const mobile = L.bdMobile(i + 1, 3 + (i % 7));
    const deleted = rng.chance(0.03);
    const due = rng.chance(0.25) ? rng.int(100, 50000) : 0;
    const discount = rng.chance(0.1) ? rng.pick([2, 5, 5, 10]) : 0;
    t.customers[i] = { _id, discount, wholesale: false };
    const typeIdx = rng.weighted([[0, 85], [1, 12], [2, 3]]);
    if (typeIdx === 1) t.customers[i].wholesale = true;
    const name = L.personName(rng);
    await w.add(C.customers, {
      _id, tenantId: t._id, customSerialId: `CUS-${t.prefix}-${String(i + 1).padStart(2, "0")}`,
      customerId: mobile, customerType: t.customerTypes[typeIdx], fullName: name, mobileNumber: mobile,
      occupation: rng.pick(["", "", "Business", "Service", "Student", "Teacher"]),
      ...(rng.chance(0.3) && { nidNumber: rng.digits(10) }),
      openingDues: due, initialDue: rng.chance(0.3) ? due : 0, advancePaymentRecived: rng.chance(0.03) ? rng.int(500, 20000) : 0,
      regularDiscountPercent: discount, dueLimit: rng.pick([0, 0, 5000, 20000, 50000]),
      emailAddress: rng.chance(0.35) ? `c${i + 1}.${t.slug}@mail.perf` : "", image: L.emptyImage(),
      remarks: rng.chance(0.1) ? L.sentence(rng, 4, 15) : "", presentAddress: rng.chance(0.7) ? L.address(rng) : "",
      permanentAddress: rng.chance(0.3) ? L.address(rng) : "", isActive: !deleted && rng.chance(0.98),
      deletedAt: deleted ? new Date(at.getTime() + rng.int(1, 200) * L.DAY) : null,
      createdAt: at, updatedAt: at, __v: 0,
    });
  }
  t.customerZipf = L.makeZipf(nCust, 0.9, rng); // a few loyal customers own many invoices

  const nShop = Math.max(20, Math.round(cfg.shoppers * t.share));
  t.shoppers = new Array(nShop);
  for (let i = 0; i < nShop; i++) {
    const at = L.dateAt(L.dayFraction((i + rng.next()) / nShop), rng);
    const _id = L.oidAt(at);
    t.shoppers[i] = _id;
    const phone = rng.chance(0.6) ? `015${String(i + 1).padStart(8, "0")}` : undefined;
    const doc = userDoc(t, _id, at, L.personName(rng), `shopper${i + 1}@${t.slug}.perf`, phone, [], rng);
    if (!phone) delete doc.phone;
    await w.add(C.users, doc);
  }
}

module.exports = { seedLookups, seedCatalog, seedPeople };
