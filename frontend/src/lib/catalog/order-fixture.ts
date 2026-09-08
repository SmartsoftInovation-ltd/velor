import { CART_LINES } from "./cart-fixture";
import type { CartLine } from "./cart-fixture";

export type TrackingStage =
  | "placed"
  | "confirmed"
  | "packed"
  | "shipped"
  | "out-for-delivery"
  | "delivered";

export type TrackingEvent = {
  id: string;
  stage: TrackingStage;
  label: string;
  detail: string;
  location: string;
  /** ISO 8601. `undefined` means the stage has not happened yet. */
  at?: string;
};

export type TrackedOrder = {
  invoice: string;
  phone: string;
  placedAt: string;
  estimatedAt: string;
  courier: string;
  trackingNumber: string;
  recipient: string;
  address: string;
  paymentMethod: string;
  lines: CartLine[];
  shipping: number;
  events: TrackingEvent[];
};

/** The stage the fixture order has reached — everything after it is pending. */
export const CURRENT_STAGE: TrackingStage = "shipped";

export const STAGE_ORDER: TrackingStage[] = [
  "placed",
  "confirmed",
  "packed",
  "shipped",
  "out-for-delivery",
  "delivered",
];

/**
 * One hard-coded order so the tracking page has a timeline to lay out. There
 * is no lookup anywhere — the form does not submit and this is always what
 * renders. Shaped like the eventual `GET /orders/:invoice` response so
 * swapping the body is the whole migration.
 */
export const TRACKED_ORDER: TrackedOrder = {
  invoice: "TZ-2026-04821",
  phone: "+880 1712 345678",
  placedAt: "2026-09-01T10:24:00+06:00",
  estimatedAt: "2026-09-08T18:00:00+06:00",
  courier: "Pathao Courier",
  trackingNumber: "PTH884210773",
  recipient: "Taufik Islam",
  address: "House 12, Road 4, Banani, Dhaka 1213",
  paymentMethod: "Card · Visa ending 4242",
  lines: CART_LINES,
  shipping: 120,
  events: [
    {
      id: "ev-1",
      stage: "placed",
      label: "Order placed",
      detail: "We received your order and payment.",
      location: "Online",
      at: "2026-09-01T10:24:00+06:00",
    },
    {
      id: "ev-2",
      stage: "confirmed",
      label: "Order confirmed",
      detail: "Payment cleared and stock reserved.",
      location: "Tizello Dhaka",
      at: "2026-09-01T12:05:00+06:00",
    },
    {
      id: "ev-3",
      stage: "packed",
      label: "Packed",
      detail: "Your items were picked and sealed.",
      location: "Tejgaon warehouse",
      at: "2026-09-02T09:40:00+06:00",
    },
    {
      id: "ev-4",
      stage: "shipped",
      label: "Handed to courier",
      detail: "Pathao collected the parcel.",
      location: "Tejgaon hub",
      at: "2026-09-03T16:12:00+06:00",
    },
    {
      id: "ev-5",
      stage: "out-for-delivery",
      label: "Out for delivery",
      detail: "A rider will call before arriving.",
      location: "Banani hub",
    },
    {
      id: "ev-6",
      stage: "delivered",
      label: "Delivered",
      detail: "Signed for at the address.",
      location: "Banani, Dhaka",
    },
  ],
};
