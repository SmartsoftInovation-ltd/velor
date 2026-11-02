import Link from "next/link";
import { ArrowRightIcon, ShieldCheckIcon } from "@/components/ui/icons";

/**
 * The cart's totals. Delivery and coupons depend on the address and are
 * applied at checkout, so the total here is the items only.
 */
export function OrderSummary({
  subtotal,
  saved,
  count,
}: {
  subtotal: number;
  saved: number;
  count: number;
}) {

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
              <dt className="text-text-secondary">You save</dt>
              <dd className="font-medium tabular text-success-text">
                −৳{saved.toLocaleString()}
              </dd>
            </div>
          ) : null}
          <div className="flex justify-between">
            <dt className="text-text-secondary">Delivery</dt>
            <dd className="text-text-tertiary">At checkout</dd>
          </div>
        </dl>

        <div className="flex items-baseline justify-between border-t border-border-subtle pt-4">
          <p className="text-body font-semibold text-text-primary">Total</p>
          <p className="text-h2 font-semibold tabular text-text-primary">
            ৳{subtotal.toLocaleString()}
          </p>
        </div>

        {/* Button renders a <button>, and a <button> inside an <a> is invalid
            markup — so the link carries Button's own classes instead. */}
        <Link
          href="/checkout"
          className="shine relative inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-brand-500 px-5 text-body font-medium whitespace-nowrap text-on-brand shadow-brand transition-[background-color,box-shadow,transform] duration-200 ease-[var(--ease-hover)] hover:bg-brand-600 active:scale-[0.98] active:bg-brand-700"
        >
          Checkout
          <span className="relative z-2 flex shrink-0 [&>svg]:size-4" aria-hidden="true">
            <ArrowRightIcon />
          </span>
        </Link>

        <p className="flex items-center justify-center gap-1.5 text-caption text-text-tertiary">
          <ShieldCheckIcon className="size-4" />
          Prices are confirmed when you place the order
        </p>
      </div>
    </aside>
  );
}
