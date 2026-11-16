const Order = require("../models/order.model");
const Product = require("../models/product.model");
const { apiResponse } = require("../utils/apiResponse");
const { asynchandeler } = require("../lib/asyncHandeler");
const { customError } = require("../lib/CustomError");
const { statusCodes } = require("../constant/constant");
const { getTenantId } = require("../tenancy/context");

/**
 * Public order tracking on the storefront: POST /shop/track with either the
 * invoice number or the phone given at checkout. One key is easier to guess
 * than a pair, so failed lookups are rate limited per key, and the result
 * shows the phone and the street address only in part: enough for the owner
 * to recognise their order, not enough to hand a stranger an address. The
 * response is the shopper's view only: no cost prices, staff, gateway data.
 */

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// BD numbers are compared on their last 10 digits: 01711…, +8801711… and 8801711… match
const phoneKey = (value) => String(value || "").replace(/\D/g, "").slice(-10);
const real = (value) => (value && value !== "N/A" ? String(value) : "");
const imageOf = (doc) => doc?.thumbnail?.url || doc?.image?.[0]?.url || "";

// A snapshot document rather than a bare id
const isDoc = (value) => Boolean(value && typeof value === "object" && ("name" in value || "variantName" in value));
const idOf = (ref) => String(ref?._id ?? ref ?? "");

// The product a line belongs to: the variant's, else the line's own
const productIdOf = (item) => idOf(item.variant?.product) || idOf(item.product);

/**
 * A line as the shopper sees it. The order keeps a snapshot of the variant,
 * but its product may be only an id there, so names and photos missing from
 * the snapshot come from `products` (looked up by id, current catalogue).
 */
const toLine = (item, index, products) => {
  const variant = isDoc(item.variant) ? item.variant : null;
  const product = (isDoc(item.product) ? item.product : null) || products.get(productIdOf(item)) || null;
  const quantity = Number(item.quantity) || 0;
  const unitPrice = Number(item.retailPrice) || 0;
  return {
    id: String(variant?._id || product?._id || index),
    name: variant?.product?.name || product?.name || variant?.variantName || "Item",
    option: variant?.variantName && (variant?.product?.name || product?.name) ? variant.variantName : "",
    image: imageOf(variant) || imageOf(product),
    color: real(variant?.color ?? product?.color),
    size: real(variant?.size ?? product?.size),
    quantity,
    unitPrice,
    total: Number(item.totalPrice) || unitPrice * quantity,
  };
};

// 01747237518 -> 017•••••518
const maskPhone = (value) => {
  const text = String(value || "");
  return text.length > 6 ? `${text.slice(0, 3)}${"•".repeat(text.length - 6)}${text.slice(-3)}` : text;
};
// Only the city: the checkout's city field, else the address's last part
const cityOnly = (ship) => ship.city?.trim() || String(ship.address || "").split(",").map((p) => p.trim()).filter(Boolean).pop() || "";

const PAYMENT_LABEL = { cod: "Cash on delivery", sslcommerz: "Online payment" };

const MAX_ORDERS = 10;
const FIELDS =
  "invoiceId shippingInfo items totalAmount discountAmount finalAmount paymentMethod paymentStatus orderStatus courier createdAt updatedAt";

const toTracked = (order, products) => {
  const lines = (order.items || []).map((item, index) => toLine(item, index, products));
  const subtotal = order.totalAmount ?? lines.reduce((sum, line) => sum + line.total, 0);
  const discount = order.discountAmount ?? 0;
  const total = order.finalAmount ?? subtotal - discount;
  const ship = order.shippingInfo || {};
  return {
    invoice: order.invoiceId,
    status: order.orderStatus,
    placedAt: order.createdAt,
    updatedAt: order.updatedAt,
    recipient: ship.fullName || "",
    phone: maskPhone(ship.phone),
    address: cityOnly(ship),
    paymentMethod: PAYMENT_LABEL[order.paymentMethod] || order.paymentMethod || "",
    paymentStatus: order.paymentStatus || "",
    courier: order.courier?.name || "",
    trackingNumber: order.courier?.trackingId || "",
    lines,
    subtotal,
    discount,
    delivery: Math.max(0, Math.round((total - subtotal + discount) * 100) / 100),
    total,
  };
};

// Orders whose checkout phone ends in the same 10 digits, newest first
const findByPhone = (key) =>
  Order.find({ "shippingInfo.phone": new RegExp(`${key.split("").join("\\D*")}\\D*$`) })
    .sort({ createdAt: -1 })
    .limit(MAX_ORDERS)
    .select(FIELDS)
    .lean();

exports.track = asynchandeler(async (req, res) => {
  if (!getTenantId()) {
    throw new customError("No store named for this request", statusCodes.BAD_REQUEST, "TENANT_CONTEXT_REQUIRED");
  }
  const invoice = typeof req.body?.invoice === "string" ? req.body.invoice.trim() : "";
  const phone = phoneKey(req.body?.phone);
  if (invoice.length > 64 || (!invoice && phone.length < 10)) {
    throw new customError("Enter your invoice number or the phone number used at checkout", statusCodes.BAD_REQUEST);
  }

  const orders = invoice
    ? await Order.find({ invoiceId: new RegExp(`^${escapeRegex(invoice)}$`, "i") }).limit(1).select(FIELDS).lean()
    : await findByPhone(phone);
  if (!orders.length) {
    throw new customError(
      invoice ? "No order matches that invoice number" : "No order matches that phone number",
      statusCodes.NOT_FOUND,
    );
  }

  const ids = [...new Set(orders.flatMap((o) => (o.items || []).map(productIdOf)).filter((id) => /^[a-f\d]{24}$/i.test(id)))];
  const found = ids.length ? await Product.find({ _id: { $in: ids } }).select("name thumbnail image").lean() : [];
  const products = new Map(found.map((p) => [String(p._id), p]));

  return apiResponse.sendSuccess(res, statusCodes.OK, "Orders", {
    orders: orders.map((order) => toTracked(order, products)),
  });
});
