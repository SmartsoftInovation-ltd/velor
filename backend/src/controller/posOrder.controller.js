const { v4: uuidv4 } = require("uuid");
const Order = require("../models/order.model");
const Product = require("../models/product.model");
const Variant = require("../models/variant.model");
const Coupon = require("../models/coupon.model");
const DeliveryCharge = require("../models/delivery.model");
const { customError } = require("../lib/CustomError");
const { asynchandeler } = require("../lib/asyncHandeler");
const { apiResponse } = require("../utils/apiResponse");
const { statusCodes } = require("../constant/constant");
const { getGeneralConfig } = require("../integrations/config");
const { emitToTenant } = require("../socket/socket");
const { getTenantId } = require("../tenancy/context");
const OrderSource = require("../models/orderSource.model");

/**
 * Counter orders: a staff member taking an order over the phone or in person.
 *
 * The storefront checkout reads its lines from the shopper's saved cart, which
 * is wrong here — a staff member is building the order as they talk, and there
 * is no browser session holding a cart for the customer they are serving. So
 * the lines arrive in the request instead.
 *
 * What does *not* change is where the money comes from. Quantities and which
 * product are the operator's to choose; unit price, discount, delivery and the
 * total are read from the database exactly as on the storefront. A mistyped or
 * tampered price in the request is never read, so the counter cannot
 * accidentally (or deliberately) sell below the shop's own price.
 *
 * Orders land in the same `Order` collection as web orders, tagged
 * `channel: "pos"`, so every existing report, invoice and courier booking keeps
 * working on one query.
 */

const MAX_LINES = 100;

/**
 * Prices the requested lines from current product documents.
 *
 * Mirrors the storefront's pricing deliberately: two ways to take an order must
 * not become two ways to compute a total, or the reports stop agreeing with the
 * invoices.
 */
const priceLines = async (lines) => {
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new customError("Add at least one product", statusCodes.BAD_REQUEST);
  }
  if (lines.length > MAX_LINES) {
    throw new customError(`An order cannot hold more than ${MAX_LINES} lines`, statusCodes.BAD_REQUEST);
  }

  const items = [];
  let subtotal = 0;
  let totalQuantity = 0;

  for (const line of lines) {
    const quantity = Number(line?.quantity);
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new customError("Every line needs a whole quantity of at least 1", statusCodes.BAD_REQUEST);
    }

    if (line.variantId) {
      const variant = await Variant.findById(line.variantId).populate("product");
      if (!variant) throw new customError("A chosen variant no longer exists", statusCodes.NOT_FOUND);
      if ((variant.stockVariant ?? 0) < quantity) {
        throw new customError(`${variant.variantName} does not have enough stock`, statusCodes.BAD_REQUEST);
      }

      const unitPrice = variant.retailPrice;
      items.push({
        variant,
        product: variant.product?._id ?? null,
        quantity,
        retailPrice: unitPrice,
        purchasePrice: variant.purchasePrice,
        totalPrice: unitPrice * quantity,
        orderType: "multiplevariant",
      });
      subtotal += unitPrice * quantity;
      totalQuantity += quantity;
      continue;
    }

    const product = await Product.findById(line?.productId);
    if (!product) throw new customError("A chosen product no longer exists", statusCodes.NOT_FOUND);
    if ((product.stock ?? 0) < quantity) {
      throw new customError(`${product.name} does not have enough stock`, statusCodes.BAD_REQUEST);
    }

    const unitPrice = product.retailPrice;
    items.push({
      product,
      quantity,
      retailPrice: unitPrice,
      purchasePrice: product.purchasePrice,
      totalPrice: unitPrice * quantity,
      orderType: "singlevariant",
    });
    subtotal += unitPrice * quantity;
    totalQuantity += quantity;
  }

  return { items, subtotal, totalQuantity };
};

// Same rules as the storefront; a coupon means the same thing at the counter.
const applyCoupon = async (code, subtotal) => {
  if (!code) return { coupon: null, discountAmount: 0 };

  const coupon = await Coupon.findOne({ code: String(code).trim().toUpperCase() });
  const invalid = new customError("This coupon is not valid", statusCodes.BAD_REQUEST);
  if (!coupon || coupon.isActive === false) throw invalid;

  const now = new Date();
  if (coupon.couponStartAt && now < coupon.couponStartAt) throw invalid;
  if (coupon.expireAt && now > coupon.expireAt) throw invalid;
  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
    throw new customError("This coupon has already been fully used", statusCodes.BAD_REQUEST);
  }
  if (subtotal < (coupon.minOrderAmount ?? 0)) {
    throw new customError(
      `This coupon needs a minimum order of ${coupon.minOrderAmount}`,
      statusCodes.BAD_REQUEST,
    );
  }

  let discountAmount =
    coupon.discountType === "percentage" ? (subtotal * coupon.discountValue) / 100 : coupon.discountValue;
  if (coupon.maxDiscountAmount) discountAmount = Math.min(discountAmount, coupon.maxDiscountAmount);
  discountAmount = Math.min(discountAmount, subtotal);

  return { coupon, discountAmount: Math.round(discountAmount * 100) / 100 };
};

exports.createPosOrder = asynchandeler(async (req, res) => {
  const { items: lines, shippingInfo, paymentMethod, couponCode, deliveryChargeId, orderFrom } = req.body;

  if (!shippingInfo?.fullName || !shippingInfo?.phone) {
    throw new customError("Customer name and phone are required", statusCodes.BAD_REQUEST);
  }
  if (!["cod", "sslcommerz"].includes(paymentMethod)) {
    throw new customError("Choose a valid payment method", statusCodes.BAD_REQUEST);
  }

  // Only a source the shop actually keeps in its list may be stamped on an
  // order, so a typo cannot quietly become a new line in the reports.
  const sourceName = String(orderFrom ?? "").trim();
  if (sourceName && !(await OrderSource.exists({ name: sourceName, isActive: true }))) {
    throw new customError("Choose a valid order source", statusCodes.BAD_REQUEST);
  }

  const { items, subtotal, totalQuantity } = await priceLines(lines);
  const { coupon, discountAmount } = await applyCoupon(couponCode, subtotal);

  const delivery = deliveryChargeId ? await DeliveryCharge.findById(deliveryChargeId) : null;
  if (deliveryChargeId && !delivery) {
    throw new customError("Choose a valid delivery option", statusCodes.BAD_REQUEST);
  }
  const deliveryAmount = delivery?.deliveryCharge ?? 0;

  const finalAmount = Math.round((subtotal - discountAmount + deliveryAmount) * 100) / 100;

  const general = await getGeneralConfig();
  const invoiceId = `${general.invoicePrefix}-${uuidv4().slice(0, 8).toUpperCase()}`;

  const order = await Order.create({
    user: null, // a walk-in customer has no account
    guestId: null,
    items,
    shippingInfo,
    totalAmount: subtotal,
    discountAmount,
    finalAmount,
    deliveryCharge: delivery?._id,
    coupon: coupon?._id,
    paymentMethod,
    paymentStatus: "Pending",
    orderStatus: "Pending",
    invoiceId,
    totalQuantity,
    channel: "pos",
    orderFrom: sourceName,
    placedBy: req.user?._id ?? null,
  });

  /**
   * Stock comes down with the quantity re-checked in the filter, so a counter
   * sale and a web sale racing for the last unit cannot both succeed.
   */
  for (const item of items) {
    const [model, id, field] = item.variant
      ? [Variant, item.variant._id, "stockVariant"]
      : [Product, item.product._id, "stock"];

    const updated = await model.findOneAndUpdate(
      { _id: id, [field]: { $gte: item.quantity } },
      { $inc: { [field]: -item.quantity, totalSales: item.quantity } },
    );
    if (!updated) {
      await Order.deleteOne({ _id: order._id });
      throw new customError("Stock ran out while the order was being saved", statusCodes.CONFLICT);
    }
  }

  if (coupon) await Coupon.updateOne({ _id: coupon._id }, { $inc: { usedCount: 1 } });

  emitToTenant(getTenantId(), "orderPlaced", { invoiceId: order.invoiceId, finalAmount });

  return apiResponse.sendSuccess(res, statusCodes.CREATED, "Order placed", {
    order: {
      _id: order._id,
      invoiceId: order.invoiceId,
      totalAmount: order.totalAmount,
      discountAmount: order.discountAmount,
      deliveryCharge: deliveryAmount,
      finalAmount: order.finalAmount,
      totalQuantity: order.totalQuantity,
      channel: order.channel,
      orderFrom: order.orderFrom,
    },
  });
});

/**
 * A quote for the order being built, before it is saved.
 *
 * The counter screen shows a running total as lines are added. Computing it in
 * the browser would mean two implementations of the same arithmetic drifting
 * apart, so the screen asks the server for the same figures it will charge.
 */
exports.quotePosOrder = asynchandeler(async (req, res) => {
  const { items: lines, couponCode, deliveryChargeId } = req.body;

  const { items, subtotal, totalQuantity } = await priceLines(lines);

  // A coupon that does not apply yet must not block the quote: the operator is
  // still building the order, so this reports the reason instead of failing.
  let discountAmount = 0;
  let couponError = null;
  if (couponCode) {
    try {
      ({ discountAmount } = await applyCoupon(couponCode, subtotal));
    } catch (error) {
      couponError = error.message;
    }
  }

  const delivery = deliveryChargeId ? await DeliveryCharge.findById(deliveryChargeId) : null;
  const deliveryAmount = delivery?.deliveryCharge ?? 0;

  return apiResponse.sendSuccess(res, statusCodes.OK, "Quote", {
    lines: items.map((item) => ({
      productId: item.product?._id ?? item.product ?? null,
      variantId: item.variant?._id ?? null,
      name: item.variant?.variantName ?? item.product?.name ?? "",
      quantity: item.quantity,
      retailPrice: item.retailPrice,
      totalPrice: item.totalPrice,
    })),
    totalQuantity,
    subtotal,
    discountAmount,
    couponError,
    deliveryCharge: deliveryAmount,
    finalAmount: Math.round((subtotal - discountAmount + deliveryAmount) * 100) / 100,
  });
});
