import type { Metadata } from "next";
import { InfoPage } from "@/components/info/info-page";
import { PolicySections } from "@/components/info/policy-sections";
import { SHIPPING_POLICY } from "@/lib/policies";

export const metadata: Metadata = {
  alternates: { canonical: "/shipping" },
  title: "Shipping info",
  description: "Where we deliver, how long it takes and what it costs.",
};

export default function ShippingPage() {
  return (
    <InfoPage title="Shipping info" intro="Where we deliver, how long it takes and what it costs.">
      <PolicySections sections={SHIPPING_POLICY} />
    </InfoPage>
  );
}
