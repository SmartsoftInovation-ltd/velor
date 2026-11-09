import { OrderItems } from "@/components/track/order-items";
import { ShipmentDetails } from "@/components/track/shipment-details";
import { TrackStatusCard } from "@/components/track/track-status-card";
import { TrackTimeline } from "@/components/track/track-timeline";
import { stageOf, timelineOf, type TrackedOrderDetails } from "@/lib/track";

/** Everything the lookup found: progress, where it is going, and what is inside */
export function TrackResult({ order }: { order: TrackedOrderDetails }) {
  const stage = stageOf(order.orderStatus);

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_23rem]">
      <div className="space-y-4">
        <TrackStatusCard order={order} />

        {stage ? (
          <section className="rounded-xl border border-border-subtle bg-bg-surface p-5 shadow-xs sm:p-6">
            <h2 className="mb-5 text-body font-semibold text-text-primary">Progress</h2>
            <TrackTimeline events={timelineOf(order)} current={stage} />
          </section>
        ) : null}

        <ShipmentDetails order={order} />
      </div>

      {/* Sticky on desktop: the parcel contents stay in view while the
          timeline scrolls. */}
      <div className="lg:sticky lg:top-32">
        <OrderItems order={order} />
      </div>
    </div>
  );
}
