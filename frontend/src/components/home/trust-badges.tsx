import {
  HeadsetIcon,
  ReturnIcon,
  ShieldCheckIcon,
  TruckIcon,
} from "@/components/ui/icons";
import { TRUST_BADGES, type TrustBadge } from "@/lib/trust-badges";

const ICONS: Record<TrustBadge["icon"], typeof TruckIcon> = {
  truck: TruckIcon,
  headset: HeadsetIcon,
  shield: ShieldCheckIcon,
  return: ReturnIcon,
};

export function TrustBadges() {
  return (
    <section className="border-b border-border-subtle bg-bg-surface">
      <ul className="container grid grid-cols-1 gap-x-8 gap-y-6 py-8 sm:grid-cols-2 lg:grid-cols-4">
        {TRUST_BADGES.map((badge) => {
          const Icon = ICONS[badge.icon];
          return (
            <li
              key={badge.id}
              className="group flex items-center gap-4 lg:border-l lg:border-border-subtle lg:pl-6 lg:first:border-l-0 lg:first:pl-0"
            >
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-600 transition-transform duration-300 ease-[var(--ease-hover)] group-hover:scale-105">
                <Icon className="size-6" />
              </span>
              <div className="space-y-0.5">
                <p className="text-body font-semibold text-text-primary">
                  {badge.title}
                </p>
                <p className="text-small text-text-secondary">
                  {badge.description}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
