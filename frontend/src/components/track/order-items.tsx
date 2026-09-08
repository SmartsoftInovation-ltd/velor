import { AppImage } from "@/components/ui/app-image";
import type { TrackedOrder } from "@/lib/catalog/order-fixture";

/** The parcel's contents plus totals — read-only, mirrors the checkout review. */
export function OrderItems({ order }: { order: TrackedOrder }) {
  const subtotal = order.lines.reduce(
    (sum, line) => sum + line.product.price * line.quantity,
    0,
  );
  const total = subtotal + order.shipping;

  return (
    <section className="rounded-xl border border-border-subtle bg-bg-surface p-5 shadow-xs sm:p-6">
      <h2 className="mb-4 text-body font-semibold text-text-primary">
        Items in this parcel
      </h2>

      <ul className="space-y-3">
        {order.lines.map((line) => (
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

      <dl className="mt-4 space-y-2.5 border-t border-border-subtle pt-4 text-small">
        <div className="flex justify-between">
          <dt className="text-text-secondary">Subtotal</dt>
          <dd className="font-medium tabular text-text-primary">
            ৳{subtotal.toLocaleString()}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-text-secondary">Delivery</dt>
          <dd className="font-medium tabular text-text-primary">
            {order.shipping ? `৳${order.shipping}` : "Free"}
          </dd>
        </div>
        <div className="flex items-baseline justify-between border-t border-border-subtle pt-3">
          <dt className="text-body font-semibold text-text-primary">Total paid</dt>
          <dd className="text-h3 font-semibold tabular text-text-primary">
            ৳{total.toLocaleString()}
          </dd>
        </div>
      </dl>
    </section>
  );
}
