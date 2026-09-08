import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRightIcon, ShieldCheckIcon } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { FREE_SHIPPING_THRESHOLD, SHIPPING_FLAT } from "@/lib/catalog/cart-fixture";

export function OrderSummary({
  subtotal,
  saved,
  count,
}: {
  subtotal: number;
  saved: number;
  count: number;
}) {
  const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FLAT;
  const total = subtotal + shipping;

  return (
    <aside className="overflow-hidden rounded-xl border border-border-subtle bg-bg-surface shadow-sm">
      <div className="space-y-5 p-5">
        <h2 className="text-body font-semibold text-text-primary">Order summary</h2>

        <dl className="space-y-2.5 text-small">
          <div className="flex justify-between">
            <dt className="text-text-secondary">Items</dt>
            <dd className="font-medium tabular text-text-primary">{count}</dd>
          </div>
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

        <div className="flex gap-2">
          <Input
            placeholder="Discount code"
            aria-label="Discount code"
            className="flex-1"
          />
          <Button variant="secondary">Apply</Button>
        </div>

        {/* Button renders a <button>, and a <button> inside an <a> is invalid
            markup — so the link carries Button's own classes instead. */}
        <Link
          href="/checkout"
          className="shine relative inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-brand-500 px-5 text-body font-medium whitespace-nowrap text-white shadow-brand transition-[background-color,box-shadow,transform] duration-200 ease-[var(--ease-hover)] hover:bg-brand-600 active:scale-[0.98] active:bg-brand-700"
        >
          Checkout
          <span className="relative z-2 flex shrink-0 [&>svg]:size-4" aria-hidden="true">
            <ArrowRightIcon />
          </span>
        </Link>

        <p className="flex items-center justify-center gap-1.5 text-caption text-text-tertiary">
          <ShieldCheckIcon className="size-4" />
          Secure checkout · 7-day returns
        </p>
      </div>
    </aside>
  );
}
