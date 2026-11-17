import type { Metadata } from "next";
import { headers } from "next/headers";
import { AboutHeading } from "@/components/about/about-heading";
import { AboutMission } from "@/components/about/about-mission";
import { AboutOffers } from "@/components/about/about-offers";
import { Breadcrumb } from "@/components/shop/breadcrumb";
import { getStore, storeHostFrom } from "@/lib/store-api";

export const metadata: Metadata = {
  alternates: { canonical: "/about" },
  title: "About us",
  description: "Who we are, what we offer and why customers trust us.",
};

const DEFAULT_INTRO =
  "We are committed to delivering exceptional shopping experiences with a wide range of products, unbeatable service and total satisfaction.";

// Name, logo, slogan and business type come from Settings → Site Information
export default async function AboutPage() {
  const store = await getStore(storeHostFrom(await headers()));
  const name = store?.name || "our store";

  return (
    <main className="container space-y-20 py-6 pb-20">
      <div>
        <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "About Us" }]} />
        <header className="mx-auto mt-8 max-w-2xl space-y-4 text-center">
          <h1 className="text-h1 font-semibold tracking-tight text-text-primary">About {name}</h1>
          <p className="text-body text-text-secondary">
            Welcome to {name}, where convenience meets quality. {store?.slogan?.trim() || DEFAULT_INTRO}
          </p>
        </header>
      </div>

      <div className="mx-auto max-w-5xl space-y-20">
        <AboutMission name={name} logo={store?.logo} businessType={store?.businessType} />
        <AboutOffers />

        <section aria-labelledby="why-trust-us" className="mx-auto max-w-2xl space-y-6 text-center">
          <AboutHeading id="why-trust-us">Why Customers Trust Us</AboutHeading>
          <p className="text-body text-text-secondary">
            With satisfied customers, verified reviews and an unwavering commitment to quality, {name} is built on
            trust, transparency and value. We keep improving our service to meet your expectations, every order,
            every time.
          </p>
        </section>
      </div>
    </main>
  );
}
