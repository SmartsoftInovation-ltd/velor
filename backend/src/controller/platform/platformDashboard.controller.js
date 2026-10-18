const Tenant = require("../../models/platform/tenant.model");
const User = require("../../models/user.model");
const { asynchandeler } = require("../../lib/asyncHandeler");
const { apiResponse } = require("../../utils/apiResponse");
const { statusCodes } = require("../../constant/constant");
const { DAY_MS, startOfMonth, monthKey, lastMonthKeys } = require("../../utils/bdTime.util");

// The Platform Console dashboard: what the platform has sold to sellers,
// what it earns per month, whose renewal is coming up, and who the sellers
// are. Built from each seller's billing (price per cycle, start and renewal
// dates) set on the seller's page. Runs in platform scope, across stores.

const RENEWAL_WINDOW_DAYS = 30;
const MONTHS = 12;

// What a seller's price is worth per month, for the recurring total
const monthlyValue = ({ price = 0, cycle }) =>
  cycle === "monthly" ? price : cycle === "yearly" ? price / 12 : 0;

exports.getPlatformDashboard = asynchandeler(async (req, res) => {
  const now = new Date();
  const monthStart = startOfMonth(now);

  const tenants = await Tenant.find().sort({ createdAt: -1 }).lean();
  const ownerIds = tenants.map((t) => t.ownerUserId).filter(Boolean);
  const [owners, staffRows] = await Promise.all([
    User.find({ _id: { $in: ownerIds } }).select("name email phone").lean(),
    User.aggregate([{ $group: { _id: "$tenantId", count: { $sum: 1 } } }]),
  ]);
  const ownerById = Object.fromEntries(owners.map((o) => [String(o._id), o]));
  const staffByTenant = Object.fromEntries(staffRows.map((r) => [String(r._id), r.count]));

  const byStatus = { active: 0, provisioning: 0, suspended: 0, cancelled: 0 };
  const byCycle = { monthly: 0, yearly: 0, "one-time": 0 };
  let monthlyRecurring = 0;
  let oneTimeTotal = 0;
  let soldThisMonth = 0;
  let newThisMonth = 0;
  let renewalsDue = 0;
  let renewalsDueAmount = 0;
  let overdue = 0;
  let overdueAmount = 0;

  // Sales by month: a seller counts in the month their billing started
  const monthKeys = lastMonthKeys(now, MONTHS);
  const salesByMonth = Object.fromEntries(monthKeys.map((k) => [k, { amount: 0, sellers: 0 }]));

  const sellers = tenants.map((t) => {
    const billing = { price: 0, cycle: "monthly", startedAt: null, renewsAt: null, ...(t.billing || {}) };
    const live = t.status === "active";
    byStatus[t.status] = (byStatus[t.status] || 0) + 1;
    byCycle[billing.cycle] = (byCycle[billing.cycle] || 0) + 1;

    const startedAt = billing.startedAt ? new Date(billing.startedAt) : new Date(t.createdAt);
    if (t.createdAt >= monthStart) newThisMonth += 1;
    if (t.status !== "cancelled") {
      if (startedAt >= monthStart) soldThisMonth += billing.price;
      const bucket = salesByMonth[monthKey(startedAt)];
      if (bucket) {
        bucket.amount += billing.price;
        bucket.sellers += 1;
      }
    }
    if (live) monthlyRecurring += monthlyValue(billing);
    if (billing.cycle === "one-time" && t.status !== "cancelled") oneTimeTotal += billing.price;

    const renewsAt = billing.cycle === "one-time" || !billing.renewsAt ? null : new Date(billing.renewsAt);
    const daysLeft = renewsAt ? Math.ceil((renewsAt.getTime() - now.getTime()) / DAY_MS) : null;
    if (live && daysLeft !== null) {
      if (daysLeft < 0) {
        overdue += 1;
        overdueAmount += billing.price;
      } else if (daysLeft <= RENEWAL_WINDOW_DAYS) {
        renewalsDue += 1;
        renewalsDueAmount += billing.price;
      }
    }

    const owner = ownerById[String(t.ownerUserId)];
    return {
      _id: t._id,
      name: t.name,
      slug: t.slug,
      status: t.status,
      plan: t.plan,
      price: billing.price,
      cycle: billing.cycle,
      startedAt: billing.startedAt,
      renewsAt,
      daysLeft,
      staff: staffByTenant[String(t._id)] || 0,
      maxStaff: t.limits?.maxStaff ?? null,
      owner: owner ? { name: owner.name, email: owner.email, phone: owner.phone } : null,
      createdAt: t.createdAt,
    };
  });

  const round = (n) => Math.round(n);
  return apiResponse.sendSuccess(res, statusCodes.OK, "Platform dashboard", {
    sellers: {
      total: tenants.length,
      byStatus,
      byCycle,
      newThisMonth,
    },
    revenue: {
      monthlyRecurring: round(monthlyRecurring),
      yearlyRecurring: round(monthlyRecurring * 12),
      oneTimeTotal: round(oneTimeTotal),
      soldThisMonth: round(soldThisMonth),
    },
    renewals: {
      windowDays: RENEWAL_WINDOW_DAYS,
      due: renewalsDue,
      dueAmount: round(renewalsDueAmount),
      overdue,
      overdueAmount: round(overdueAmount),
    },
    salesByMonth: monthKeys.map((month) => ({ month, ...salesByMonth[month] })),
    list: sellers,
    generatedAt: now,
  });
});
