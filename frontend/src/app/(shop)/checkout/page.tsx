import type { Metadata } from "next";
import { headers } from "next/headers";
import { CheckoutForm } from "@/components/checkout/checkout-form";
import { CheckoutSteps } from "@/components/checkout/checkout-steps";
import { Breadcrumb } from "@/components/shop/breadcrumb";
import { getDeliveryOptions } from "@/lib/checkout";
import { storeHostFrom } from "@/lib/store-api";
import { NO_INDEX } from "@/lib/seo";

export const metadata: Metadata = {
  robots: NO_INDEX,
  title: "Checkout",
  description: "Confirm your details and place your order.",
};

/**
 * The delivery options are read here, on the server; the form is the one
 * client leaf. Placing the order saves the browser's bag as the server cart,
 * then POST /shop/order — the shop prices it, and online payment goes to
 * SSLCommerz for the shop's total.
 */
export default async function CheckoutPage() {
  const deliveryOptions = await getDeliveryOptions(storeHostFrom(await headers()));

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

      <CheckoutForm deliveryOptions={deliveryOptions} />
    </main>
  );
}
