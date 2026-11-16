import type { Metadata } from "next";
import { InfoPage } from "@/components/info/info-page";
import { PolicySections } from "@/components/info/policy-sections";
import { RETURN_POLICY } from "@/lib/policies";

export const metadata: Metadata = {
  alternates: { canonical: "/returns" },
  title: "Return policy",
  description: "When and how you can return or exchange a product.",
};

export default function ReturnsPage() {
  return (
    <InfoPage title="Return policy" intro="When and how you can return or exchange a product.">
      <PolicySections sections={RETURN_POLICY} />
    </InfoPage>
  );
}
