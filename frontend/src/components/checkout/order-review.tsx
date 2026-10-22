"use client";

import Link from "next/link";
import { AppImage } from "@/components/ui/app-image";
import { Button } from "@/components/ui/button";
import { ShieldCheckIcon } from "@/components/ui/icons";
import { useCart } from "@/components/cart/use-cart";

/**
 * The checkout-side twin of OrderSummary: the same totals, read from this
 * shop's cart, but the lines are read-only thumbnails rather than editable
 * rows. Delivery is added by the shop when the order is placed.
 */
export function OrderReview() {
  const { lines: all, totals, ready } = useCart();
  const lines = all.filter((line) => !line.unavailable);
  const { subtotal, saved } = totals;

  if (ready && !lines.length) {
    return (
      <aside className="rounded-xl border border-border-subtle bg-bg-surface p-5 text-center shadow-sm">
        <p className="text-body font-semibold text-text-primary">Your bag is empty</p>
        <Link href="/shop" className="mt-2 inline-block text-small font-medium text-text-brand">
          Browse the shop
        </Link>
      </aside>
    );
  }

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

        <ul className="space-y-3">
          {lines.map((line) => (
            <li key={line.key} className="flex items-center gap-3">
              <div className="relative size-14 shrink-0 overflow-hidden rounded-md bg-bg-sunken">
                <AppImage
                  src={line.image}
                  alt={line.name}
                  fill
                  sizes="56px"
                  className="object-cover"
                />
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-small font-medium text-text-primary">
                  {line.name}
                </p>
                {/* Quantity rides the variant line rather than sitting as a
                    badge over the thumbnail, which covered the product. */}
                <p className="flex flex-wrap items-center gap-x-1.5 text-caption text-text-tertiary">
                  {line.optionLabel ? (
                    <>
                      <span>{line.optionLabel}</span>
                      <span aria-hidden="true" className="text-border-default">
                        |
                      </span>
                    </>
                  ) : null}
                  <span>
                    Qty{" "}
                    <span className="font-medium tabular text-text-secondary">
                      {line.quantity}
                    </span>
                  </span>
                </p>
              </div>

              <p className="shrink-0 text-small font-semibold tabular text-text-primary">
                ৳{(line.unitPrice * line.quantity).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>

        <dl className="space-y-2.5 border-t border-border-subtle pt-4 text-small">
          <div className="flex justify-between">
            <dt className="text-text-secondary">Subtotal</dt>
            <dd className="font-medium tabular text-text-primary">
              ৳{subtotal.toLocaleString()}
            </dd>
          </div>
          {saved > 0 ? (
            <div className="flex justify-between">
              <dt className="text-text-secondary">You save</dt>
              <dd className="font-medium tabular text-success-text">
                −৳{saved.toLocaleString()}
              </dd>
            </div>
          ) : null}
          <div className="flex justify-between">
            <dt className="text-text-secondary">Delivery</dt>
            <dd className="text-text-tertiary">Added with your order</dd>
          </div>
        </dl>

        <div className="flex items-baseline justify-between border-t border-border-subtle pt-4">
          <p className="text-body font-semibold text-text-primary">Items total</p>
          <p className="text-h2 font-semibold tabular text-text-primary">
            ৳{subtotal.toLocaleString()}
          </p>
        </div>

        <Button variant="primary" size="lg" fullWidth>
          Place order
        </Button>

        <p className="flex items-center justify-center gap-1.5 text-center text-caption text-text-tertiary">
          <ShieldCheckIcon className="size-4 shrink-0" />
          Secure checkout · 7-day returns
        </p>
      </div>
    </aside>
  );
}
