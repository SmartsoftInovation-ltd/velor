const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");
const Order = require("../models/order.model");
const Cart = require("../models/cart.model");
const Product = require("../models/product.model");
const Variant = require("../models/variant.model");
const { currentPricing } = require("../service/flashSale.service");
const Coupon = require("../models/coupon.model");
const DeliveryCharge = require("../models/delivery.model");
const Invoice = require("../models/invoice.model");
const { customError } = require("../lib/CustomError");
const { asynchandeler } = require("../lib/asyncHandeler");
const { apiResponse } = require("../utils/apiResponse");
const { statusCodes } = require("../constant/constant");
const { getGeneralConfig } = require("../integrations/config");
const { emitToTenant } = require("../socket/socket");
const { getTenantId } = require("../tenancy/context");
const { WEBSITE_SOURCE } = require("../models/orderSource.model");
const { claimCouponUse, releaseCouponUse } = require("../utils/coupon.util");
const { startPayment } = require("../service/onlinePayment.service");
const { MIN_AMOUNT, MAX_AMOUNT } = require("../integrations/sslcommerz");

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

// The address fields an order keeps, trimmed and capped; anything else is dropped
const SHIPPING_FIELDS = { fullName: 120, phone: 20, email: 120, address: 300, city: 60, postalCode: 12, note: 300 };
const cleanShipping = (input) =>
  Object.fromEntries(
    Object.entries(SHIPPING_FIELDS)
      .map(([key, max]) => [key, typeof input?.[key] === "string" ? input[key].trim().slice(0, max) : ""])
      .filter(([, value]) => value),
  );

/**
 * Re-prices the cart from current product and variant documents.
 *
 * The cart already stores a `snapshotPrice`, but that was written when the item
 * was added and may be hours old. Re-reading here means the customer is charged
 * the price the shop is currently advertising, and — more importantly — that a
 * tampered cart row cannot set its own price.
 */
const priceCart = async (cart) => {
  // A running flash sale sets the price of the items it lists
  const { priceFor } = await currentPricing();
  const items = [];
  let subtotal = 0;
  let totalQuantity = 0;

  for (const item of cart.items) {
    const quantity = Number(item.quantity) || 0;
    if (quantity < 1) throw new customError("Invalid quantity in cart", statusCodes.BAD_REQUEST);

    if (item.variant) {
      const variant = await Variant.findById(item.variant).populate("product", "name category subcategory brand");
      if (!variant || variant.isActive === false) {
        throw new customError("An item in your cart is no longer available", statusCodes.BAD_REQUEST);
      }
      if ((variant.stockVariant ?? 0) < quantity) {
        throw new customError(`${variant.variantName} is out of stock`, statusCodes.BAD_REQUEST);
      }

      const unitPrice =
        priceFor({ productId: variant.product?._id, variantId: variant._id, retailPrice: variant.retailPrice }) ??
        variant.retailPrice;
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

    const unitPrice = priceFor({ productId: product._id, retailPrice: product.retailPrice }) ?? product.retailPrice;
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

const idText = (ref) => String(ref?._id ?? ref ?? "");

// The catalogue ids a cart line can be matched to a coupon by
const lineRefs = (item) => {
  const product = item.variant ? item.variant.product : item.product;
  return {
    product: idText(product),
    variant: item.variant ? idText(item.variant) : "",
    category: idText(product?.category),
    subcategory: idText(product?.subcategory),
    brand: idText(product?.brand),
  };
};

// The lines a coupon covers: all of them, unless it is limited to some
// products, variants, categories, subcategories or brands
const eligibleLines = (coupon, items) => {
  const scopes = [
    ["applicableProducts", "product"],
    ["applicableVariants", "variant"],
    ["applicableCategories", "category"],
    ["applicableSubCategories", "subcategory"],
    ["applicableBrands", "brand"],
  ].filter(([field]) => coupon[field]?.length);
  if (!scopes.length) return items;

  const allowed = scopes.map(([field, key]) => [new Set(coupon[field].map(String)), key]);
  return items.filter((item) => {
    const refs = lineRefs(item);
    return allowed.some(([ids, key]) => refs[key] && ids.has(refs[key]));
  });
};

/**
 * Validates a coupon and returns what it is worth on this cart.
 *
 * The lookup is tenant-scoped by the plugin, so a code from another shop simply
 * is not found — a customer cannot spend one store's promotion at another.
 * A coupon limited to some products takes its discount off those lines only.
 */
const applyCoupon = async (code, subtotal, items = []) => {
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

  const eligible = eligibleLines(coupon, items);
  if (!eligible.length) {
    throw new customError("This coupon does not apply to the items in your cart", statusCodes.BAD_REQUEST);
  }
  const base = eligible.reduce((sum, item) => sum + item.totalPrice, 0);

  let discountAmount =
    coupon.discountType === "percentage"
      ? (base * coupon.discountValue) / 100
      : coupon.discountValue;

  if (coupon.maxDiscountAmount) discountAmount = Math.min(discountAmount, coupon.maxDiscountAmount);
  // A discount larger than the lines it covers would make the total negative
  discountAmount = Math.min(discountAmount, base);

  return { coupon, discountAmount: Math.round(discountAmount * 100) / 100 };
};

const findCart = (req) => {
  const userId = req.user?._id ?? null;
  const guestId = userId ? null : req.guestId ?? null;
  return { userId, guestId, query: Cart.findOne(userId ? { user: userId } : { guestId }) };
};

// The delivery option the shopper chose, priced from the database
const findDelivery = async (deliveryChargeId) => {
  if (!deliveryChargeId) return null;
  const delivery = mongoose.isValidObjectId(deliveryChargeId)
    ? await DeliveryCharge.findById(deliveryChargeId)
    : null;
  if (!delivery) throw new customError("Choose a valid delivery option", statusCodes.BAD_REQUEST);
  return delivery;
};

const money = (value) => Math.round(value * 100) / 100;

/**
 * The shop's delivery options, for the checkout page to list. The price shown
 * here is a preview: the order reads it again from the database.
 */
exports.deliveryOptions = asynchandeler(async (req, res) => {
  requireStore();
  const options = await DeliveryCharge.find().select("name deliveryCharge description").sort({ deliveryCharge: 1 }).lean();
  return apiResponse.sendSuccess(res, statusCodes.OK, "Delivery options", {
    options: options.map(({ _id, name, deliveryCharge, description }) => ({
      _id,
      name,
      charge: deliveryCharge,
      description: description ?? "",
    })),
  });
});

/**
 * What a coupon is worth on this shopper's saved cart, before placing the
 * order. Nothing is claimed: the order re-checks the coupon when it is placed.
 */
exports.previewCoupon = asynchandeler(async (req, res) => {
  requireStore();
  const { couponCode, deliveryChargeId } = req.body ?? {};
  if (typeof couponCode !== "string" || !couponCode.trim() || couponCode.length > 64) {
    throw new customError("Enter a coupon code", statusCodes.BAD_REQUEST);
  }

  const cart = await findCart(req).query;
  if (!cart?.items?.length) throw new customError("Your cart is empty", statusCodes.BAD_REQUEST);

  const { items, subtotal } = await priceCart(cart);
  const { coupon, discountAmount } = await applyCoupon(couponCode, subtotal, items);
  const delivery = await findDelivery(deliveryChargeId);
  const deliveryAmount = delivery?.deliveryCharge ?? 0;

  return apiResponse.sendSuccess(res, statusCodes.OK, "Coupon applied", {
    code: coupon.code,
    subtotal,
    discountAmount,
    deliveryCharge: deliveryAmount,
    finalAmount: money(subtotal - discountAmount + deliveryAmount),
  });
});

exports.createOrder = asynchandeler(async (req, res) => {
  requireStore();

  const { paymentMethod, couponCode, deliveryChargeId } = req.body;
  const shippingInfo = cleanShipping(req.body.shippingInfo);
  const { userId, guestId, query } = findCart(req);

  if (!shippingInfo.fullName || !shippingInfo.phone || !shippingInfo.address) {
    throw new customError("Name, phone and address are required", statusCodes.BAD_REQUEST);
  }
  if (!["cod", "sslcommerz"].includes(paymentMethod)) {
    throw new customError("Choose a valid payment method", statusCodes.BAD_REQUEST);
  }

  const cart = await query;
  if (!cart?.items?.length) {
    throw new customError("Your cart is empty", statusCodes.BAD_REQUEST);
  }

  const { items, subtotal, totalQuantity } = await priceCart(cart);
  const { coupon, discountAmount } = await applyCoupon(couponCode, subtotal, items);

  // The id names which delivery option was chosen; the price attached to it is
  // read from the database, never from the request.
  const delivery = await findDelivery(deliveryChargeId);
  const deliveryAmount = delivery?.deliveryCharge ?? 0;

  const finalAmount = money(subtotal - discountAmount + deliveryAmount);

  // The gateway only takes amounts in this range
  if (paymentMethod === "sslcommerz" && (finalAmount < MIN_AMOUNT || finalAmount > MAX_AMOUNT)) {
    throw new customError(
      `Online payment is available for orders from ৳${MIN_AMOUNT} to ৳${MAX_AMOUNT}`,
      statusCodes.BAD_REQUEST,
    );
  }

  const general = await getGeneralConfig();
  const invoiceId = `${general.invoicePrefix}-${uuidv4().slice(0, 8).toUpperCase()}`;

  // Lines whose stock was already taken, so a failure further on can give it back
  const taken = [];
  let couponClaimed = false;
  let order = null;
  let gatewayUrl = null;
  try {
    // The coupon's use is claimed before the order exists: under parallel
    // checkouts only as many succeed as the usage limit allows
    if (coupon) {
      await claimCouponUse(coupon._id);
      couponClaimed = true;
    }

    // tenantId is stamped by the tenancy plugin from the request's context, which
    // came from the hostname — so the order lands in the store the shopper was on.
    order = await Order.create({
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
      // Taken on the storefront, so reports can tell it apart from a counter sale
      channel: "web",
      orderFrom: WEBSITE_SOURCE,
      // Waits in the dashboard's notification bell until staff open it
      staffSeen: false,
      storefrontHost: req.tenantHost ?? null,
    });

    /**
     * Stock is decremented with the quantity re-checked in the filter. The read
     * above is already stale by the time this runs, so two shoppers buying the
     * last unit could both pass it; the `$gte` makes the update simply not match
     * for the second one instead of driving stock negative.
     */
    for (const item of items) {
      const [model, id, field, name] = item.variant
        ? [Variant, item.variant._id, "stockVariant", item.variant.variantName]
        : [Product, item.product._id, "stock", item.product.name];
      const updated = await model.findOneAndUpdate(
        { _id: id, [field]: { $gte: item.quantity } },
        { $inc: { [field]: -item.quantity, totalSales: item.quantity } },
      );
      if (!updated) {
        throw new customError(`${name} sold out while you were checking out`, statusCodes.CONFLICT);
      }
      taken.push({ model, id, field, quantity: item.quantity });
    }

    // Every order has its invoice, whatever the payment method
    await Invoice.create({
      order: order._id,
      invoiceId: order.invoiceId,
      customerDetails: shippingInfo,
      totalAmount: subtotal,
      ProductInfo: items,
      discountAmount,
      deliveryChargeAmount: deliveryAmount,
      finalAmount,
    });

    // Opened last: if the gateway refuses, nothing above is kept
    if (paymentMethod === "sslcommerz") {
      gatewayUrl = await startPayment(order).catch((error) => {
        // The gateway's reason can name the store's account setup; it is logged, not shown
        console.error(`[Payment] session for ${invoiceId} failed:`, error.message);
        if (error.statusCode) throw error;
        throw new customError(
          "Online payment could not be started. Please try again or choose cash on delivery.",
          502,
        );
      });
    }
  } catch (error) {
    // Nothing of a failed checkout may stick: the lines already taken go back
    // on the shelf, the order is removed and the coupon use is given back
    for (const line of taken) {
      await line.model.updateOne(
        { _id: line.id },
        { $inc: { [line.field]: line.quantity, totalSales: -line.quantity } },
      );
    }
    if (order) {
      await Invoice.deleteOne({ order: order._id });
      await Order.deleteOne({ _id: order._id });
    }
    if (couponClaimed) await releaseCouponUse(coupon._id);
    throw error;
  }

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
      paymentStatus: order.paymentStatus,
    },
    // Where to send the shopper to pay; null for cash on delivery
    gatewayUrl,
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
    .select("invoiceId orderStatus paymentStatus paymentMethod createdAt finalAmount -_id")
    .lean();
  if (!order) throw new customError("Order not found", statusCodes.NOT_FOUND);

  return apiResponse.sendSuccess(res, statusCodes.OK, "Order status", { order });
});
