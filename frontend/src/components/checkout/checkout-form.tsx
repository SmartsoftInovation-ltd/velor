"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { AddressForm } from "@/components/checkout/address-form";
import { ContactForm } from "@/components/checkout/contact-form";
import { CouponField, type AppliedCoupon } from "@/components/checkout/coupon-field";
import { DeliveryOptions } from "@/components/checkout/delivery-options";
import { OrderReview } from "@/components/checkout/order-review";
import { PaymentMethods } from "@/components/checkout/payment-methods";
import { useCart } from "@/components/cart/use-cart";
import { useShopStorage } from "@/components/cart/shop-storage-provider";
import { placeOrderAction, previewCouponAction, type PlaceOrderResult } from "@/lib/actions/checkout";
import { guestIdFor } from "@/lib/cart/persisted-list";
import type { CheckoutInput, DeliveryOption, PaymentMethod } from "@/lib/checkout";

const text = (form: FormData, name: string) => String(form.get(name) ?? "");

/**
 * The whole checkout as one form. Only ids, quantities and the address leave
 * the browser; the shop prices the order. Online payment sends the shopper to
 * SSLCommerz and the bag is kept until the shop confirms the payment, so a
 * failed or cancelled payment can simply be tried again.
 */
export function CheckoutForm({ deliveryOptions }: { deliveryOptions: DeliveryOption[] }) {
  const router = useRouter();
  const { tenantId } = useShopStorage();
  const { lines: all, totals, ready, clear } = useCart();
  const lines = all.filter((line) => !line.unavailable);

  const [deliveryId, setDeliveryId] = useState(deliveryOptions.length === 1 ? deliveryOptions[0]._id : "");
  const [payment, setPayment] = useState<PaymentMethod>("sslcommerz");
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null);
  const [result, setResult] = useState<PlaceOrderResult>({});
  const [pending, startTransition] = useTransition();

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
    const form = new FormData(event.currentTarget);
    const input: CheckoutInput = {
      email: text(form, "email"),
      firstName: text(form, "firstName"),
      lastName: text(form, "lastName"),
      phone: text(form, "phone"),
      address: text(form, "address"),
      apartment: text(form, "apartment"),
      city: text(form, "city"),
      postalCode: text(form, "postalCode"),
      note: text(form, "note"),
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
      router.push(`/checkout/success?invoice=${encodeURIComponent(placed.invoiceId)}`);
    });
  };

  const errors = result.fieldErrors ?? {};
  const busy = pending || Boolean(result.invoiceId);

  return (
    <form onSubmit={submit} noValidate className="grid items-start gap-6 lg:grid-cols-[1fr_23rem]">
      <div className="space-y-4">
        <ContactForm errors={errors} />
        <AddressForm errors={errors} />
        <DeliveryOptions
          options={deliveryOptions}
          selected={deliveryId}
          onSelect={setDeliveryId}
          error={errors.deliveryChargeId}
        />
        <PaymentMethods selected={payment} onSelect={setPayment} />
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
