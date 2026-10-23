const Order = require("../models/order.model");
const Product = require("../models/product.model");
const Variant = require("../models/variant.model");
const {
  createPaymentSession,
  validatePayment,
  querySession,
  queryTransaction,
} = require("../integrations/sslcommerz");
const { claimCouponUse, releaseCouponUse } = require("../utils/coupon.util");

/**
 * Online payment (SSLCommerz) for an order, from opening the gateway session
 * to recording what became of it.
 *
 * The one rule: an order is marked paid only on the gateway's own word, read
 * server to server — the Order Validation API for a val_id, or the transaction
 * query for a session. The shopper's browser returning to success/fail/cancel,
 * and the IPN body itself, only say *which* order to ask about. Anyone can POST
 * to those URLs, so none of their fields is taken as a fact.
 *
 * Every state change is a conditional update on the current paymentStatus, so
 * the browser return, the IPN and the reconcile job can arrive in any order, or
 * all at once, and stock and coupon uses move exactly once.
 */

// Validation / query statuses that mean the money was taken
const PAID = ["VALID", "VALIDATED"];
// Statuses that mean this attempt will never be paid
const UNPAID = ["FAILED", "CANCELLED", "UNATTEMPTED", "EXPIRED"];

// What is kept of a gateway answer: enough to trace and refund, no more
const GATEWAY_FIELDS = [
  "status", "tran_id", "val_id", "amount", "store_amount", "currency", "currency_type",
  "currency_amount", "bank_tran_id", "card_type", "card_no", "card_brand", "card_issuer",
  "tran_date", "validated_on", "risk_level", "risk_title", "error",
];
const gatewayRecord = (answer, extra = {}) => ({
  ...Object.fromEntries(GATEWAY_FIELDS.filter((key) => answer?.[key] !== undefined).map((key) => [key, answer[key]])),
  ...extra,
  recordedAt: new Date(),
});

const sameAmount = (a, b) => Math.abs(Number(a) - Number(b)) < 0.01;

// Why a successful validation cannot settle this order, or null when it can
const mismatch = (validation, order) => {
  if (validation.tran_id !== order.invoiceId) return "transaction id does not match the order";
  const currency = order.currency || "BDT";
  if (validation.currency_type !== currency) return `currency ${validation.currency_type} instead of ${currency}`;
  const paid = validation.currency_amount ?? validation.amount;
  if (!sameAmount(paid, order.finalAmount)) return `paid ${paid} instead of ${order.finalAmount}`;
  return null;
};

// ---- stock -----------------------------------------------------------------

const idOf = (ref) => ref?._id ?? ref;

// A line takes stock from its variant when it has one, otherwise its product
const stockOf = (item) =>
  item.variant
    ? { model: Variant, id: idOf(item.variant), field: "stockVariant" }
    : { model: Product, id: idOf(item.product), field: "stock" };

const restoreStock = async (items = []) => {
  for (const item of items) {
    const { model, id, field } = stockOf(item);
    await model.updateOne({ _id: id }, { $inc: { [field]: item.quantity, totalSales: -item.quantity } });
  }
};

// Takes the order's stock again; all or nothing. False when a line is short.
const retakeStock = async (items = []) => {
  const taken = [];
  for (const item of items) {
    const { model, id, field } = stockOf(item);
    const updated = await model.findOneAndUpdate(
      { _id: id, [field]: { $gte: item.quantity } },
      { $inc: { [field]: -item.quantity, totalSales: item.quantity } },
    );
    if (!updated) {
      await restoreStock(taken);
      return false;
    }
    taken.push(item);
  }
  return true;
};

// ---- opening a session -----------------------------------------------------

/**
 * Opens the gateway session for an order that is already saved with its stock
 * taken, and keeps the session key on it. Returns the gateway page URL.
 */
const startPayment = async (order) => {
  const ship = order.shippingInfo ?? {};
  const names = (order.items ?? [])
    .map((item) => item.variant?.variantName || item.product?.name)
    .filter(Boolean);

  const { gatewayUrl, sessionKey } = await createPaymentSession({
    total_amount: order.finalAmount,
    currency: order.currency || "BDT",
    tran_id: order.invoiceId,
    product_name: names.join(", ").slice(0, 250) || "Order",
    product_category: "General",
    product_profile: "general",
    num_of_item: order.totalQuantity || names.length || 1,
    // Listed as required by the gateway docs; 0 = no EMI offered
    emi_option: 0,
    shipping_method: "Courier",
    ship_name: ship.fullName,
    ship_add1: ship.address,
    ship_city: ship.city || "Dhaka",
    ship_postcode: ship.postalCode || "1000",
    ship_country: ship.country || "Bangladesh",
    cus_name: ship.fullName,
    cus_email: ship.email,
    cus_add1: ship.address,
    cus_city: ship.city || "Dhaka",
    cus_postcode: ship.postalCode || "1000",
    cus_country: ship.country || "Bangladesh",
    cus_phone: ship.phone,
  });

  await Order.updateOne({ _id: order._id }, { $set: { sessionKey } });
  return gatewayUrl;
};

// ---- recording the outcome -------------------------------------------------

/**
 * Settles an order from a val_id, after asking the Validation API about it.
 *
 * Returns { result, order } where result is
 *   "success"  — validated and recorded (or it already was)
 *   "failed"   — the gateway does not call this val_id a payment
 *   "review"   — paid, but not the amount or currency the order asked for;
 *                the order is put on Hold for staff, never marked paid
 *   "unknown"  — no online-payment order in this store has that tran_id
 */
const settlePayment = async (valId) => {
  const validation = await validatePayment(valId);
  if (!PAID.includes(validation?.status)) return { result: "failed", order: null };

  const order = await Order.findOne({ invoiceId: validation.tran_id, paymentMethod: "sslcommerz" });
  if (!order) return { result: "unknown", order: null };
  if (order.paymentStatus === "success") return { result: "success", order };

  const problem = mismatch(validation, order);
  if (problem) {
    console.error(`[Payment] ${order.invoiceId} not settled: ${problem}`);
    await Order.updateOne(
      { _id: order._id, paymentStatus: { $ne: "success" } },
      { $set: { orderStatus: "Hold", paymentGatewayData: gatewayRecord(validation, { review: problem }) } },
    );
    return { result: "review", order };
  }

  // Exactly one caller wins this update; the rest find it already settled
  const before = await Order.findOneAndUpdate(
    { _id: order._id, paymentStatus: { $ne: "success" } },
    {
      $set: {
        paymentStatus: "success",
        valId: validation.val_id,
        transactionId: validation.bank_tran_id ?? null,
        paidAt: new Date(),
        paymentGatewayData: gatewayRecord(validation),
      },
    },
    { new: false },
  );
  if (!before) return { result: "success", order };

  // The gateway flags risky cards (risk_level 1): hold the goods until checked
  let orderStatus = String(validation.risk_level) === "1" ? "Hold" : "Confirmed";

  // Paid after the order was given up — by a fail callback, the expiry job or
  // a staff cancel — so its stock is back on the shelf. Take it again; if that
  // is no longer possible the money is still recorded, and staff decide.
  const releasedByPayment = ["failed", "cancelled"].includes(before.paymentStatus);
  if (releasedByPayment || before.orderStatus === "Cancelled") {
    if (!(await retakeStock(before.items))) orderStatus = "Hold";
    if (releasedByPayment && before.coupon) await claimCouponUse(before.coupon).catch(() => {});
  }

  await Order.updateOne({ _id: order._id }, { $set: { orderStatus } });
  return { result: "success", order };
};

/**
 * Gives up an unpaid order: payment marked failed or cancelled, the order
 * cancelled, its stock and coupon use given back. Only from Pending, so a paid
 * order is never touched and nothing is given back twice.
 */
const releasePayment = async (order, status, record) => {
  const before = await Order.findOneAndUpdate(
    // An order held for a payment under review has money behind it: never auto-cancel it
    { _id: order._id, paymentMethod: "sslcommerz", paymentStatus: "Pending", "paymentGatewayData.review": { $exists: false } },
    { $set: { paymentStatus: status, orderStatus: "Cancelled", paymentGatewayData: record } },
    { new: false },
  );
  if (!before) return false;

  // A staff cancel already put the stock back (but not the coupon use)
  if (before.orderStatus !== "Cancelled") await restoreStock(before.items);
  if (before.coupon) await releaseCouponUse(before.coupon);
  return true;
};

// What the gateway says about the order's payment: paid, unpaid or pending
const gatewayOutcome = async (order) => {
  const attempts = [];
  if (order.sessionKey) {
    const session = await querySession(order.sessionKey);
    if (session?.APIConnect === "DONE" && session.tran_id === order.invoiceId) attempts.push(session);
  }
  if (!attempts.length) {
    const byTran = await queryTransaction(order.invoiceId);
    if (byTran?.APIConnect === "DONE" && Array.isArray(byTran.element)) {
      attempts.push(...byTran.element.filter((attempt) => attempt?.tran_id === order.invoiceId));
    }
  }

  const paid = attempts.find((attempt) => PAID.includes(attempt.status) && attempt.val_id);
  if (paid) return { state: "paid", valId: paid.val_id };

  const statuses = attempts.map((attempt) => attempt.status).filter(Boolean);
  if (statuses.length && statuses.every((status) => UNPAID.includes(status))) {
    return { state: "unpaid", status: statuses.at(-1), attempt: attempts.at(-1) };
  }
  return { state: "pending" };
};

/**
 * Brings an online-payment order in line with the gateway. `unpaidAs` is what
 * an unpaid attempt is recorded as ("failed" or "cancelled").
 * Returns "success" | "failed" | "cancelled" | "pending" | "review".
 */
const reconcilePayment = async (order, unpaidAs = "failed") => {
  if (order.paymentStatus === "success") return "success";
  if (order.paymentStatus !== "Pending") return order.paymentStatus;

  const outcome = await gatewayOutcome(order);
  if (outcome.state === "paid") {
    const { result } = await settlePayment(outcome.valId);
    return result === "success" || result === "review" ? result : "pending";
  }
  if (outcome.state === "unpaid") {
    const status = outcome.status === "CANCELLED" ? "cancelled" : unpaidAs;
    await releasePayment(order, status, gatewayRecord(outcome.attempt));
    return status;
  }
  return "pending";
};

module.exports = {
  startPayment,
  settlePayment,
  releasePayment,
  reconcilePayment,
  gatewayRecord,
};
