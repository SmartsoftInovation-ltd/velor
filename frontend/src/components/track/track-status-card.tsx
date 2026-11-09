import { PackageIcon } from "@/components/track/track-icons";
import { Badge } from "@/components/ui/badge";
import { TruckIcon } from "@/components/ui/icons";
import { STAGE_ORDER, stageOf, statusHeadline, type TrackedOrderDetails } from "@/lib/track";

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
 * panel, so the one line that matters reads first.
 */
export function TrackStatusCard({ order }: { order: TrackedOrderDetails }) {
  const stage = stageOf(order.orderStatus);
  const cancelled = !stage;
  const step = stage ? STAGE_ORDER.indexOf(stage) + 1 : 0;
  const percent = Math.round((step / STAGE_ORDER.length) * 100);

  return (
    <section className="overflow-hidden rounded-xl border border-border-subtle bg-bg-surface shadow-sm">
      <div
        className={
          cancelled
            ? "flex flex-wrap items-start justify-between gap-4 bg-danger-solid p-5 text-white sm:p-6"
            : "flex flex-wrap items-start justify-between gap-4 bg-brand-500 p-5 text-on-brand sm:p-6"
        }
      >
        <div className="min-w-0 space-y-1">
          <p className="text-caption opacity-80">Invoice {order.invoiceId}</p>
          <h2 className="text-h2 font-semibold">{statusHeadline(order.orderStatus)}</h2>
          <p className="text-small opacity-90">
            {cancelled ? "This order was cancelled." : `Placed ${formatDay(order.placedAt)}`}
          </p>
        </div>

        <span
          aria-hidden="true"
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-white/15"
        >
          <PackageIcon className="size-6" />
        </span>
      </div>

      {cancelled ? null : (
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

          {order.courier.name ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border-subtle pt-4">
              <span className="flex items-center gap-2 text-small text-text-secondary">
                <TruckIcon className="size-4 shrink-0 text-text-tertiary" />
                {order.courier.name}
              </span>
              {order.courier.trackingId ? (
                <Badge tone="info" variant="subtle" size="sm">
                  {order.courier.trackingId}
                </Badge>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
