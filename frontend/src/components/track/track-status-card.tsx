import { PackageIcon } from "@/components/track/track-icons";
import { Badge } from "@/components/ui/badge";
import { TruckIcon } from "@/components/ui/icons";
import type { TrackedOrder } from "@/lib/catalog/order-fixture";
import { CURRENT_STAGE, STAGE_ORDER } from "@/lib/catalog/order-fixture";

function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Asia/Dhaka",
  });
}

/**
 * The banner that answers "where is it" before any scrolling. A brand-filled
 * panel, so the one number that matters reads first.
 */
export function TrackStatusCard({ order }: { order: TrackedOrder }) {
  const step = STAGE_ORDER.indexOf(CURRENT_STAGE) + 1;
  const percent = Math.round((step / STAGE_ORDER.length) * 100);

  return (
    <section className="overflow-hidden rounded-xl border border-border-subtle bg-bg-surface shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4 bg-brand-500 p-5 text-white sm:p-6">
        <div className="min-w-0 space-y-1">
          <p className="text-caption text-white/80">Invoice {order.invoice}</p>
          <h2 className="text-h2 font-semibold">In transit</h2>
          <p className="text-small text-white/90">
            Arriving by {formatDay(order.estimatedAt)}
          </p>
        </div>

        <span
          aria-hidden="true"
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-white/15"
        >
          <PackageIcon className="size-6" />
        </span>
      </div>

      <div className="space-y-4 p-5 sm:p-6">
        <div className="space-y-2">
          <div className="flex items-baseline justify-between text-caption">
            <span className="font-medium text-text-primary">
              Step {step} of {STAGE_ORDER.length}
            </span>
            <span className="tabular text-text-tertiary">{percent}%</span>
          </div>
          {/* Width is genuinely dynamic, so it stays an inline style. */}
          <div className="h-1.5 overflow-hidden rounded-full bg-bg-sunken">
            <div
              className="h-full rounded-full bg-brand-500 transition-[width] duration-500 ease-out"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border-subtle pt-4">
          <span className="flex items-center gap-2 text-small text-text-secondary">
            <TruckIcon className="size-4 shrink-0 text-text-tertiary" />
            {order.courier}
          </span>
          <Badge tone="info" variant="subtle" size="sm">
            {order.trackingNumber}
          </Badge>
        </div>
      </div>
    </section>
  );
}
