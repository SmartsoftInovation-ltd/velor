import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { ContactDetails } from "@/components/info/contact-details";
import { InfoPage } from "@/components/info/info-page";
import { SocialLinks } from "@/components/info/social-links";
import { getStore, storeHostFrom } from "@/lib/store-api";

export const metadata: Metadata = {
  alternates: { canonical: "/about" },
  title: "About us",
  description: "Who we are and how to reach us.",
};

// Name, slogan, business type and contact details come from Settings → Store Information
export default async function AboutPage() {
  const store = await getStore(storeHostFrom(await headers()));
  const name = store?.name || "our shop";

  return (
    <InfoPage title="About us" intro={store?.slogan || `Welcome to ${name}.`}>
      <div className="max-w-4xl space-y-8">
        <div className="max-w-3xl space-y-4 text-body text-text-secondary">
          <p>
            <strong className="font-semibold text-text-primary">{name}</strong>
            {store?.businessType ? ` is a ${store.businessType} business` : " is an online shop"} built around one idea:
            good products at a fair price, delivered to your door without trouble.
          </p>
          <p>
            Every product is checked before it is packed, prices are shown in full before you pay, and a real person
            answers when you call. If something is not right, our return policy makes it easy to fix.
          </p>
          <p className="flex flex-wrap gap-x-6 gap-y-2 text-small font-medium">
            <Link href="/shop" className="text-text-brand hover:opacity-80">Browse the shop</Link>
            <Link href="/shipping" className="text-text-brand hover:opacity-80">Shipping info</Link>
            <Link href="/returns" className="text-text-brand hover:opacity-80">Return policy</Link>
          </p>
        </div>

        <section aria-labelledby="reach-us" className="space-y-4">
          <h2 id="reach-us" className="text-h2 font-semibold tracking-tight text-text-primary">Reach us</h2>
          <ContactDetails store={store} />
          <SocialLinks store={store} />
        </section>
      </div>
    </InfoPage>
  );
}
