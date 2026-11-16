import { MapPinIcon, PhoneIcon } from "@/components/ui/icons-footer";
import type { TrackedOrder } from "@/lib/track-order";

function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Dhaka",
  });
}

export function ShipmentDetails({ order }: { order: TrackedOrder }) {
  return (
    <section className="rounded-xl border border-border-subtle bg-bg-surface p-5 shadow-xs sm:p-6">
      <h2 className="mb-4 text-body font-semibold text-text-primary">
        Shipment details
      </h2>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <p className="flex items-center gap-1.5 text-caption font-medium text-text-tertiary">
            <MapPinIcon className="size-4 shrink-0" />
            Delivering to
          </p>
          <p className="text-small font-medium text-text-primary">{order.recipient}</p>
          {order.address ? <p className="text-caption text-text-secondary">{order.address}</p> : null}
        </div>

        <div className="space-y-1.5">
          <p className="flex items-center gap-1.5 text-caption font-medium text-text-tertiary">
            <PhoneIcon className="size-4 shrink-0" />
            Contact
          </p>
          <p className="text-small font-medium tabular text-text-primary">{order.phone}</p>
          <p className="text-caption text-text-secondary">
            The rider calls before arriving.
          </p>
        </div>

        <dl className="space-y-2 border-t border-border-subtle pt-4 text-caption sm:col-span-2 sm:grid sm:grid-cols-3 sm:space-y-0 sm:gap-4">
          <div className="flex justify-between sm:block sm:space-y-1">
            <dt className="text-text-tertiary">Order placed</dt>
            <dd className="font-medium text-text-primary">{formatDay(order.placedAt)}</dd>
          </div>
          <div className="flex justify-between sm:block sm:space-y-1">
            <dt className="text-text-tertiary">Payment</dt>
            <dd className="font-medium text-text-primary">
              {order.paymentMethod}
              {order.paymentStatus ? <span className="font-normal text-text-tertiary"> · {order.paymentStatus}</span> : null}
            </dd>
          </div>
          <div className="flex justify-between sm:block sm:space-y-1">
            <dt className="text-text-tertiary">Tracking number</dt>
            <dd className="font-medium tabular text-text-primary">
              {order.trackingNumber || "Not booked yet"}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
