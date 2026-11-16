import { ApiError, apiFetch } from "@/lib/store-api";

/** One line of a tracked order, as the shop sold it */
export type TrackedLine = {
  id: string;
  name: string;
  /** The variant's own name when it differs from the product's */
  option: string;
  image: string;
  color: string;
  size: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

/**
 * POST /shop/track: the shopper's view of an order. `phone` arrives partly
 * hidden and `address` is the city only, since either key alone finds it.
 */
export type TrackedOrder = {
  invoice: string;
  /** The dashboard's order status: Pending, Hold, Confirmed, Packaging, CourierPending, Courier, Shipped, Delivered, Cancelled */
  status: string;
  placedAt: string;
  /** When the status last changed; the dashboard keeps no per-stage history */
  updatedAt: string;
  recipient: string;
  phone: string;
  address: string;
  paymentMethod: string;
  paymentStatus: string;
  courier: string;
  trackingNumber: string;
  lines: TrackedLine[];
  subtotal: number;
  discount: number;
  delivery: number;
  total: number;
};

export type TrackingStage = "placed" | "confirmed" | "packed" | "shipped" | "delivered";

export const STAGES: { stage: TrackingStage; label: string; detail: string }[] = [
  { stage: "placed", label: "Order placed", detail: "We received your order." },
  { stage: "confirmed", label: "Order confirmed", detail: "The shop confirmed your order." },
  { stage: "packed", label: "Packed", detail: "Your items are being packed." },
  { stage: "shipped", label: "Handed to courier", detail: "Your parcel is on its way." },
  { stage: "delivered", label: "Delivered", detail: "Your parcel was delivered." },
];

const STAGE_OF: Record<string, TrackingStage> = {
  Pending: "placed",
  Hold: "placed",
  Confirmed: "confirmed",
  Packaging: "packed",
  CourierPending: "packed",
  Courier: "shipped",
  Shipped: "shipped",
  Delivered: "delivered",
};

/** The stage an order has reached; cancelled orders have none */
export const stageOf = (status: string): TrackingStage | null =>
  status === "Cancelled" ? null : (STAGE_OF[status] ?? "placed");

/** The headline on the status card */
export const STATUS_TITLE: Record<string, string> = {
  Pending: "Order placed",
  Hold: "On hold",
  Confirmed: "Confirmed",
  Packaging: "Being packed",
  CourierPending: "Ready for courier",
  Courier: "On the way",
  Shipped: "On the way",
  Delivered: "Delivered",
  Cancelled: "Cancelled",
};

export type TrackResult = { orders: TrackedOrder[] } | { error: string };

export type TrackQuery = { invoice: string } | { phone: string };

/** Looks orders up in the store at `tenantHost` by invoice number, or by checkout phone (newest first, up to 10). */
export async function trackOrder(tenantHost: string, query: TrackQuery): Promise<TrackResult> {
  try {
    const data = await apiFetch<{ orders: TrackedOrder[] }>(tenantHost, "/shop/track", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(query),
    });
    return { orders: data.orders };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return {
        error:
          "invoice" in query
            ? "We couldn't find an order with that invoice number. Check it and try again."
            : "We couldn't find any order placed with that phone number. Check it and try again.",
      };
    }
    if (error instanceof ApiError && error.status < 500) return { error: error.message };
    return { error: "We couldn't look up your order just now. Please try again." };
  }
}
