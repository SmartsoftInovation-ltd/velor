import { apiFetch } from "@/lib/store-api";

/** One parcel line, as `POST /shop/track` returns it */
export type TrackedLine = {
  id: string;
  name: string;
  image: string;
  color: string;
  size: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

/** `POST /shop/track` — only returned when the invoice and phone match */
export type TrackedOrderDetails = {
  invoiceId: string;
  orderStatus: string;
  paymentMethod: "cod" | "sslcommerz";
  paymentStatus: "Pending" | "success" | "failed" | "cancelled";
  placedAt: string;
  updatedAt: string;
  courier: { name: string; trackingId: string };
  recipient: string;
  phone: string;
  address: string;
  items: TrackedLine[];
  subtotal: number;
  discount: number;
  delivery: number;
  total: number;
};

export async function trackOrderDetails(tenantHost: string, invoiceId: string, phone: string) {
  const data = await apiFetch<{ order: TrackedOrderDetails }>(tenantHost, "/shop/track", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ invoiceId, phone }),
  });
  return data.order;
}

// ---------------------------------------------------------------- progress

export type TrackingStage = "placed" | "confirmed" | "packed" | "shipped" | "delivered";

export const STAGE_ORDER: TrackingStage[] = ["placed", "confirmed", "packed", "shipped", "delivered"];

const STAGE_TEXT: Record<TrackingStage, { label: string; detail: string }> = {
  placed: { label: "Order placed", detail: "We received your order." },
  confirmed: { label: "Order confirmed", detail: "The shop confirmed your order." },
  packed: { label: "Packed", detail: "Your items are being packed." },
  shipped: { label: "Handed to courier", detail: "Your parcel is on its way." },
  delivered: { label: "Delivered", detail: "The parcel reached you." },
};

/** Where an order status sits on the five-step rail. Cancelled orders have no stage. */
export function stageOf(orderStatus: string): TrackingStage | null {
  switch (orderStatus) {
    case "Pending":
    case "Hold":
      return "placed";
    case "Confirmed":
      return "confirmed";
    case "Packaging":
      return "packed";
    case "CourierPending":
    case "Courier":
    case "Shipped":
      return "shipped";
    case "Delivered":
      return "delivered";
    default:
      return null;
  }
}

/** The headline for the status card */
export function statusHeadline(orderStatus: string): string {
  switch (orderStatus) {
    case "Hold":
      return "On hold";
    case "Pending":
      return "Order received";
    case "Confirmed":
      return "Confirmed";
    case "Packaging":
      return "Being packed";
    case "CourierPending":
      return "Waiting for the courier";
    case "Courier":
    case "Shipped":
      return "In transit";
    case "Delivered":
      return "Delivered";
    case "Cancelled":
      return "Cancelled";
    default:
      return orderStatus;
  }
}

export type TrackingEvent = {
  stage: TrackingStage;
  label: string;
  detail: string;
  /** ISO 8601, when known. The API keeps no per-step history, so only the
   *  placing time and the latest change are dated. */
  at?: string;
};

export function timelineOf(order: TrackedOrderDetails): TrackingEvent[] {
  const current = stageOf(order.orderStatus);
  return STAGE_ORDER.map((stage) => ({
    stage,
    ...STAGE_TEXT[stage],
    at: stage === "placed" ? order.placedAt : stage === current ? order.updatedAt : undefined,
  }));
}

export const paymentLabel = (order: Pick<TrackedOrderDetails, "paymentMethod" | "paymentStatus">) => {
  if (order.paymentMethod !== "sslcommerz") return "Cash on delivery";
  if (order.paymentStatus === "success") return "Paid online";
  if (order.paymentStatus === "failed") return "Online payment failed";
  if (order.paymentStatus === "cancelled") return "Online payment cancelled";
  return "Online payment pending";
};

export const taka = (value: number) => `৳${(Number(value) || 0).toLocaleString("en-BD")}`;
