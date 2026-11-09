"use server";

import { headers } from "next/headers";
import { isPhone, normalizePhone } from "@/lib/shopper-auth";
import { ApiError, storeHostFrom } from "@/lib/store-api";
import { trackOrderDetails, type TrackedOrderDetails } from "@/lib/track";

export type TrackFormState = {
  error?: string;
  fieldErrors?: Partial<Record<"invoice" | "phone", string>>;
  invoice?: string;
  phone?: string;
  order?: TrackedOrderDetails;
};

const INVOICE = /^[A-Za-z0-9-]{3,40}$/;

/** Looks an order up by its invoice number plus the phone number given at checkout */
export async function trackOrderAction(_prev: TrackFormState, form: FormData): Promise<TrackFormState> {
  const invoice = String(form.get("invoice") ?? "").trim();
  const phone = String(form.get("phone") ?? "").trim();

  const fieldErrors: TrackFormState["fieldErrors"] = {};
  if (!INVOICE.test(invoice)) fieldErrors.invoice = "Enter the invoice number from your order confirmation.";
  if (!isPhone(phone)) fieldErrors.phone = "Enter the 11-digit mobile number you used at checkout.";
  if (fieldErrors.invoice || fieldErrors.phone) return { fieldErrors, invoice, phone };

  const host = storeHostFrom(await headers());
  if (!host) return { error: "This shop could not be found.", invoice, phone };

  try {
    const order = await trackOrderDetails(host, invoice, normalizePhone(phone));
    return { order, invoice, phone };
  } catch (error) {
    // 404 and 429 are worded for the shopper by the API; anything else is generic
    const message =
      error instanceof ApiError && (error.status === 404 || error.status === 429)
        ? error.message
        : "We could not look up your order just now. Please try again.";
    return { error: message, invoice, phone };
  }
}
