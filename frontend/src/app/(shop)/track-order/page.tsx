import type { Metadata } from "next";
import { OrderItems } from "@/components/track/order-items";
import { ShipmentDetails } from "@/components/track/shipment-details";
import { TrackForm } from "@/components/track/track-form";
import { TrackStatusCard } from "@/components/track/track-status-card";
import { TrackTimeline } from "@/components/track/track-timeline";
import { Breadcrumb } from "@/components/shop/breadcrumb";
import { CURRENT_STAGE, TRACKED_ORDER } from "@/lib/catalog/order-fixture";

export const metadata: Metadata = {
  title: "Track order",
  description:
    "Follow your parcel from our warehouse to your door using an invoice or phone number.",
};

/**
 * Design only. The lookup form does not submit and runs no query — the fixture
 * order below always renders, standing in for a result.
 */
export default function TrackOrderPage() {
  const order = TRACKED_ORDER;

  return (
    <main className="container py-6">
      <Breadcrumb
        items={[{ label: "Home", href: "/" }, { label: "Track order" }]}
      />

      <div className="mt-6 mb-8 max-w-2xl space-y-3">
        <h1 className="text-h1 font-semibold text-text-primary">Track your order</h1>
        <p className="text-body text-text-secondary">
          Enter the invoice number from your confirmation email, or the phone
          number you used at checkout.
        </p>
      </div>

      <div className="mb-8">
        <TrackForm />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_23rem]">
        <div className="space-y-4">
          <TrackStatusCard order={order} />

          <section className="rounded-xl border border-border-subtle bg-bg-surface p-5 shadow-xs sm:p-6">
            <h2 className="mb-5 text-body font-semibold text-text-primary">
              Progress
            </h2>
            <TrackTimeline events={order.events} current={CURRENT_STAGE} />
          </section>

          <ShipmentDetails order={order} />
        </div>

        {/* Sticky on desktop: the parcel contents stay in view while the
            timeline scrolls. */}
        <div className="lg:sticky lg:top-32">
          <OrderItems order={order} />
        </div>
      </div>
    </main>
  );
}
