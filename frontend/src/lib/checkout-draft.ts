import type { PersistedList } from "@/lib/cart/persisted-list";
import type { CheckoutInput, PaymentMethod } from "@/lib/checkout";

/**
 * What the shopper has typed at checkout, kept in this browser until the order
 * goes through, so a reload, a trip back to the cart or a failed payment does
 * not lose it. It stays on the device and is never sent until the order is
 * placed. The coupon is left out: its discount is the shop's answer for one
 * bag, so it is applied afresh.
 *
 * It holds a name, a phone and an address, and browsers get shared, so it also
 * expires, and it goes on sign-out.
 */
export type CheckoutDraft = Omit<CheckoutInput, "couponCode"> & { savedAt: string };

export const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const TEXT_FIELDS = ["fullName", "phone", "email", "city", "address", "deliveryChargeId"] as const;
const METHODS: PaymentMethod[] = ["sslcommerz", "cod"];
// Fields that only ever hold a default or a choice: a draft of these alone holds nothing typed
const CHOICE_FIELDS = new Set<string>(["city", "deliveryChargeId"]);

export function isCheckoutDraft(value: unknown): value is CheckoutDraft {
  if (typeof value !== "object" || value === null) return false;
  const draft = value as Record<string, unknown>;
  return (
    TEXT_FIELDS.every((field) => typeof draft[field] === "string") &&
    METHODS.includes(draft.paymentMethod as PaymentMethod) &&
    typeof draft.savedAt === "string"
  );
}

/** The form as it stands, from its named fields. */
export function draftFromForm(form: FormData, now = new Date()): CheckoutDraft {
  const text = (name: string) => String(form.get(name) ?? "");
  return {
    fullName: text("fullName"),
    phone: text("phone"),
    email: text("email"),
    city: text("city"),
    address: text("address"),
    deliveryChargeId: text("deliveryChargeId"),
    paymentMethod: text("paymentMethod") === "sslcommerz" ? "sslcommerz" : "cod",
    savedAt: now.toISOString(),
  };
}

/** The saved draft, or null when there is none or it has expired. */
export function readDraft(list: PersistedList<CheckoutDraft>, now = Date.now()): CheckoutDraft | null {
  const draft = list.get()[0];
  if (!draft) return null;
  const age = now - new Date(draft.savedAt).getTime();
  return age >= 0 && age < DRAFT_MAX_AGE_MS ? draft : null;
}

/** Saves the form, or removes the draft once every typed field is empty again. */
export function saveDraft(list: PersistedList<CheckoutDraft>, draft: CheckoutDraft) {
  const typed = TEXT_FIELDS.some((field) => !CHOICE_FIELDS.has(field) && draft[field].trim());
  list.set(typed ? [draft] : []);
}
