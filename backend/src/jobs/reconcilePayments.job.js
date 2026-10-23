"use strict";

const cron = require("node-cron");
const Order = require("../models/order.model");
const { runAsPlatform, runForTenant } = require("../tenancy/context");
const { reconcilePayment, releasePayment } = require("../service/onlinePayment.service");

// An online-payment order whose shopper never came back from the gateway (tab
// closed, connection lost, IPN not delivered) still holds its stock. Every few
// minutes, orders left Pending past QUIET_MINUTES are checked with the gateway:
// paid ones are settled, failed ones released. One the gateway still has no
// answer for after EXPIRE_HOURS is given up, so its stock is not held forever.
// If the payment does turn up later, settling it takes the stock again.
const QUIET_MINUTES = 30;
const EXPIRE_HOURS = 24;
const BATCH = 200;

async function reconcilePayments(now = new Date()) {
  try {
    // The search spans stores, so it reads the raw collection in platform
    // scope; each order is then handled inside its own store's context
    const stale = await runAsPlatform(() =>
      Order.collection
        .find({
          paymentMethod: "sslcommerz",
          paymentStatus: "Pending",
          orderStatus: { $ne: "Cancelled" },
          "paymentGatewayData.review": { $exists: false },
          createdAt: { $lt: new Date(now.getTime() - QUIET_MINUTES * 60 * 1000) },
        })
        .project({ _id: 1, tenantId: 1 })
        .limit(BATCH)
        .toArray(),
    );

    let settled = 0;
    for (const { _id, tenantId } of stale) {
      try {
        await runForTenant(tenantId, async () => {
          const order = await Order.findById(_id);
          if (!order) return;
          const result = await reconcilePayment(order, "failed");
          const expired = order.createdAt < new Date(now.getTime() - EXPIRE_HOURS * 60 * 60 * 1000);
          if (result === "pending" && expired) {
            await releasePayment(order, "cancelled", { expired: true, recordedAt: now });
          }
          if (result !== "pending") settled += 1;
        });
      } catch (err) {
        console.error(`[PaymentReconcile] order ${_id}:`, err.message);
      }
    }
    if (stale.length) console.log(`[PaymentReconcile] checked ${stale.length}, resolved ${settled}`);
  } catch (err) {
    console.error("[PaymentReconcile] Failed:", err.message);
  }
}

// Every 10 minutes
function schedulePaymentReconcile() {
  cron.schedule("*/10 * * * *", () => reconcilePayments(), { timezone: "Asia/Dhaka" });
  console.log("[PaymentReconcile] Scheduler registered — runs every 10 minutes");
}

module.exports = { schedulePaymentReconcile, reconcilePayments, QUIET_MINUTES, EXPIRE_HOURS };
