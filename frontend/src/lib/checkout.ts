import { apiFetch } from "@/lib/store-api";
import { isEmail, isPhone, normalizePhone } from "@/lib/shopper-auth";

/**
 * Checkout against the ECOMPOS API (`/shop/*`). The browser's figures are a
 * preview only: the API prices the cart, the delivery and the coupon itself,
 * and the gateway is opened for the amount the API computed.
 */

export type DeliveryOption = { _id: string; name: string; charge: number; description: string };

export type PaymentMethod = "cod" | "sslcommerz";

export type CheckoutInput = {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  apartment: string;
  city: string;
  postalCode: string;
  note: string;
  deliveryChargeId: string;
  paymentMethod: PaymentMethod;
  couponCode: string;
};

export type CheckoutField = "email" | "firstName" | "phone" | "address" | "city" | "deliveryChargeId";

/** What is wrong with the form, keyed by field; empty when it can be sent */
export function checkoutProblems(input: CheckoutInput, deliveryRequired: boolean) {
  const problems: Partial<Record<CheckoutField, string>> = {};
  if (input.firstName.trim().length < 2) problems.firstName = "Enter your name.";
  if (!isPhone(input.phone)) problems.phone = "Enter an 11-digit mobile number, like 01712345678.";
  if (input.email.trim() && !isEmail(input.email)) problems.email = "Enter a valid email address.";
  if (input.address.trim().length < 5) problems.address = "Enter the street address.";
  if (!input.city.trim()) problems.city = "Choose a city.";
  if (deliveryRequired && !input.deliveryChargeId) problems.deliveryChargeId = "Choose a delivery option.";
  return problems;
}

/** The `shippingInfo` the API keeps on the order */
export const shippingInfoOf = (input: CheckoutInput) => ({
  fullName: `${input.firstName.trim()} ${input.lastName.trim()}`.trim(),
  phone: normalizePhone(input.phone),
  email: input.email.trim() || undefined,
  address: [input.address.trim(), input.apartment.trim()].filter(Boolean).join(", "),
  city: input.city.trim(),
  postalCode: input.postalCode.trim() || undefined,
  note: input.note.trim() || undefined,
});

// The only places the shopper may be sent to pay
const GATEWAY_HOSTS = new Set(["sandbox.sslcommerz.com", "securepay.sslcommerz.com"]);

/** True for an SSLCommerz payment page; anything else is never followed */
export function isGatewayUrl(url: unknown): url is string {
  if (typeof url !== "string") return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && GATEWAY_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}

// GET /shop/delivery-options — empty when the API cannot be reached
export async function getDeliveryOptions(tenantHost: string): Promise<DeliveryOption[]> {
  if (!tenantHost) return [];
  try {
    return (await apiFetch<{ options: DeliveryOption[] }>(tenantHost, "/shop/delivery-options")).options;
  } catch {
    return [];
  }
}

export type TrackedOrder = {
  invoiceId: string;
  orderStatus: string;
  paymentStatus: "Pending" | "success" | "failed" | "cancelled";
  paymentMethod: PaymentMethod;
  finalAmount: number;
  createdAt: string;
};

// GET /shop/track/:invoiceId — status only, never the address
export async function trackOrder(tenantHost: string, invoiceId: string): Promise<TrackedOrder | null> {
  if (!tenantHost || !/^[A-Za-z0-9-]{3,40}$/.test(invoiceId)) return null;
  try {
    return (await apiFetch<{ order: TrackedOrder }>(tenantHost, `/shop/track/${encodeURIComponent(invoiceId)}`)).order;
  } catch {
    return null;
  }
}
