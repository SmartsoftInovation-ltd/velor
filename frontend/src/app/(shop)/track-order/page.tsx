import type { Metadata } from "next";
import { headers } from "next/headers";
import { FormAlert } from "@/components/auth/form-alert";
import { OrderItems } from "@/components/track/order-items";
import { ShipmentDetails } from "@/components/track/shipment-details";
import { TrackForm } from "@/components/track/track-form";
import { TrackStatusCard } from "@/components/track/track-status-card";
import { TrackTimeline } from "@/components/track/track-timeline";
import { PackageIcon } from "@/components/track/track-icons";
import Link from "next/link";
import { Breadcrumb } from "@/components/shop/breadcrumb";
import { cn } from "@/lib/cn";
import { NO_INDEX } from "@/lib/seo";
import { storeHostFrom } from "@/lib/store-api";
import { STATUS_TITLE, stageOf, trackOrder } from "@/lib/track-order";

export const metadata: Metadata = {
  alternates: { canonical: "/track-order" },
  // A result page carries someone's invoice and phone in its address
  robots: NO_INDEX,
  title: "Track order",
  description: "Follow your parcel using your invoice number or the phone number you used at checkout.",
};

const param = (value: string | string[] | undefined) => (typeof value === "string" ? value.trim() : "");

/**
 * Looks orders up by invoice number (?invoice=) or checkout phone (?phone=)
 * in the store this domain belongs to. A phone can match several orders:
 * they are listed, and ?order= picks the one shown (the newest by default).
 */
export default async function TrackOrderPage({ searchParams }: PageProps<"/track-order">) {
  const query = await searchParams;
  const invoice = param(query.invoice);
  const phone = invoice ? "" : param(query.phone);
  const host = storeHostFrom(await headers());
  const result = invoice
    ? await trackOrder(host, { invoice })
    : phone
      ? await trackOrder(host, { phone })
      : null;
  const orders = result && "orders" in result ? result.orders : [];
  const picked = param(query.order);
  const order = orders.find((o) => o.invoice === picked) ?? orders[0] ?? null;
  const stage = order ? stageOf(order.status) : null;

  return (
    <main className="container py-6">
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Track order" }]} />

      <div className="mt-6 mb-8 max-w-2xl space-y-3">
        <h1 className="text-h1 font-semibold text-text-primary">Track your order</h1>
        <p className="text-body text-text-secondary">
          Enter your invoice number, or the phone number you used at checkout.
        </p>
      </div>

      <div className="mb-8 space-y-4">
        <TrackForm mode={phone ? "phone" : "invoice"} value={invoice || phone} />
        {result && "error" in result ? <FormAlert>{result.error}</FormAlert> : null}
        {orders.length > 1 && order ? (
          <nav aria-label="Orders with this phone number" className="space-y-2">
            <p className="text-small font-medium text-text-secondary">
              {orders.length} orders placed with this number. Choose one:
            </p>
            <ul className="flex flex-wrap gap-2">
              {orders.map((o) => (
                <li key={o.invoice}>
                  <Link
                    href={`/track-order?phone=${encodeURIComponent(phone)}&order=${encodeURIComponent(o.invoice)}`}
                    aria-current={o.invoice === order.invoice ? "true" : undefined}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-small transition-colors duration-150",
                      o.invoice === order.invoice
                        ? "border-brand-500 bg-brand-500 text-on-brand"
                        : "border-border-default bg-bg-surface text-text-secondary hover:border-border-strong hover:text-text-primary",
                    )}
                  >
                    <span className="font-medium">{o.invoice}</span>
                    <span className="opacity-80">{STATUS_TITLE[o.status] ?? o.status}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </div>

      {order ? (
        <div className="grid items-start gap-6 lg:grid-cols-[1fr_23rem]">
          <div className="space-y-4">
            <TrackStatusCard order={order} />

            {stage ? (
              <section className="rounded-xl border border-border-subtle bg-bg-surface p-5 shadow-xs sm:p-6">
                <h2 className="mb-5 text-body font-semibold text-text-primary">Progress</h2>
                <TrackTimeline current={stage} placedAt={order.placedAt} updatedAt={order.updatedAt} />
              </section>
            ) : null}

            <ShipmentDetails order={order} />
          </div>

          {/* Sticky on desktop: the parcel contents stay in view while the timeline scrolls. */}
          <div className="lg:sticky lg:top-32">
            <OrderItems order={order} />
          </div>
        </div>
      ) : !result ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border-default px-6 py-14 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-bg-sunken text-text-tertiary">
            <PackageIcon className="size-6" />
          </span>
          <p className="text-body font-medium text-text-primary">Your order will show here</p>
          <p className="max-w-sm text-small text-text-secondary">
            Its status, progress, delivery address and the items in your parcel.
          </p>
        </div>
      ) : null}
    </main>
  );
}
