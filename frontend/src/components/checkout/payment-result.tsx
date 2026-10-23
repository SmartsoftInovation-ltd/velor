import Link from "next/link";
import { ClearBag } from "@/components/checkout/clear-bag";
import { buttonClassName } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { TrackedOrder } from "@/lib/checkout";

type Outcome = "paid" | "placed" | "confirming" | "failed" | "cancelled" | "missing";

const COPY: Record<Outcome, { badge: string; title: string; body: string; tone: "success" | "warning" | "danger" }> = {
  paid: { badge: "Paid", title: "Payment received", body: "Thank you! Your order is confirmed and is being prepared.", tone: "success" },
  placed: { badge: "Cash on delivery", title: "Order placed", body: "Thank you! Pay the courier when your order arrives.", tone: "success" },
  confirming: {
    badge: "Pending",
    title: "Confirming your payment",
    body: "The payment gateway has not confirmed this payment yet. This can take a few minutes — refresh this page shortly. You will not be charged twice.",
    tone: "warning",
  },
  failed: { badge: "Not paid", title: "Payment failed", body: "The payment did not go through. Your bag is still saved, so you can try again.", tone: "danger" },
  cancelled: { badge: "Cancelled", title: "Payment cancelled", body: "You cancelled the payment. Your bag is still saved.", tone: "danger" },
  missing: { badge: "Unknown", title: "Order not found", body: "We could not find this order. Check the link, or contact the shop.", tone: "danger" },
};

const TONES = {
  success: "bg-success-subtle text-success-text",
  warning: "bg-warning-subtle text-warning-text",
  danger: "bg-danger-subtle text-danger-text",
} as const;

// What the shop says happened, never what the return URL claimed
function outcomeOf(order: TrackedOrder | null): Outcome {
  if (!order) return "missing";
  if (order.paymentMethod === "cod") return "placed";
  if (order.paymentStatus === "success") return "paid";
  if (order.paymentStatus === "failed") return "failed";
  if (order.paymentStatus === "cancelled") return "cancelled";
  return "confirming";
}

export function PaymentResult({ order }: { order: TrackedOrder | null }) {
  const outcome = outcomeOf(order);
  const copy = COPY[outcome];
  const done = outcome === "paid" || outcome === "placed";

  return (
    <section className="mx-auto max-w-xl rounded-xl border border-border-subtle bg-bg-surface p-6 text-center shadow-sm sm:p-8">
      {done ? <ClearBag /> : null}
      <p className={cn("mx-auto inline-block rounded-full px-3 py-1 text-caption font-semibold", TONES[copy.tone])}>
        {copy.badge}
      </p>
      <h1 className="mt-4 text-h2 font-semibold text-text-primary">{copy.title}</h1>
      <p className="mt-2 text-body text-text-secondary">{copy.body}</p>

      {order ? (
        <dl className="mt-6 space-y-2 rounded-lg bg-bg-sunken p-4 text-left text-small">
          <div className="flex justify-between gap-3">
            <dt className="text-text-secondary">Invoice</dt>
            <dd className="font-semibold tabular text-text-primary">{order.invoiceId}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-text-secondary">Total</dt>
            <dd className="font-semibold tabular text-text-primary">৳{order.finalAmount.toLocaleString()}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-text-secondary">Order status</dt>
            <dd className="text-text-primary">{order.orderStatus}</dd>
          </div>
        </dl>
      ) : null}

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {done || outcome === "confirming" ? (
          <Link href="/shop" className={buttonClassName("primary")}>
            Continue shopping
          </Link>
        ) : (
          <Link href="/checkout" className={buttonClassName("primary")}>
            Try again
          </Link>
        )}
        <Link href="/track-order" className={buttonClassName("secondary")}>
          Track order
        </Link>
      </div>
    </section>
  );
}
