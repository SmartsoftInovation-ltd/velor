import type { Metadata } from "next";
import { AddressForm } from "@/components/checkout/address-form";
import { CheckoutSteps } from "@/components/checkout/checkout-steps";
import { ContactForm } from "@/components/checkout/contact-form";
import { DeliveryOptions } from "@/components/checkout/delivery-options";
import { OrderReview } from "@/components/checkout/order-review";
import { PaymentMethods } from "@/components/checkout/payment-methods";
import { Breadcrumb } from "@/components/shop/breadcrumb";

export const metadata: Metadata = {
  title: "Checkout",
  description: "Confirm your details and place your order.",
};

/**
 * The order panel reads this shop's real cart. The form itself does not submit
 * yet: placing the order (saveCartAction, then POST /shop/order) is the next
 * step in `.claude/specs/cart-wishlist.md`.
 */
export default function CheckoutPage() {
  return (
    <main className="container py-6">
      <h1 className="sr-only">Checkout</h1>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <Breadcrumb
          items={[
            { label: "Home", href: "/" },
            { label: "Cart", href: "/cart" },
            { label: "Checkout" },
          ]}
        />
        <CheckoutSteps current={2} />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_23rem]">
        <div className="space-y-4">
          <ContactForm />
          <AddressForm />
          <DeliveryOptions />
          <PaymentMethods />
        </div>

        {/* Sticky on desktop: the total stays in view while the form scrolls. */}
        <div className="lg:sticky lg:top-32">
          <OrderReview />
        </div>
      </div>
    </main>
  );
}
