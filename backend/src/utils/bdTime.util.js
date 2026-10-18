// Bangladesh month boundaries (UTC+6, no DST), so "this month" matches the
// dates sellers and operators see.
const DAY_MS = 24 * 60 * 60 * 1000;
const TZ_OFFSET_MS = 6 * 60 * 60 * 1000;

const startOfMonth = (date) => {
  const local = new Date(date.getTime() + TZ_OFFSET_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - TZ_OFFSET_MS);
};

// "YYYY-MM" of the Bangladesh month a date falls in
const monthKey = (date) => {
  const local = new Date(date.getTime() + TZ_OFFSET_MS);
  return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, "0")}`;
};

// The last `count` month keys, oldest first, ending with the current month
const lastMonthKeys = (now, count) => {
  const local = new Date(now.getTime() + TZ_OFFSET_MS);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() - (count - 1 - i), 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
};

module.exports = { DAY_MS, startOfMonth, monthKey, lastMonthKeys };
