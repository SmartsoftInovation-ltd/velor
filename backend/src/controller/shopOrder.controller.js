const { v4: uuidv4 } = require("uuid");
const Order = require("../models/order.model");
const Cart = require("../models/cart.model");
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

/**
 * Checkout from the storefront.
 *
 * The staff endpoint (`/order/createorder`) is for shop employees entering an
 * order on someone's behalf, and trusts its caller accordingly. This one is
 * reachable by anybody on the internet, so it trusts the request for exactly
 * two things: which cart, and where to ship it.
 *
 * Every figure that decides what the customer pays — unit price, line total,
 * delivery, discount, grand total — is read from the database here. A body that
 * carries prices is not rejected; the values are simply never read, which is the
 * safer failure mode when a new field is added to the client later.
 */

const requireStore = () => {
  const tenantId = getTenantId();
  if (!tenantId) {
    throw new customError(
      "No store named for this request",
      statusCodes.BAD_REQUEST,
      "TENANT_CONTEXT_REQUIRED",
    );
  }
  return tenantId;
};

/**
 * Re-prices the cart from current product and variant documents.
 *
 * The cart already stores a `snapshotPrice`, but that was written when the item
 * was added and may be hours old. Re-reading here means the customer is charged
 * the price the shop is currently advertising, and — more importantly — that a
 * tampered cart row cannot set its own price.
 */
const priceCart = async (cart) => {
  const items = [];
  let subtotal = 0;
  let totalQuantity = 0;

  for (const item of cart.items) {
    const quantity = Number(item.quantity) || 0;
    if (quantity < 1) throw new customError("Invalid quantity in cart", statusCodes.BAD_REQUEST);

    if (item.variant) {
      const variant = await Variant.findById(item.variant).populate("product");
      if (!variant || variant.isActive === false) {
        throw new customError("An item in your cart is no longer available", statusCodes.BAD_REQUEST);
      }
      if ((variant.stockVariant ?? 0) < quantity) {
        throw new customError(`${variant.variantName} is out of stock`, statusCodes.BAD_REQUEST);
      }

      const unitPrice = variant.retailPrice;
      items.push({
        variant,
        product: variant.product?._id ?? null,
        quantity,
        retailPrice: unitPrice,
        totalPrice: unitPrice * quantity,
        orderType: "multiplevariant",
      });
      subtotal += unitPrice * quantity;
      totalQuantity += quantity;
      continue;
    }

    const product = await Product.findById(item.product);
    if (!product || product.isActive === false) {
      throw new customError("An item in your cart is no longer available", statusCodes.BAD_REQUEST);
    }
    if ((product.stock ?? 0) < quantity) {
      throw new customError(`${product.name} is out of stock`, statusCodes.BAD_REQUEST);
    }

    const unitPrice = product.retailPrice;
    items.push({
      product,
      quantity,
      retailPrice: unitPrice,
      totalPrice: unitPrice * quantity,
      orderType: "singlevariant",
    });
    subtotal += unitPrice * quantity;
    totalQuantity += quantity;
  }

  return { items, subtotal, totalQuantity };
};

/**
 * Validates a coupon and returns what it is worth on this cart.
 *
 * The lookup is tenant-scoped by the plugin, so a code from another shop simply
 * is not found — a customer cannot spend one store's promotion at another.
 */
const applyCoupon = async (code, subtotal) => {
  if (!code) return { coupon: null, discountAmount: 0 };

  const coupon = await Coupon.findOne({ code: String(code).trim().toUpperCase() });
  const invalid = new customError("This coupon is not valid", statusCodes.BAD_REQUEST);
  if (!coupon || coupon.isActive === false) throw invalid;

  const now = new Date();
  if (coupon.couponStartAt && now < coupon.couponStartAt) throw invalid;
  if (coupon.expireAt && now > coupon.expireAt) throw invalid;
  if (coupon.usageLimit !== null && coupon.usageLimit !== undefined && coupon.usedCount >= coupon.usageLimit) {
    throw new customError("This coupon has already been fully used", statusCodes.BAD_REQUEST);
  }
  if (subtotal < (coupon.minOrderAmount ?? 0)) {
    throw new customError(
      `This coupon needs a minimum order of ${coupon.minOrderAmount}`,
      statusCodes.BAD_REQUEST,
    );
  }

  let discountAmount =
    coupon.discountType === "percentage"
      ? (subtotal * coupon.discountValue) / 100
      : coupon.discountValue;

  if (coupon.maxDiscountAmount) discountAmount = Math.min(discountAmount, coupon.maxDiscountAmount);
  // A discount larger than the cart would make the total negative
  discountAmount = Math.min(discountAmount, subtotal);

  return { coupon, discountAmount: Math.round(discountAmount * 100) / 100 };
};

exports.createOrder = asynchandeler(async (req, res) => {
  requireStore();

  const { shippingInfo, paymentMethod, couponCode, deliveryChargeId } = req.body;
  const userId = req.user?._id ?? null;
  const guestId = userId ? null : req.guestId ?? null;

  if (!shippingInfo?.fullName || !shippingInfo?.phone || !shippingInfo?.address) {
    throw new customError("Name, phone and address are required", statusCodes.BAD_REQUEST);
  }
  if (!["cod", "sslcommerz"].includes(paymentMethod)) {
    throw new customError("Choose a valid payment method", statusCodes.BAD_REQUEST);
  }

  const cart = await Cart.findOne(userId ? { user: userId } : { guestId });
  if (!cart?.items?.length) {
    throw new customError("Your cart is empty", statusCodes.BAD_REQUEST);
  }

  const { items, subtotal, totalQuantity } = await priceCart(cart);
  const { coupon, discountAmount } = await applyCoupon(couponCode, subtotal);

  // The id names which delivery option was chosen; the price attached to it is
  // read from the database, never from the request.
  const delivery = deliveryChargeId ? await DeliveryCharge.findById(deliveryChargeId) : null;
  if (deliveryChargeId && !delivery) {
    throw new customError("Choose a valid delivery option", statusCodes.BAD_REQUEST);
  }
  const deliveryAmount = delivery?.deliveryCharge ?? 0;

  const finalAmount = Math.round((subtotal - discountAmount + deliveryAmount) * 100) / 100;

  const general = await getGeneralConfig();
  const invoiceId = `${general.invoicePrefix}-${uuidv4().slice(0, 8).toUpperCase()}`;

  // tenantId is stamped by the tenancy plugin from the request's context, which
  // came from the hostname — so the order lands in the store the shopper was on.
  const order = await Order.create({
    user: userId,
    guestId,
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
  });

  /**
   * Stock is decremented with the quantity re-checked in the filter. The read
   * above is already stale by the time this runs, so two shoppers buying the
   * last unit could both pass it; the `$gte` makes the update simply not match
   * for the second one instead of driving stock negative.
   */
  for (const item of items) {
    if (item.variant) {
      const updated = await Variant.findOneAndUpdate(
        { _id: item.variant._id, stockVariant: { $gte: item.quantity } },
        { $inc: { stockVariant: -item.quantity, totalSales: item.quantity } },
      );
      if (!updated) {
        await Order.deleteOne({ _id: order._id });
        throw new customError(`${item.variant.variantName} sold out while you were checking out`, statusCodes.CONFLICT);
      }
    } else {
      const updated = await Product.findOneAndUpdate(
        { _id: item.product._id, stock: { $gte: item.quantity } },
        { $inc: { stock: -item.quantity, totalSales: item.quantity } },
      );
      if (!updated) {
        await Order.deleteOne({ _id: order._id });
        throw new customError(`${item.product.name} sold out while you were checking out`, statusCodes.CONFLICT);
      }
    }
  }

  if (coupon) await Coupon.updateOne({ _id: coupon._id }, { $inc: { usedCount: 1 } });
  await Cart.deleteOne({ _id: cart._id });

  // Reaches this store's dashboard only; the room name carries the tenant id
  emitToTenant(getTenantId(), "orderPlaced", { invoiceId: order.invoiceId, finalAmount });

  return apiResponse.sendSuccess(res, statusCodes.CREATED, "Order placed", {
    order: {
      _id: order._id,
      invoiceId: order.invoiceId,
      totalAmount: order.totalAmount,
      discountAmount: order.discountAmount,
      deliveryCharge: deliveryAmount,
      finalAmount: order.finalAmount,
      orderStatus: order.orderStatus,
      paymentMethod: order.paymentMethod,
    },
  });
});

/**
 * Order tracking for a customer who has the invoice number.
 *
 * Deliberately narrow: it answers only with status, never with the shipping
 * address or contact details, because the invoice number alone is not proof of
 * who is asking.
 */
exports.trackOrder = asynchandeler(async (req, res) => {
  requireStore();

  const order = await Order.findOne({ invoiceId: req.params.invoiceId })
    .select("invoiceId orderStatus paymentStatus createdAt finalAmount")
    .lean();
  if (!order) throw new customError("Order not found", statusCodes.NOT_FOUND);

  return apiResponse.sendSuccess(res, statusCodes.OK, "Order status", { order });
});
