import { HeadsetIcon } from "@/components/ui/icons";
import { ClockIcon } from "@/components/ui/icons-footer";
import {
  BagIcon,
  BoxIcon,
  GridIcon,
  HomeIcon,
  SparkleIcon,
  TagIcon,
} from "@/components/ui/icons-nav";

/**
 * Icon per nav destination, keyed by href. Lives here rather than in
 * `lib/nav-links.ts` because that module stays JSX-free.
 */
const ICONS = {
  "/": HomeIcon,
  "/shop": BagIcon,
  "/category": GridIcon,
  "/shop/new-arrivals": SparkleIcon,
  "/shop/offers": TagIcon,
  "/shop/limited-offers": ClockIcon,
  "/track-order": BoxIcon,
  "/contact": HeadsetIcon,
} as const;

export function NavIcon({
  href,
  className,
}: {
  href: string;
  className?: string;
}) {
  const Icon = ICONS[href as keyof typeof ICONS];
  return Icon ? <Icon className={className} /> : null;
}
