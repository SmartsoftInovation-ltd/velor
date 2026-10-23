import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { PaymentResult } from "@/components/checkout/payment-result";
import { trackOrder } from "@/lib/checkout";
import { storeHostFrom } from "@/lib/store-api";

export const metadata: Metadata = {
  title: "Order status",
  description: "The result of your order and payment.",
};

// Where the API sends the shopper back to after the payment gateway
const RESULTS = new Set(["success", "failed", "cancelled", "pending"]);

/**
 * The page the shopper lands on after paying (or placing a cash order). The
 * segment only says which return URL was used; what is shown comes from the
 * shop's own record of the order, so a hand-typed /checkout/success shows
 * nothing it should not.
 */
export default async function CheckoutResultPage({ params, searchParams }: PageProps<"/checkout/[result]">) {
  const { result } = await params;
  if (!RESULTS.has(result)) notFound();

  const { invoice } = await searchParams;
  const invoiceId = typeof invoice === "string" ? invoice : "";
  const order = await trackOrder(storeHostFrom(await headers()), invoiceId);

  return (
    <main className="container py-10">
      <PaymentResult order={order} />
    </main>
  );
}
