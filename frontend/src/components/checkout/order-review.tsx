import Link from "next/link";
import { AppImage } from "@/components/ui/app-image";
import { Button } from "@/components/ui/button";
import { ShieldCheckIcon } from "@/components/ui/icons";
import type { CartLine } from "@/lib/catalog/cart-fixture";
import { FREE_SHIPPING_THRESHOLD, SHIPPING_FLAT } from "@/lib/catalog/cart-fixture";

/**
 * The checkout-side twin of OrderSummary: the same totals, but the lines are
 * read-only thumbnails rather than editable rows.
 */
export function OrderReview({
  lines,
  subtotal,
  saved,
}: {
  lines: CartLine[];
  subtotal: number;
  saved: number;
}) {
  const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FLAT;
  const total = subtotal + shipping;

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
            <li key={line.id} className="flex items-center gap-3">
              <div className="relative size-14 shrink-0 overflow-hidden rounded-md bg-bg-sunken">
                <AppImage
                  src={line.product.image}
                  alt={line.product.alt}
                  fill
                  sizes="56px"
                  className="object-cover"
                />
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-small font-medium text-text-primary">
                  {line.product.name}
                </p>
                {/* Quantity rides the variant line rather than sitting as a
                    badge over the thumbnail, which covered the product. */}
                <p className="flex flex-wrap items-center gap-x-1.5 text-caption text-text-tertiary">
                  <span>
                    {line.color} · Size {line.size}
                  </span>
                  <span aria-hidden="true" className="text-border-default">
                    |
                  </span>
                  <span>
                    Qty{" "}
                    <span className="font-medium tabular text-text-secondary">
                      {line.quantity}
                    </span>
                  </span>
                </p>
              </div>

              <p className="shrink-0 text-small font-semibold tabular text-text-primary">
                ৳{(line.product.price * line.quantity).toLocaleString()}
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
              <dt className="text-text-secondary">Discounts</dt>
              <dd className="font-medium tabular text-success-text">
                −৳{saved.toLocaleString()}
              </dd>
            </div>
          ) : null}
          <div className="flex justify-between">
            <dt className="text-text-secondary">Delivery</dt>
            <dd className="font-medium tabular text-text-primary">
              {shipping ? `৳${shipping}` : "Free"}
            </dd>
          </div>
        </dl>

        <div className="flex items-baseline justify-between border-t border-border-subtle pt-4">
          <p className="text-body font-semibold text-text-primary">Total</p>
          <p className="text-h2 font-semibold tabular text-text-primary">
            ৳{total.toLocaleString()}
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
