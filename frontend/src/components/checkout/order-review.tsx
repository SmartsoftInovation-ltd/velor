import Link from "next/link";
import type { ReactNode } from "react";
import { OrderReviewLines } from "@/components/checkout/order-review-lines";
import { Button } from "@/components/ui/button";
import { ShieldCheckIcon } from "@/components/ui/icons";
import type { CartLine } from "@/lib/cart/types";

type Props = {
  lines: CartLine[];
  subtotal: number;
  saved: number;
  /** Null until a delivery option is chosen */
  deliveryCharge: number | null;
  discount: number;
  coupon: ReactNode;
  submitLabel: string;
  pending: boolean;
  error?: string;
};

const taka = (amount: number) => `৳${amount.toLocaleString()}`;

/**
 * The order panel: the bag, the coupon box and the running total. Every figure
 * here is a preview — the shop prices the order again when it is placed, and
 * online payment is opened for the shop's figure, not this one.
 */
export function OrderReview({ lines, subtotal, saved, deliveryCharge, discount, coupon, submitLabel, pending, error }: Props) {
  const total = Math.max(0, subtotal - discount) + (deliveryCharge ?? 0);

  return (
    <aside className="overflow-hidden rounded-xl border border-border-subtle bg-bg-surface shadow-sm">
      <div className="space-y-5 p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-body font-semibold text-text-primary">Your order</h2>
          <Link
            href="/cart"
            className="text-caption font-medium text-text-secondary transition-colors duration-150 hover:text-text-brand"
          >
            Edit
          </Link>
        </div>

        <OrderReviewLines lines={lines} />

        {coupon}

        <dl className="space-y-2.5 border-t border-border-subtle pt-4 text-small">
          <div className="flex justify-between">
            <dt className="text-text-secondary">Subtotal</dt>
            <dd className="font-medium tabular text-text-primary">{taka(subtotal)}</dd>
          </div>
          {saved > 0 ? (
            <div className="flex justify-between">
              <dt className="text-text-secondary">You save</dt>
              <dd className="font-medium tabular text-success-text">−{taka(saved)}</dd>
            </div>
          ) : null}
          {discount > 0 ? (
            <div className="flex justify-between">
              <dt className="text-text-secondary">Coupon</dt>
              <dd className="font-medium tabular text-success-text">−{taka(discount)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between">
            <dt className="text-text-secondary">Delivery</dt>
            {deliveryCharge === null ? (
              <dd className="text-text-tertiary">Choose an option</dd>
            ) : (
              <dd className="font-medium tabular text-text-primary">{deliveryCharge ? taka(deliveryCharge) : "Free"}</dd>
            )}
          </div>
        </dl>

        <div className="flex items-baseline justify-between border-t border-border-subtle pt-4">
          <p className="text-body font-semibold text-text-primary">Total</p>
          <p className="text-h2 font-semibold tabular text-text-primary">{taka(total)}</p>
        </div>

        {error ? (
          <p role="alert" className="rounded-md bg-danger-subtle px-3 py-2 text-small text-danger-text">
            {error}
          </p>
        ) : null}

        <Button type="submit" variant="primary" size="lg" fullWidth disabled={pending}>
          {pending ? "Placing your order…" : submitLabel}
        </Button>

        <p className="flex items-center justify-center gap-1.5 text-center text-caption text-text-tertiary">
          <ShieldCheckIcon className="size-4 shrink-0" />
          Secure checkout · 7-day returns
        </p>
      </div>
    </aside>
  );
}
