const Order = require("../models/order.model");
const { apiResponse } = require("../utils/apiResponse");
const { asynchandeler } = require("../lib/asyncHandeler");
const { customError } = require("../lib/CustomError");
const { statusCodes } = require("../constant/constant");
const { emitToTenant } = require("../socket/socket");
const { getTenantId } = require("../tenancy/context");

/**
 * The dashboard's notification bell for storefront orders.
 *
 * A web order is created with `staffSeen: false`. The bell counts those and
 * lists the newest; opening one marks it seen for the whole store (the bell is
 * the shop's inbox, not one person's), and every open dashboard of the store
 * is told so its count drops too.
 */

const LIST_LIMIT = 20;

const toNotification = (o) => ({
  _id: o._id,
  invoiceId: o.invoiceId,
  customerName: o.shippingInfo?.fullName || "",
  phone: o.shippingInfo?.phone || "",
  amount: o.finalAmount ?? 0,
  quantity: o.totalQuantity ?? 0,
  createdAt: o.createdAt,
});

// GET /order/web-notifications
exports.list = asynchandeler(async (req, res) => {
  const filter = { staffSeen: false };
  const [count, orders] = await Promise.all([
    Order.countDocuments(filter),
    Order.find(filter)
      .sort({ createdAt: -1 })
      .limit(LIST_LIMIT)
      .select("invoiceId shippingInfo.fullName shippingInfo.phone finalAmount totalQuantity createdAt")
      .lean(),
  ]);
  return apiResponse.sendSuccess(res, statusCodes.OK, "Web order notifications", {
    count,
    notifications: orders.map(toNotification),
  });
});

// PATCH /order/web-notifications/:id/seen
exports.markSeen = asynchandeler(async (req, res) => {
  const order = await Order.findOneAndUpdate(
    { _id: req.params.id },
    { $set: { staffSeen: true } },
    { new: true, projection: { _id: 1 } },
  ).lean();
  if (!order) throw new customError("Order not found", statusCodes.NOT_FOUND);

  emitToTenant(getTenantId(), "webOrderSeen", { orderId: String(order._id) });
  return apiResponse.sendSuccess(res, statusCodes.OK, "Marked as seen");
});

// PATCH /order/web-notifications/seen-all
exports.markAllSeen = asynchandeler(async (req, res) => {
  await Order.updateMany({ staffSeen: false }, { $set: { staffSeen: true } });
  emitToTenant(getTenantId(), "webOrderSeen", { all: true });
  return apiResponse.sendSuccess(res, statusCodes.OK, "All marked as seen");
});
