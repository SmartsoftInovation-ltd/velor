import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { CheckoutForm } from "@/components/checkout/checkout-form";
import { CheckoutSteps } from "@/components/checkout/checkout-steps";
import { Breadcrumb } from "@/components/shop/breadcrumb";
import { getDeliveryOptions } from "@/lib/checkout";
import { currentShopper, expiredSignInHref, REFRESH_COOKIE, SESSION_COOKIE } from "@/lib/shopper-auth";
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
 *
 * A guest checks out as they are. A signed-in shopper whose session the API
 * no longer accepts, even after renewing it, is sent to sign in first, and comes back here after.
 */
export default async function CheckoutPage() {
  const host = storeHostFrom(await headers());
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  const [deliveryOptions, shopper] = await Promise.all([
    getDeliveryOptions(host),
    // A down API is left for the order step to report; only a refused session redirects
    token ? currentShopper(host, token, jar.get(REFRESH_COOKIE)?.value).catch(() => undefined) : undefined,
  ]);
  if (shopper === null) redirect(expiredSignInHref("/checkout"));

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
