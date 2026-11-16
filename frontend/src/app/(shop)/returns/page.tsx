import type { Metadata } from "next";
import { headers } from "next/headers";
import { InfoPage } from "@/components/info/info-page";
import { PolicySections } from "@/components/info/policy-sections";
import { RichText } from "@/components/info/rich-text";
import { RETURN_POLICY } from "@/lib/policies";
import { getReturnPolicy } from "@/lib/return-policy";
import { storeHostFrom } from "@/lib/store-api";

export const metadata: Metadata = {
  alternates: { canonical: "/returns" },
  title: "Return policy",
  description: "When and how you can return or exchange a product.",
};

// The store's own policy from the dashboard; the default one until it writes one
export default async function ReturnsPage() {
  const policy = await getReturnPolicy(storeHostFrom(await headers()));

  return (
    <InfoPage title="Return policy" intro="When and how you can return or exchange a product.">
      {policy ? <RichText html={policy} /> : <PolicySections sections={RETURN_POLICY} />}
    </InfoPage>
  );
}
