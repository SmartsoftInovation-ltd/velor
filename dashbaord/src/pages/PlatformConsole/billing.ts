import type { BillingCycle } from "../../platform/types";

// Shared by the create-seller form and the seller's Billing card

export const BILLING_CYCLES = [
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
  { value: "one-time", label: "One-time" },
];

// Next renewal from a start date: one month or one year on
export const nextRenewal = (start: string, cycle: BillingCycle) => {
  if (!start || cycle === "one-time") return "";
  const d = new Date(`${start}T00:00:00Z`);
  if (cycle === "monthly") d.setUTCMonth(d.getUTCMonth() + 1);
  else d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d.toISOString().slice(0, 10);
};
