import { HeadsetIcon } from "@/components/ui/icons";
import {
  BagIcon,
  BoxIcon,
  CrownIcon,
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
  "/shop/best-sellers": CrownIcon,
  "/shop/offers": TagIcon,
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
