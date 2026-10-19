/**
 * Transactional collections, generated in time order across tenants so _id,
 * createdAt and every right-growing index look like years of real inserts:
 * sales (+ sales returns + cash-ledger rows), purchases, web/POS orders,
 * customer and supplier payments, stock adjustments, SMS logs, money transfers,
 * purchase returns, daily cash summaries and audit logs.
 *
 * Money follows .claude/rules/profit-calculation.md: one discount level per
 * invoice, purchasePrice stamped on the line, partial returns flip the whole
 * line to "return" with sale.return = refunded net amount.
 */
const { ObjectId } = require("mongodb");
const L = require("./lib");

const r2 = (n) => Math.round(n * 100) / 100;
const pad = (n) => String(n).padStart(2, "0");

const tenantPicker = (tenants, rng) => {
  const pairs = tenants.map((t) => [t, t.share]);
  return () => rng.weighted(pairs);
};

const nextSeq = (t, key) => (t.seq[key] = (t.seq[key] || 0) + 1);

const pickAccount = (t, rng) => rng.weighted(t.accountPick);

const txn = (t, at, { account, type, amount, category, description, ...refs }) => {
  account.balance = r2(account.balance + (type === "cash recived" ? amount : -amount));
  return {
    _id: L.oidAt(at), tenantId: t._id,
    transactionSerialId: `TRXID-${t.prefix}-${pad(nextSeq(t, "TRANSACTION_SERIAL"))}`,
    date: at, transactionCategory: category, account: account._id, transactionDescription: description,
    transactionType: type, amount, balanceAfter: account.balance, ...refs,
    createdAt: at, updatedAt: at, __v: 0,
  };
};

const pickLine = (t, rng) => {
  const p = t.products[t.productZipf.sample()];
  const v = p.multi ? p.variants[Math.floor(rng.next() * p.variants.length)] : null;
  return { p, v };
};

// ── Sales ────────────────────────────────────────────────────────────────────
async function seedSales(w, tenants, cfg, rng, C, stats) {
  const pickTenant = tenantPicker(tenants, rng);
  const N = cfg.sales;
  const custInvoices = new Map(); // `${tenant}:${customerId}` -> count (worst-case customer)
  for (let i = 0; i < N; i++) {
    const t = pickTenant();
    const createdAt = L.dateAt(L.dayFraction((i + rng.next()) / N), rng);
    const _id = L.oidAt(createdAt);
    const backdated = rng.chance(0.03);
    const date = backdated ? new Date(createdAt.getTime() - rng.int(1, 10) * L.DAY) : createdAt;
    const salesType = rng.weighted([["retailsale", 70], ["wholesale", 20], ["retailsaleorder", 7], ["wholesaleorder", 3]]);
    const wholesale = salesType.startsWith("wholesale");
    const listed = wholesale ? rng.chance(0.85) : rng.chance(0.4);
    let customer = null;
    if (listed) {
      customer = t.customers[t.customerZipf.sample()];
      const k = `${t.slug}:${customer._id}`;
      custInvoices.set(k, (custInvoices.get(k) || 0) + 1);
    }

    // Discount level: exactly one per invoice
    const level = customer?.discount
      ? "percent"
      : rng.weighted([["none", 72], ["line", 12], ["percent", 10], ["less", 6]]);

    const nLines = wholesale
      ? rng.weighted([[2, 15], [4, 25], [6, 25], [10, 20], [15, 10], [25, 5]])
      : rng.weighted([[1, 30], [2, 25], [3, 18], [4, 10], [5, 7], [6, 4], [8, 3], [12, 2], [20, 1]]);
    const lines = [];
    let sumNet = 0;
    let units = 0;
    let gross = 0;
    const seen = new Set();
    for (let k = 0; k < nLines; k++) {
      const { p, v } = pickLine(t, rng);
      const key = String(v ? v._id : p._id);
      if (seen.has(key)) continue;
      seen.add(key);
      const quantity = wholesale ? rng.int(5, 100) : rng.weighted([[1, 70], [2, 18], [3, 7], [5, 5]]);
      const salesRate = wholesale ? (v ? v.wp : p.wp) : v ? v.rp : p.rp;
      const pp = v ? v.pp : p.pp;
      let discount = 0;
      let discountType = "amount";
      if (level === "line" && rng.chance(0.6)) {
        if (rng.chance(0.5)) discount = Math.min(salesRate - 1, rng.pick([10, 20, 50, 100]));
        else {
          discountType = "percent";
          discount = rng.pick([5, 10, 15, 20]);
        }
      }
      const lineGross = salesRate * quantity;
      const lineNet = discountType === "amount" ? lineGross - discount * quantity : lineGross - (lineGross * discount) / 100;
      sumNet += lineNet;
      gross += lineGross;
      units += quantity;
      const line = {
        productId: p._id, ...(v && { variantId: v._id }), salesStatus: "sale",
        barcode: v ? v.barCode : p.barCode, productDescription: p.name,
        color: v ? v.color : p.color, size: v ? v.size : p.size, quantity, groupQuantity: 0, unit: "Piece",
        salesRate, discount, discountType, subtotal: r2(lineNet),
      };
      if (rng.chance(0.97)) line.purchasePrice = pp; // 3% legacy lines without the stamp
      lines.push(line);
    }
    if (rng.chance(0.01) && lines.length) {
      const { p, v } = pickLine(t, rng);
      lines.push({ productId: p._id, ...(v && { variantId: v._id }), salesStatus: "exchange", barcode: v ? v.barCode : p.barCode, productDescription: p.name, color: v ? v.color : "N/A", size: v ? v.size : "N/A", quantity: 1, groupQuantity: 0, unit: "Piece", salesRate: v ? v.rp : p.rp, discount: 0, discountType: "amount", subtotal: v ? v.rp : p.rp, purchasePrice: v ? v.pp : p.pp });
    }

    const discountPercent = level === "percent" ? customer?.discount || rng.pick([2, 3, 5, 10, 15]) : 0;
    const lessTaka = level === "less" ? Math.min(Math.floor(sumNet * 0.1), rng.pick([5, 10, 20, 50, 100, 200, 500])) : 0;
    const netSales = r2(sumNet - (sumNet * discountPercent) / 100 - lessTaka);
    const vatPercent = t.vat;
    const vat = r2((netSales * vatPercent) / 100);
    const deliveryCost = salesType.endsWith("order") ? rng.pick([60, 100, 120, 150]) : 0;
    const labourCost = wholesale && rng.chance(0.2) ? rng.pick([50, 100, 200]) : 0;
    const advAdj = customer && rng.chance(0.01) ? Math.min(netSales, rng.int(100, 2000)) : 0;
    const payable = r2(netSales + vat + deliveryCost + labourCost - advAdj);

    const paymentStatus = customer ? rng.weighted([["paid", 75], ["partial", 15], ["due", 10]]) : "paid";
    let paid = 0;
    if (paymentStatus === "paid") {
      const step = rng.pick([1, 10, 50, 100, 500]);
      paid = Math.ceil(payable / step) * step;
    } else if (paymentStatus === "partial") paid = Math.round(payable * rng.float(0.2, 0.8));
    const changes = r2(Math.max(0, paid - payable));
    const netPaid = r2(paid - changes);
    const presentDue = r2(Math.max(0, payable - netPaid));
    const previousDue = customer && rng.chance(0.3) ? rng.int(100, 20000) : 0;

    let paymentMethod;
    const payments = [];
    if (netPaid > 0) {
      if (rng.chance(0.9)) {
        const acc = pickAccount(t, rng);
        paymentMethod = { singlePayment: { amount: paid, paymentTo: acc._id }, multiplePayment: [] };
        payments.push([acc, netPaid]);
      } else {
        const a = pickAccount(t, rng);
        let b = pickAccount(t, rng);
        if (b === a) b = t.accounts[(t.accounts.indexOf(a) + 1) % 4];
        const first = r2(Math.floor(paid * 0.6));
        paymentMethod = { singlePayment: null, multiplePayment: [{ amount: first, paymentTo: a._id }, { amount: r2(paid - first), paymentTo: b._id }] };
        payments.push([a, Math.min(first, netPaid)], [b, r2(netPaid - Math.min(first, netPaid))]);
      }
    } else paymentMethod = { singlePayment: null, multiplePayment: [] };

    const seller = t.staff[t.staffZipf.sample()];
    const invoiceNumber = `INV-${t.prefix}-${pad(nextSeq(t, "SALES_INVOICE"))}`;
    const sale = {
      _id, tenantId: t._id, date, ...(salesType.endsWith("order") && { deliveryDate: new Date(date.getTime() + rng.int(1, 5) * L.DAY) }),
      invoiceNumber,
      customerType: customer
        ? { type: "listed", walking: null, customerId: customer._id }
        : { type: "walking", walking: rng.chance(0.4) ? { customerName: L.personName(rng), mobileNumber: L.bdMobile(rng.int(1, 99999999), 7), address: rng.chance(0.3) ? L.address(rng) : undefined } : null },
      searchItem: lines, salesMen: t.employees[t.employeeZipf.sample()], createdBy: seller._id,
      discountGivenBy: seller._id,
      invoiceStatus: rng.weighted([["complete", 88], ["pending", 7], ["draft", 5]]),
      ...(rng.chance(0.1) && { remark: L.sentence(rng, 3, 12) }), sendSms: rng.chance(0.2),
      total: r2(sumNet), return: 0, discountPercent, vatPercent, deliveryCost, labourCost, lessTaka,
      customerAdvancePaymentAdjust: advAdj, payable, paid, changes, netPaid, presentDue, previousDue,
      balance: r2(previousDue + presentDue), paymentMethod, paymentStatus, salesType,
      createdAt, updatedAt: rng.chance(0.05) ? new Date(Math.min(L.NOW, createdAt.getTime() + rng.int(1, 30) * L.DAY)) : createdAt, __v: 0,
    };

    // Sales return (~3%): refund at net price less invoice percent and less-taka share
    let ret = null;
    const saleLines = lines.filter((l) => l.salesStatus === "sale");
    if (rng.chance(cfg.returnRate) && saleLines.length) {
      const line = rng.pick(saleLines);
      const qty = rng.int(1, line.quantity);
      line.salesStatus = "return";
      const unitNet = line.discountType === "amount" ? line.salesRate - line.discount : line.salesRate * (1 - line.discount / 100);
      const grossReturn = r2(unitNet * qty);
      const discountAmount = r2((grossReturn * discountPercent) / 100);
      const lessShare = r2(units ? (lessTaka * qty) / units : 0);
      const totalReturn = r2(Math.max(0, grossReturn - discountAmount - lessShare));
      sale.return = totalReturn;
      const rat = new Date(Math.min(L.NOW, createdAt.getTime() + rng.int(0, 20) * L.DAY + rng.int(0, 36e5)));
      const acc = t.accounts[0];
      const rid = L.oidAt(rat);
      const ledger = txn(t, rat, { account: acc, type: "cash payment", amount: totalReturn, category: t.customTxnCats[4]._id, description: `Sales return — invoice ${invoiceNumber}`, salesReturnReference: rid });
      ret = {
        _id: rid, tenantId: t._id, returnId: `RET-${t.prefix}-${pad(nextSeq(t, "SALES_RETURN"))}`, invoiceNumber: _id,
        refundMethod: acc._id, transaction: ledger._id,
        returnReason: rng.pick(["Size problem", "Damaged product", "Customer changed mind", "Wrong colour", "Quality issue"]),
        allproduct: [{ _id: new ObjectId(), product: line.productId, variant: line.variantId || null, quantity: qty, unitPrice: r2(unitNet), subtotal: grossReturn }],
        grossReturnAmount: grossReturn, discountPercent, discountAmount, lessTakaShare: lessShare, totalReturnAmount: totalReturn,
        date: rat, createdAt: rat, updatedAt: rat, __v: 0,
      };
      await w.add(C.salesReturns, ret);
      await w.add(C.crateTransactions, ledger);
    }

    await w.add(C.sales, sale);
    for (const [acc, amount] of payments) {
      if (amount <= 0) continue;
      await w.add(C.crateTransactions, txn(t, createdAt, { account: acc, type: "cash recived", amount, category: t.txnCats.salesPayment, description: `Sale payment — invoice ${invoiceNumber}`, saleReference: _id }));
    }
    t.salesCount = (t.salesCount || 0) + 1;
    t.recentSaleIds = t.recentSaleIds || [];
    if (rng.chance(0.002)) t.recentSaleIds.push(_id);
    if (i % 200000 === 0 && i) console.log(`[seed] sales ${i}/${N}`);
  }
  // worst-case customer per tenant (most invoices)
  for (const t of tenants) {
    let best = null;
    for (const [k, n] of custInvoices) if (k.startsWith(`${t.slug}:`) && (!best || n > best[1])) best = [k.split(":")[1], n];
    stats.worstCase[t.slug] = { ...(stats.worstCase[t.slug] || {}), topCustomer: best && { id: best[0], invoices: best[1] }, sales: t.salesCount || 0 };
  }
}

// ── Purchases ────────────────────────────────────────────────────────────────
async function seedPurchases(w, tenants, cfg, rng, C, stats) {
  const pickTenant = tenantPicker(tenants, rng);
  const N = cfg.purchases;
  const supCount = new Map();
  for (let i = 0; i < N; i++) {
    const t = pickTenant();
    const at = L.dateAt(L.dayFraction((i + rng.next()) / N), rng);
    const _id = L.oidAt(at);
    const supplierId = t.suppliers[t.supplierZipf.sample()];
    supCount.set(`${t.slug}:${supplierId}`, (supCount.get(`${t.slug}:${supplierId}`) || 0) + 1);
    const nLines = rng.weighted([[1, 10], [3, 25], [5, 25], [10, 20], [20, 12], [40, 8]]);
    const allproduct = [];
    let subTotal = 0;
    let first = null;
    const seen = new Set();
    for (let k = 0; k < nLines; k++) {
      const { p, v } = pickLine(t, rng);
      const key = String(v ? v._id : p._id);
      if (seen.has(key)) continue;
      seen.add(key);
      first = first || p;
      const quantity = rng.int(5, 200);
      const purchasePrice = v ? v.pp : p.pp;
      const line = r2(purchasePrice * quantity);
      subTotal += line;
      allproduct.push({ _id: new ObjectId(), product: p._id, ...(v && { variant: v._id }), purchasePrice, retailPrice: v ? v.rp : p.rp, wholesalePrice: v ? v.wp : p.wp, subTotal: line, quantity, size: v ? v.size : "N/A", color: v ? v.color : "N/A" });
    }
    const commission = rng.chance(0.2) ? r2(subTotal * 0.02) : 0;
    const shipping = rng.chance(0.3) ? rng.pick([200, 500, 1000]) : 0;
    const payable = r2(subTotal - commission + shipping);
    const status = rng.weighted([["paid", 60], ["partial", 25], ["due", 15]]);
    const paid = status === "paid" ? payable : status === "partial" ? Math.round(payable * rng.float(0.2, 0.8)) : 0;
    const acc = pickAccount(t, rng);
    const doc = {
      _id, tenantId: t._id, serial: `PUR-${t.prefix}-${pad(nextSeq(t, "PURCHASE_SERIAL"))}`,
      invoiceNumber: `PI-${t.prefix}-${String(i + 1).padStart(7, "0")}`, date: at, supplierId, cashType: acc._id,
      allproduct, subTotal: r2(subTotal), commission, shipping, payable, dueamount: r2(payable - paid), paid,
      paymentStatus: status, category: first.cat, ...(first.sub && { subCategory: first.sub }), ...(first.brand && { brand: first.brand }),
      createdAt: at, updatedAt: at, __v: 0,
    };
    await w.add(C.purchases, doc);
    if (paid > 0) await w.add(C.crateTransactions, txn(t, at, { account: acc, type: "cash payment", amount: paid, category: t.txnCats.purchasePayment, description: `Purchase payment — ${doc.invoiceNumber}`, purchaseReference: _id }));
  }
  for (const t of tenants) {
    let best = null;
    for (const [k, n] of supCount) if (k.startsWith(`${t.slug}:`) && (!best || n > best[1])) best = [k.split(":")[1], n];
    stats.worstCase[t.slug] = { ...(stats.worstCase[t.slug] || {}), topSupplier: best && { id: best[0], purchases: best[1] } };
  }
}

// ── Orders (storefront + POS) ────────────────────────────────────────────────
const STATUS_BY_AGE = (ageDays, rng) =>
  ageDays < 2
    ? rng.weighted([["Pending", 50], ["Confirmed", 25], ["Hold", 5], ["Packaging", 15], ["Cancelled", 5]])
    : ageDays < 7
      ? rng.weighted([["Courier", 25], ["CourierPending", 10], ["Shipped", 25], ["Delivered", 30], ["Cancelled", 10]])
      : rng.weighted([["Delivered", 82], ["Cancelled", 13], ["Pending", 2], ["Shipped", 3]]);

async function seedOrders(w, tenants, cfg, rng, C) {
  const pickTenant = tenantPicker(tenants, rng);
  const N = cfg.orders;
  for (let i = 0; i < N; i++) {
    const t = pickTenant();
    const at = L.dateAt(L.dayFraction((i + rng.next()) / N), rng);
    const _id = L.oidAt(at);
    const web = rng.chance(0.65);
    const loggedIn = web && rng.chance(0.7);
    const items = [];
    let total = 0;
    let qty = 0;
    for (let k = rng.weighted([[1, 55], [2, 25], [3, 12], [4, 8]]); k > 0; k--) {
      const { p, v } = pickLine(t, rng);
      const quantity = rng.weighted([[1, 75], [2, 18], [3, 7]]);
      const price = v ? v.rp : p.rp;
      total += price * quantity;
      qty += quantity;
      // The controller stores the populated product/variant document itself
      const productSnap = { _id: p._id, name: p.name, slug: L.slugify(p.name), category: { _id: p.cat }, brand: p.brand ? { _id: p.brand } : null, retailPrice: p.rp, wholesalePrice: p.wp, purchasePrice: p.pp, barCode: p.barCode, variantType: p.multi ? "multipleVariant" : "singleVariant", thumbnail: L.image(rng, "product"), stock: rng.int(0, 100), isActive: true, totalSales: rng.int(0, 500), description: L.sentence(rng, 20, 60) };
      items.push(v
        ? { variant: { _id: v._id, variantName: `${p.name} - ${v.color} / ${v.size}`, barCode: v.barCode, retailPrice: v.rp, purchasePrice: v.pp, size: v.size, color: v.color, product: productSnap }, quantity, totalPrice: price * quantity, retailPrice: v.rp, purchasePrice: v.pp, size: v.size, color: v.color, product: p._id, orderType: "multivariant" }
        : { product: productSnap, quantity, totalPrice: price * quantity, retailPrice: p.rp, purchasePrice: p.pp, size: "N/A", color: "N/A", variant: null, orderType: "singlevariant" });
    }
    const zone = rng.weighted([["inside_dhaka", 60], ["outside_dhaka", 30], ["sub_area", 10]]);
    const delivery = t.deliveries[zone === "inside_dhaka" ? 0 : zone === "outside_dhaka" ? 1 : 2];
    const discountAmount = rng.chance(0.08) ? Math.round(total * 0.1) : 0;
    const ageDays = (L.NOW - at.getTime()) / L.DAY;
    const orderStatus = STATUS_BY_AGE(ageDays, rng);
    const paymentMethod = web && rng.chance(0.15) ? "sslcommerz" : "cod";
    const paymentStatus = orderStatus === "Delivered" ? "success" : orderStatus === "Cancelled" ? rng.pick(["cancelled", "failed", "Pending"]) : "Pending";
    const shipped = ["Courier", "CourierPending", "Shipped", "Delivered"].includes(orderStatus);
    await w.add(C.orders, {
      _id, tenantId: t._id, user: loggedIn ? t.shoppers[Math.floor(rng.next() * t.shoppers.length)] : null,
      guestId: web && !loggedIn ? `guest_${rng.digits(12)}` : null, items,
      shippingInfo: { fullName: L.personName(rng), phone: L.bdMobile(rng.int(1, 99999999), 7), address: L.address(rng), email: rng.chance(0.4) ? `o${i}@mail.perf` : undefined, country: "Bangladesh", deliveryZone: zone },
      productWeight: 0, deliveryCharge: delivery._id, coupon: null, totalAmount: total, discountAmount,
      finalAmount: total - discountAmount + delivery.charge, paymentMethod, paymentStatus,
      transactionId: paymentMethod === "sslcommerz" ? `SSL${rng.digits(14)}` : null, valId: null, currency: "BDT",
      paymentGatewayData: {}, orderStatus, invoiceId: `${t.prefix}-${_id.toHexString().slice(-8).toUpperCase()}`,
      courier: shipped ? { name: rng.pick(["steadfast", "pathao", "redx"]), trackingId: `TRK${rng.digits(10)}`, rawResponse: null, status: orderStatus === "Delivered" ? "delivered" : "in_transit" } : { name: null, trackingId: null, rawResponse: null, status: "pending" },
      orderType: "complete", channel: web ? "web" : "pos",
      orderFrom: web ? "Website" : rng.weighted([["Facebook", 50], ["WhatsApp", 20], ["Phone", 25], ["Instagram", 5]]),
      placedBy: web ? null : t.staff[t.staffZipf.sample()]._id, followUp: rng.chance(0.2) ? t.staff[t.staffZipf.sample()]._id : null,
      isAutoPlaced: false, totalQuantity: qty, createdAt: at,
      updatedAt: new Date(Math.min(L.NOW, at.getTime() + rng.int(0, 5) * L.DAY)), __v: 0,
    });
  }
}

// ── Payments, stock, sms, transfers, returns, daily cash ────────────────────
async function seedMisc(w, tenants, cfg, rng, C) {
  const pickTenant = tenantPicker(tenants, rng);

  for (let i = 0, N = cfg.customerPayments; i < N; i++) {
    const t = pickTenant();
    const at = L.dateAt(L.dayFraction((i + rng.next()) / N), rng);
    const _id = L.oidAt(at);
    const c = t.customers[t.customerZipf.sample()];
    const before = rng.int(500, 50000);
    const paidAmount = Math.min(before, rng.pick([500, 1000, 2000, 5000, 10000]));
    const lessAmount = rng.chance(0.1) ? Math.min(before - paidAmount, 100) : 0;
    const acc = pickAccount(t, rng);
    await w.add(C.customerPayments, {
      _id, tenantId: t._id, paymentId: `CPR-${t.prefix}-${pad(nextSeq(t, "CUSTOMER_PAYMENT"))}`, customer: c._id,
      referenceInvoice: rng.chance(0.5) ? `INV-${t.prefix}-${pad(rng.int(1, Math.max(1, t.seq.SALES_INVOICE || 1)))}` : "",
      dueBeforePayment: before, remainingDue: before - paidAmount - lessAmount, paidAmount, lessAmount, cashBack: 0,
      date: at, paymentMode: acc._id, remarks: "", isActive: true, deletedAt: null, createdAt: at, updatedAt: at, __v: 0,
    });
    await w.add(C.crateTransactions, txn(t, at, { account: acc, type: "cash recived", amount: paidAmount, category: t.txnCats.customerPayment, description: "Customer due payment", customerPaymentReference: _id }));
  }

  for (let i = 0, N = cfg.customerAdvances; i < N; i++) {
    const t = pickTenant();
    const at = L.dateAt(L.dayFraction((i + rng.next()) / N), rng);
    const _id = L.oidAt(at);
    const acc = pickAccount(t, rng);
    const paidAmount = rng.pick([1000, 2000, 5000, 10000]);
    await w.add(C.customerAdvances, {
      _id, tenantId: t._id, paymentId: `CAP-${t.prefix}-${pad(nextSeq(t, "CUSTOMER_ADVANCE_PAYMENT"))}`,
      customer: t.customers[t.customerZipf.sample()]._id, balance: paidAmount, paidAmount, advanceCashBack: 0,
      paymentMode: acc._id, date: at, remarks: "", isActive: true, deletedAt: null, createdAt: at, updatedAt: at, __v: 0,
    });
    await w.add(C.crateTransactions, txn(t, at, { account: acc, type: "cash recived", amount: paidAmount, category: t.txnCats.customerAdvance, description: "Customer advance", customerAdvancePaymentReference: _id }));
  }

  for (let i = 0, N = cfg.supplierPayments; i < N; i++) {
    const t = pickTenant();
    const at = L.dateAt(L.dayFraction((i + rng.next()) / N), rng);
    const _id = L.oidAt(at);
    const acc = pickAccount(t, rng);
    const paidAmount = rng.pick([5000, 10000, 20000, 50000]);
    const seq = nextSeq(t, "SUPPLIER_PAYMENT");
    await w.add(C.supplierPayments, {
      _id, tenantId: t._id, supplierPaymentSerialId: `SPAY-${t.prefix}-${pad(seq)}`, transactionId: `TXN-${t.prefix}-${seq}`,
      date: at, supplierId: t.suppliers[t.supplierZipf.sample()], paidAmount, lessAmount: 0, paymentMode: acc._id,
      remarks: "", remainingDue: rng.int(0, 200000), isActive: true, deletedAt: null, createdAt: at, updatedAt: at, __v: 0,
    });
    await w.add(C.crateTransactions, txn(t, at, { account: acc, type: "cash payment", amount: paidAmount, category: t.txnCats.supplierPayment, description: "Supplier payment", supplierPaymentReference: _id }));
  }

  // Manual cash book entries (rent, salary, bills)
  for (let i = 0, N = cfg.manualTxns; i < N; i++) {
    const t = pickTenant();
    const at = L.dateAt(L.dayFraction((i + rng.next()) / N), rng);
    const cat = rng.pick(t.customTxnCats);
    await w.add(C.crateTransactions, txn(t, at, { account: pickAccount(t, rng), type: cat.allowedType, amount: rng.pick([500, 1500, 5000, 20000, 45000]), category: cat._id, description: cat.name, voucherNumber: `V-${rng.digits(6)}` }));
  }

  for (let i = 0, N = cfg.stockAdjusts; i < N; i++) {
    const t = pickTenant();
    const at = L.dateAt(L.dayFraction((i + rng.next()) / N), rng);
    const { p, v } = pickLine(t, rng);
    const inc = rng.chance(0.4);
    await w.add(C.stockAdjusts, {
      _id: L.oidAt(at), tenantId: t._id, productId: p._id, ...(v && { variantId: v._id }),
      adjustReason: rng.pick(["Damaged", "Stock count correction", "Lost", "Found in store", "Expired"]),
      increaseQuantity: inc ? rng.int(1, 20) : 0, decreaseQuantity: inc ? 0 : rng.int(1, 10), date: at, __v: 0,
    });
  }

  for (let i = 0, N = cfg.smsLogs; i < N; i++) {
    const t = pickTenant();
    const at = L.dateAt(L.dayFraction((i + rng.next()) / N), rng);
    const bulk = rng.chance(0.25);
    const n = bulk ? rng.int(20, 400) : 1;
    const recipients = [];
    let failed = 0;
    for (let k = 0; k < n; k++) {
      const c = t.customers[t.customerZipf.sample()];
      const ok = rng.chance(0.96);
      if (!ok) failed++;
      recipients.push({ _id: new ObjectId(), customerId: c._id, name: L.personName(rng), phone: L.bdMobile(rng.int(1, 99999999), 3), status: ok ? "sent" : "failed", error: ok ? "" : "Invalid number" });
    }
    await w.add(C.smsLogs, {
      _id: L.oidAt(at), tenantId: t._id, jobId: rng.digits(6), type: bulk ? "bulk" : "single",
      recipientType: rng.weighted([["due", 40], ["sales", 40], ["order", 15], ["logged", 5]]), recipients,
      message: L.sentence(rng, 10, 30), totalCount: n, sentCount: n - failed, failedCount: failed,
      status: failed === 0 ? "completed" : failed === n ? "failed" : "partial", triggeredBy: "admin",
      sentBy: t.staff[0]._id, sentByName: t.ownerName, createdAt: at, updatedAt: at, __v: 0,
    });
  }

  for (let i = 0, N = cfg.moneyTransfers; i < N; i++) {
    const t = pickTenant();
    const at = L.dateAt(L.dayFraction((i + rng.next()) / N), rng);
    const from = pickAccount(t, rng);
    let to = pickAccount(t, rng);
    if (to === from) to = t.accounts[(t.accounts.indexOf(from) + 1) % t.accounts.length];
    await w.add(C.moneyTransfers, {
      _id: L.oidAt(at), tenantId: t._id, transferSerialId: `MTRF-${t.prefix}-${pad(nextSeq(t, "MONEY_TRANSFER_SERIAL"))}`,
      Date: at, fromAccount: from._id, toAccount: to._id, transactionDesction: "Fund transfer",
      amount: rng.pick([1000, 5000, 10000, 50000]), voucherNumber: `MT-${rng.digits(5)}`, createdAt: at, updatedAt: at, __v: 0,
    });
  }

  for (let i = 0, N = cfg.purchaseReturns; i < N; i++) {
    const t = pickTenant();
    const at = L.dateAt(L.dayFraction((i + rng.next()) / N), rng);
    const allproduct = [];
    let total = 0;
    for (let k = rng.int(1, 4); k > 0; k--) {
      const { p, v } = pickLine(t, rng);
      const quantity = rng.int(1, 20);
      const purchasePrice = v ? v.pp : p.pp;
      total += purchasePrice * quantity;
      allproduct.push({ _id: new ObjectId(), product: p._id, ...(v && { variant: v._id }), quantity, purchasePrice, subtotal: purchasePrice * quantity });
    }
    await w.add(C.purchaseReturns, {
      _id: L.oidAt(at), tenantId: t._id, serial: `PRET-${t.prefix}-${pad(nextSeq(t, "PURCHASE_RETURN"))}`,
      supplier: t.suppliers[t.supplierZipf.sample()], returnDate: at, cashType: pickAccount(t, rng)._id, remarks: "",
      totalReturnAmount: total, dueReduced: 0, allproduct, createdAt: at, updatedAt: at, __v: 0,
    });
  }

  // One cash summary per store per day
  for (const t of tenants) {
    let opening = 0;
    for (let d = L.SPAN_DAYS; d >= 0; d--) {
      const day = new Date(Math.floor((L.NOW - d * L.DAY) / L.DAY) * L.DAY - 6 * 36e5); // Dhaka midnight
      const rec = Math.round(rng.float(0.5, 1.5) * 20000 * t.share * 10);
      const pay = Math.round(rec * rng.float(0.3, 0.9));
      await w.add(C.dailyCash, { _id: L.oidAt(day), tenantId: t._id, date: day, openingBalance: opening, totalReceive: rec, totalPayment: pay, closingBalance: opening + rec - pay, createdAt: day, updatedAt: day, __v: 0 });
      opening += rec - pay;
    }
  }
}

// ── Audit log (180-day TTL: keep inside the retention window) ───────────────
const ENTITY = [["product", 30], ["customer", 20], ["sales", 20], ["order", 15], ["user", 5], ["stockadjust", 6], ["coupon", 4]];
const ACTION = [["UPDATE", 35], ["CREATE", 30], ["LOGIN", 14], ["PAYMENT", 7], ["DELETE", 5], ["STOCK_ADJUST", 4], ["STATUS_CHANGE", 3], ["LOGIN_FAILED", 1], ["LOGOUT", 1]];
const FIELDS = ["retailPrice", "stock", "name", "isActive", "purchasePrice", "mobileNumber", "orderStatus", "discount", "paid"];
const UA = ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0 Safari/537.36", "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/127.0 Mobile Safari/537.36", "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 Version/17.5 Safari/605.1.15"];

async function seedAudit(w, tenants, cfg, rng, C) {
  const pickTenant = tenantPicker(tenants, rng);
  const N = cfg.auditLogs;
  const retention = cfg.auditRetentionDays;
  for (let i = 0; i < N; i++) {
    const t = pickTenant();
    const at = L.dateAt(L.dayFraction((i + rng.next()) / N), rng, retention);
    const action = rng.weighted(ACTION);
    const auth = action.startsWith("LOG");
    const type = auth ? "user" : rng.weighted(ENTITY);
    const u = t.staff[t.staffZipf.sample()];
    let entityId;
    if (type === "product") entityId = t.products[t.productZipf.sample()]._id;
    else if (type === "customer") entityId = t.customers[t.customerZipf.sample()]._id;
    else if (type === "user") entityId = u._id;
    else entityId = new ObjectId();
    const doc = {
      _id: L.oidAt(at), tenantId: t._id,
      user: { id: u._id, name: u.name, email: u.email, roles: ["owner"] }, action,
      entity: { type, id: entityId, label: `${type} ${String(entityId).slice(-6)}` },
      meta: { ip: `103.${rng.int(1, 254)}.${rng.int(1, 254)}.${rng.int(1, 254)}`, userAgent: rng.pick(UA), method: auth ? "POST" : rng.pick(["POST", "PUT", "PATCH", "DELETE"]), path: `/api/v1/${type}/${String(entityId)}`, requestId: rng.digits(16) },
      createdAt: at,
    };
    if (action === "UPDATE" || action === "STATUS_CHANGE" || action === "STOCK_ADJUST") {
      doc.changes = Array.from({ length: rng.int(1, 4) }, () => ({ field: rng.pick(FIELDS), before: rng.int(0, 5000), after: rng.int(0, 5000) }));
    } else if (action === "CREATE") {
      doc.after = { name: `${type} ${rng.digits(4)}`, price: rng.int(100, 5000), isActive: true, note: L.sentence(rng, 5, 20) };
    } else if (action === "DELETE") {
      doc.before = { name: `${type} ${rng.digits(4)}`, price: rng.int(100, 5000), isActive: true };
    }
    await w.add(C.auditLogs, doc);
  }
}

module.exports = { seedSales, seedPurchases, seedOrders, seedMisc, seedAudit };
