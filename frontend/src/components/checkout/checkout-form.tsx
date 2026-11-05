"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type FormEvent } from "react";
import { AddressForm } from "@/components/checkout/address-form";
import { ContactForm } from "@/components/checkout/contact-form";
import { CouponField, type AppliedCoupon } from "@/components/checkout/coupon-field";
import { DeliveryOptions } from "@/components/checkout/delivery-options";
import { OrderReview } from "@/components/checkout/order-review";
import { PaymentMethods } from "@/components/checkout/payment-methods";
import { useCart, useHydrated } from "@/components/cart/use-cart";
import { useShopStorage } from "@/components/cart/shop-storage-provider";
import { placeOrderAction, previewCouponAction, type PlaceOrderResult } from "@/lib/actions/checkout";
import { guestIdFor } from "@/lib/cart/persisted-list";
import type { DeliveryOption, PaymentMethod } from "@/lib/checkout";
import { draftFromForm, readDraft, saveDraft } from "@/lib/checkout-draft";

type Props = { deliveryOptions: DeliveryOption[] };

/**
 * The server cannot read the draft, so the form first renders blank and is
 * mounted afresh with the draft in place as soon as the browser takes over.
 * That swap happens at hydration, before anything can be typed.
 */
export function CheckoutForm(props: Props) {
  const hydrated = useHydrated();
  return <CheckoutFormBody key={hydrated ? "draft" : "server"} {...props} />;
}

/**
 * The whole checkout as one form. Only ids, quantities and the address leave
 * the browser; the shop prices the order. Online payment sends the shopper to
 * SSLCommerz and the bag is kept until the shop confirms the payment, so a
 * failed or cancelled payment can simply be tried again. What is typed is kept
 * as a draft until then too; see lib/checkout-draft.ts.
 */
function CheckoutFormBody({ deliveryOptions }: Props) {
  const router = useRouter();
  const { tenantId, checkoutDraft } = useShopStorage();
  const { lines: all, totals, ready, clear } = useCart();
  const lines = all.filter((line) => !line.unavailable);

  const [draft] = useState(() => (ready ? readDraft(checkoutDraft) : null));
  // A delivery option the shop has since removed is not restored
  const [deliveryId, setDeliveryId] = useState(() => {
    if (deliveryOptions.some((option) => option._id === draft?.deliveryChargeId)) return draft?.deliveryChargeId ?? "";
    return deliveryOptions.length === 1 ? deliveryOptions[0]._id : "";
  });
  const [payment, setPayment] = useState<PaymentMethod>(draft?.paymentMethod ?? "sslcommerz");
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null);
  const [result, setResult] = useState<PlaceOrderResult>({});
  const [pending, startTransition] = useTransition();

  // An expired draft still holds someone's address: remove it, not just ignore it
  useEffect(() => {
    if (ready && !draft && checkoutDraft.get().length) checkoutDraft.set([]);
  }, [ready, draft, checkoutDraft]);

  if (ready && !lines.length) {
    return (
      <div className="rounded-xl border border-border-subtle bg-bg-surface p-8 text-center shadow-sm">
        <p className="text-body font-semibold text-text-primary">Your bag is empty</p>
        <Link href="/shop" className="mt-2 inline-block text-small font-medium text-text-brand">
          Browse the shop
        </Link>
      </div>
    );
  }

  const refs = () => lines.map(({ productId, variantId, quantity }) => ({ productId, variantId, quantity }));
  const delivery = deliveryOptions.find((option) => option._id === deliveryId);

  const applyCoupon = async (code: string) => {
    const answer = await previewCouponAction(refs(), guestIdFor(tenantId), code, deliveryId);
    if (answer.error || !answer.code) return answer.error ?? "This coupon is not valid.";
    setCoupon({ code: answer.code, discountAmount: answer.discountAmount ?? 0 });
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // savedAt is only the draft's; the action reads the named fields it needs
    const input = {
      ...draftFromForm(new FormData(event.currentTarget)),
      deliveryChargeId: deliveryId,
      paymentMethod: payment,
      couponCode: coupon?.code ?? "",
    };

    startTransition(async () => {
      const placed = await placeOrderAction(refs(), guestIdFor(tenantId), input, deliveryOptions.length > 0);
      setResult(placed);
      if (!placed.invoiceId) return;
      if (placed.gatewayUrl) {
        window.location.assign(placed.gatewayUrl);
        return;
      }
      clear();
      checkoutDraft.set([]);
      router.push(`/checkout/success?invoice=${encodeURIComponent(placed.invoiceId)}`);
    });
  };

  const errors = result.fieldErrors ?? {};
  const busy = pending || Boolean(result.invoiceId);

  return (
    <form
      onSubmit={submit}
      onChange={(event) => saveDraft(checkoutDraft, draftFromForm(new FormData(event.currentTarget)))}
      noValidate
      className="grid items-start gap-6 lg:grid-cols-[1fr_23rem]">
      <div className="space-y-4">
        <ContactForm errors={errors} draft={draft} />
        <AddressForm errors={errors} draft={draft} />
        <DeliveryOptions
          options={deliveryOptions}
          selected={deliveryId}
          onSelect={setDeliveryId}
          error={errors.deliveryChargeId}
        />
        <PaymentMethods selected={payment} onSelect={setPayment} />
        <p className="text-caption text-text-tertiary">
          Your details are saved on this device until you order, and for 7 days at most.
        </p>
      </div>

      {/* Sticky on desktop: the total stays in view while the form scrolls. */}
      <div className="lg:sticky lg:top-32">
        <OrderReview
          lines={lines}
          subtotal={totals.subtotal}
          saved={totals.saved}
          deliveryCharge={delivery ? delivery.charge : deliveryOptions.length ? null : 0}
          discount={coupon?.discountAmount ?? 0}
          coupon={<CouponField applied={coupon} onApply={applyCoupon} onRemove={() => setCoupon(null)} disabled={busy} />}
          submitLabel={payment === "sslcommerz" ? "Pay now" : "Place order"}
          pending={busy}
          error={result.error ?? (Object.keys(errors).length ? "Check the highlighted fields." : undefined)}
        />
      </div>
    </form>
  );
}
