"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ChevronDownIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import type { NavLink } from "@/lib/nav-links";
import { NavIcon } from "./nav-icons";

export function CategoryDropdown({ link }: { link: NavLink }) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openNow = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const closeSoon = () => {
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  };

  return (
    <div
      className="relative"
      onMouseEnter={openNow}
      onMouseLeave={closeSoon}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        data-nav-item
        className={cn(
          "flex items-center gap-2 rounded-full px-4 py-2 text-small font-medium whitespace-nowrap transition-colors duration-200 ease-[var(--ease-hover)]",
          "relative z-1 outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40",
          open ? "text-text-primary" : "text-text-secondary",
        )}
      >
        <NavIcon href={link.href} className="size-[18px] shrink-0" />
        {link.label}
        <ChevronDownIcon
          className={cn(
            "size-4 transition-transform duration-200 ease-[var(--ease-hover)]",
            open && "rotate-180",
          )}
        />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute left-0 top-full z-20 mt-2 w-56 rounded-xl border border-border-subtle bg-bg-elevated p-2 shadow-lg"
        >
          {link.children?.map((child) => (
            <Link
              key={child.href}
              href={child.href}
              role="menuitem"
              className="block rounded-lg px-3 py-2 text-small text-text-secondary transition-colors duration-150 hover:bg-bg-hover hover:text-text-primary"
            >
              {child.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
