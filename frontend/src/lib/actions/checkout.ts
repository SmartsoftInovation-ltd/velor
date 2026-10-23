"use server";

import { headers } from "next/headers";
import { saveCartAction, type CheckoutLine } from "@/lib/actions/cart";
import { shopperIdentity } from "@/lib/actions/shopper-identity";
import {
  checkoutProblems,
  isGatewayUrl,
  shippingInfoOf,
  type CheckoutField,
  type CheckoutInput,
} from "@/lib/checkout";
import { ApiError, apiFetch, storeHostFrom } from "@/lib/store-api";

const ID = /^[a-f0-9]{24}$/i;
const CODE = /^[A-Za-z0-9_-]{1,40}$/;

// Sends the browser's lines up as the server cart, then makes one call as this shopper
async function asShopper(lines: CheckoutLine[], guestId: string) {
  const saved = await saveCartAction(lines, guestId);
  if (saved.error) return { error: saved.error } as const;
  if (saved.rejected?.length) {
    return { error: "Some items in your bag are no longer available. Review your cart and try again." } as const;
  }
  const host = storeHostFrom(await headers());
  const who = await shopperIdentity(guestId);
  if (!host || !who) return { error: "This shop could not be found." } as const;
  return { host, who } as const;
}

const message = (error: unknown, fallback: string) =>
  error instanceof ApiError && error.status < 500 ? error.message : fallback;

export type CouponResult = { error?: string; code?: string; discountAmount?: number };

/** What a coupon takes off this bag. Nothing is reserved until the order is placed. */
export async function previewCouponAction(
  lines: CheckoutLine[],
  guestId: string,
  couponCode: string,
  deliveryChargeId: string,
): Promise<CouponResult> {
  const code = typeof couponCode === "string" ? couponCode.trim() : "";
  if (!CODE.test(code)) return { error: "Enter a valid coupon code." };

  const shopper = await asShopper(lines, guestId);
  if ("error" in shopper) return { error: shopper.error };

  try {
    const data = await apiFetch<{ code: string; discountAmount: number }>(shopper.host, "/shop/coupon/preview", {
      method: "POST",
      headers: { "content-type": "application/json", ...shopper.who },
      body: JSON.stringify({ couponCode: code, deliveryChargeId: ID.test(deliveryChargeId) ? deliveryChargeId : undefined }),
    });
    return { code: data.code, discountAmount: data.discountAmount };
  } catch (error) {
    return { error: message(error, "The coupon could not be checked just now. Please try again.") };
  }
}

export type PlaceOrderResult = {
  error?: string;
  fieldErrors?: Partial<Record<CheckoutField, string>>;
  invoiceId?: string;
  /** The SSLCommerz page to send the shopper to; absent for cash on delivery */
  gatewayUrl?: string;
};

/**
 * Places the order. The API prices it again from its own records; only ids,
 * quantities, the address and the chosen options are sent.
 */
export async function placeOrderAction(
  lines: CheckoutLine[],
  guestId: string,
  input: CheckoutInput,
  deliveryRequired: boolean,
): Promise<PlaceOrderResult> {
  if (!input || typeof input !== "object") return { error: "The form could not be read. Please refresh the page." };
  const fieldErrors = checkoutProblems(input, deliveryRequired);
  if (Object.keys(fieldErrors).length) return { fieldErrors };
  if (input.paymentMethod !== "cod" && input.paymentMethod !== "sslcommerz") {
    return { error: "Choose a payment method." };
  }
  if (input.deliveryChargeId && !ID.test(input.deliveryChargeId)) return { error: "Choose a delivery option." };
  if (input.couponCode && !CODE.test(input.couponCode)) return { error: "Remove the coupon code and try again." };

  const shopper = await asShopper(lines, guestId);
  if ("error" in shopper) return { error: shopper.error };

  try {
    const data = await apiFetch<{ order: { invoiceId: string }; gatewayUrl: string | null }>(shopper.host, "/shop/order", {
      method: "POST",
      headers: { "content-type": "application/json", ...shopper.who },
      body: JSON.stringify({
        shippingInfo: shippingInfoOf(input),
        paymentMethod: input.paymentMethod,
        deliveryChargeId: input.deliveryChargeId || undefined,
        couponCode: input.couponCode || undefined,
      }),
    });

    if (input.paymentMethod === "sslcommerz") {
      // Never send the shopper anywhere but the payment gateway itself
      if (!isGatewayUrl(data.gatewayUrl)) return { error: "Online payment could not be started. Please try again." };
      return { invoiceId: data.order.invoiceId, gatewayUrl: data.gatewayUrl };
    }
    return { invoiceId: data.order.invoiceId };
  } catch (error) {
    return { error: message(error, "Your order could not be placed just now. Please try again.") };
  }
}
