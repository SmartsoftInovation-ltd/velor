"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { NavIcon } from "./nav-icons";

/**
 * The item paints no ground of its own — PrimaryNav slides one brand pill
 * behind whichever item is hovered, focused or current. The label goes white
 * on hover to stay legible once that pill arrives underneath it.
 */
export function NavLinkItem({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <Link
      href={href}
      data-nav-item
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative z-1 flex items-center gap-2 rounded-full px-4 py-2 text-small font-medium whitespace-nowrap transition-colors duration-200 ease-[var(--ease-hover)]",
        active ? "text-white" : "text-text-secondary hover:text-white",
      )}
    >
      <NavIcon href={href} className="size-[18px] shrink-0" />
      {label}
    </Link>
  );
}
