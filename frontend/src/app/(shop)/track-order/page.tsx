import type { Metadata } from "next";
import { Breadcrumb } from "@/components/shop/breadcrumb";
import { TrackForm } from "@/components/track/track-form";

export const metadata: Metadata = {
  alternates: { canonical: "/track-order" },
  title: "Track order",
  description:
    "Follow your parcel from our warehouse to your door using your invoice and phone number.",
};

export default function TrackOrderPage() {
  return (
    <main className="container py-6">
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Track order" }]} />

      <div className="mt-6 mb-8 max-w-2xl space-y-3">
        <h1 className="text-h1 font-semibold text-text-primary">Track your order</h1>
        <p className="text-body text-text-secondary">
          Enter the invoice number from your order confirmation and the phone
          number you used at checkout.
        </p>
      </div>

      <TrackForm />
    </main>
  );
}
