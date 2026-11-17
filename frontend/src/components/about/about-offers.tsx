import type { ComponentType } from "react";
import { HeadsetIcon, ReturnIcon, ShieldCheckIcon, TruckIcon } from "@/components/ui/icons";
import { BagIcon, TagIcon } from "@/components/ui/icons-nav";
import { AboutHeading } from "./about-heading";

type Offer = { Icon: ComponentType<{ className?: string }>; title: string; text: string };

const OFFERS: Offer[] = [
  { Icon: BagIcon, title: "Wide Product Range", text: "Everything you need, from everyday basics to new favourites, all in one place." },
  { Icon: TruckIcon, title: "Fast & Reliable Delivery", text: "We deliver quickly and safely to your doorstep, nationwide." },
  { Icon: ReturnIcon, title: "Easy Returns", text: "Not satisfied? Enjoy a simple and fair return policy." },
  { Icon: ShieldCheckIcon, title: "Secure Payments", text: "Shop with confidence using trusted payment gateways." },
  { Icon: HeadsetIcon, title: "24/7 Support", text: "Our team is always ready to help you via chat, email or phone." },
  { Icon: TagIcon, title: "Exciting Deals", text: "Enjoy daily discounts, offers and seasonal promotions." },
];

export function AboutOffers() {
  return (
    <section aria-labelledby="what-we-offer" className="space-y-10">
      <AboutHeading id="what-we-offer">What We Offer</AboutHeading>
      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {OFFERS.map(({ Icon, title, text }) => (
          <li
            key={title}
            className="h-full space-y-3 rounded-xl border border-border-subtle bg-bg-surface p-5 shadow-sm transition-shadow duration-200 hover:shadow-md"
          >
            <span className="flex size-10 items-center justify-center rounded-lg bg-brand-500/10 text-brand-500">
              <Icon className="size-5" />
            </span>
            <h3 className="text-body font-semibold text-text-primary">{title}</h3>
            <p className="text-small text-text-secondary">{text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
