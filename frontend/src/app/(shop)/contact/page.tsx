import type { Metadata } from "next";
import { headers } from "next/headers";
import { ContactDetails } from "@/components/info/contact-details";
import { InfoPage } from "@/components/info/info-page";
import { SocialLinks } from "@/components/info/social-links";
import { getStore, storeHostFrom } from "@/lib/store-api";

export const metadata: Metadata = {
  alternates: { canonical: "/contact" },
  title: "Contact us",
  description: "Call, email or visit the shop.",
};

// Everything here is what the seller saved under Settings → Store Information
export default async function ContactPage() {
  const store = await getStore(storeHostFrom(await headers()));

  return (
    <InfoPage title="Contact us" intro="A question about a product or an order? Call, email or visit us.">
      <div className="max-w-4xl space-y-6">
        <ContactDetails store={store} />
        <SocialLinks store={store} />
      </div>
    </InfoPage>
  );
}
