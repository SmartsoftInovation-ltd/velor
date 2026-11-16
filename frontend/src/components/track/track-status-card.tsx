import { PackageIcon } from "@/components/track/track-icons";
import { Badge } from "@/components/ui/badge";
import { TruckIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { STAGES, STATUS_TITLE, stageOf, type TrackedOrder } from "@/lib/track-order";

const formatDay = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Dhaka" });

/**
 * The banner that answers "where is it" before any scrolling: the order's
 * status, how far along it is, and the courier once one is booked.
 */
export function TrackStatusCard({ order }: { order: TrackedOrder }) {
  const stage = stageOf(order.status);
  const cancelled = stage === null;
  const step = cancelled ? 0 : STAGES.findIndex((s) => s.stage === stage) + 1;
  const percent = Math.round((step / STAGES.length) * 100);

  return (
    <section className="overflow-hidden rounded-xl border border-border-subtle bg-bg-surface shadow-sm">
      <div
        className={cn(
          "flex flex-wrap items-start justify-between gap-4 p-5 sm:p-6",
          cancelled ? "bg-danger-solid text-white" : "bg-brand-500 text-on-brand",
        )}
      >
        <div className="min-w-0 space-y-1">
          <p className="text-caption opacity-80">Invoice {order.invoice}</p>
          <h2 className="text-h2 font-semibold">{STATUS_TITLE[order.status] ?? order.status}</h2>
          <p className="text-small opacity-90">
            {cancelled ? `Cancelled on ${formatDay(order.updatedAt)}` : `Placed on ${formatDay(order.placedAt)}`}
          </p>
        </div>
        <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-full bg-white/15">
          <PackageIcon className="size-6" />
        </span>
      </div>

      <div className="space-y-4 p-5 sm:p-6">
        {cancelled ? (
          <p className="text-small text-text-secondary">This order was cancelled. Contact the shop if you have questions.</p>
        ) : (
          <div className="space-y-2">
            <div className="flex items-baseline justify-between text-caption">
              <span className="font-medium text-text-primary">
                Step {step} of {STAGES.length}
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
        )}

        {order.courier ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border-subtle pt-4">
            <span className="flex items-center gap-2 text-small text-text-secondary">
              <TruckIcon className="size-4 shrink-0 text-text-tertiary" />
              {order.courier}
            </span>
            {order.trackingNumber ? (
              <Badge tone="info" variant="subtle" size="sm">
                {order.trackingNumber}
              </Badge>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
