import { AppImage } from "@/components/ui/app-image";
import type { TrackedOrder } from "@/lib/track-order";

const taka = (amount: number) => `৳${amount.toLocaleString()}`;

/** The parcel's contents and totals, as the shop priced them at checkout */
export function OrderItems({ order }: { order: TrackedOrder }) {
  const paid = order.paymentStatus === "Paid";

  return (
    <section className="rounded-xl border border-border-subtle bg-bg-surface p-5 shadow-xs sm:p-6">
      <h2 className="mb-4 text-body font-semibold text-text-primary">Items in this parcel</h2>

      <ul className="space-y-3">
        {order.lines.map((line) => {
          const details = [line.option, line.color, line.size ? `Size ${line.size}` : ""].filter(Boolean);
          return (
            <li key={line.id} className="flex items-center gap-3">
              <div className="relative size-14 shrink-0 overflow-hidden rounded-md bg-bg-sunken">
                <AppImage
                  src={line.image || "/image-fallback.svg"}
                  alt={line.name}
                  fill
                  sizes="56px"
                  className="object-cover"
                />
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-small font-medium text-text-primary">{line.name}</p>
                <p className="flex flex-wrap items-center gap-x-1.5 text-caption text-text-tertiary">
                  {details.length ? (
                    <>
                      <span>{details.join(" · ")}</span>
                      <span aria-hidden="true" className="text-border-default">
                        |
                      </span>
                    </>
                  ) : null}
                  <span>
                    Qty <span className="font-medium tabular text-text-secondary">{line.quantity}</span>
                  </span>
                </p>
              </div>

              <p className="shrink-0 text-small font-semibold tabular text-text-primary">{taka(line.total)}</p>
            </li>
          );
        })}
      </ul>

      <dl className="mt-4 space-y-2.5 border-t border-border-subtle pt-4 text-small">
        <div className="flex justify-between">
          <dt className="text-text-secondary">Subtotal</dt>
          <dd className="font-medium tabular text-text-primary">{taka(order.subtotal)}</dd>
        </div>
        {order.discount > 0 ? (
          <div className="flex justify-between">
            <dt className="text-text-secondary">Discount</dt>
            <dd className="font-medium tabular text-success-text">−{taka(order.discount)}</dd>
          </div>
        ) : null}
        <div className="flex justify-between">
          <dt className="text-text-secondary">Delivery</dt>
          <dd className="font-medium tabular text-text-primary">{order.delivery ? taka(order.delivery) : "Free"}</dd>
        </div>
        <div className="flex items-baseline justify-between border-t border-border-subtle pt-3">
          <dt className="text-body font-semibold text-text-primary">{paid ? "Total paid" : "Total to pay"}</dt>
          <dd className="text-h3 font-semibold tabular text-text-primary">{taka(order.total)}</dd>
        </div>
      </dl>
    </section>
  );
}
