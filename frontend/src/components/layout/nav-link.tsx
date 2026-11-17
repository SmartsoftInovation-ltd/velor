"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { NAV_LINKS } from "@/lib/nav-links";
import { NavIcon } from "./nav-icons";

/**
 * The item paints no ground of its own — PrimaryNav slides one brand pill
 * behind the current route's item. No hover effect; keyboard focus gets a ring.
 */
const matches = (pathname: string, href: string) =>
  href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

/**
 * The nav item for this page: the longest href that matches, so on
 * /shop/new-arrivals it is New Arrivals, not Shop as well.
 */
const currentHref = (pathname: string) =>
  NAV_LINKS.map((link) => link.href)
    .filter((href) => matches(pathname, href))
    .sort((a, b) => b.length - a.length)[0];

export function NavLinkItem({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = currentHref(pathname) === href;

  return (
    <Link
      href={href}
      data-nav-item
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative z-1 flex items-center gap-2 rounded-full px-4 py-2 text-small font-medium whitespace-nowrap transition-colors duration-200 ease-[var(--ease-hover)] outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40",
        active ? "text-on-brand" : "text-text-secondary",
      )}
    >
      <NavIcon href={href} className="size-[18px] shrink-0" />
      {label}
    </Link>
  );
}
