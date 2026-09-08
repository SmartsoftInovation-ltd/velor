"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { NAV_LINKS } from "@/lib/nav-links";
import { cn } from "@/lib/cn";
import { CategoryDropdown } from "./category-dropdown";
import { NavLinkItem } from "./nav-link";

type Rect = { left: number; width: number };

/**
 * One brand pill slides between the items rather than each item painting its
 * own. It follows hover and keyboard focus and settles back on the current
 * route, so moving through the nav reads as a single object travelling — the
 * per-item version cross-faded two grounds and looked like a flicker.
 */
export function PrimaryNav({ className }: { className?: string }) {
  const listRef = useRef<HTMLUListElement>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const pathname = usePathname();

  const moveTo = (el: HTMLElement | null) => {
    if (el) setRect({ left: el.offsetLeft, width: el.offsetWidth });
  };

  const settle = useCallback(() => {
    const current = listRef.current?.querySelector<HTMLElement>(
      '[data-nav-item][aria-current="page"]',
    );
    setRect(
      current ? { left: current.offsetLeft, width: current.offsetWidth } : null,
    );
  }, []);

  // Re-settles after a route change, once the new aria-current has rendered.
  useEffect(settle, [settle, pathname]);

  return (
    <nav aria-label="Primary" className={className}>
      <ul
        ref={listRef}
        onMouseLeave={settle}
        onMouseOver={(event) =>
          moveTo(
            (event.target as HTMLElement).closest<HTMLElement>("[data-nav-item]"),
          )
        }
        onFocus={(event) =>
          moveTo(
            (event.target as HTMLElement).closest<HTMLElement>("[data-nav-item]"),
          )
        }
        onBlur={(event) => {
          if (!listRef.current?.contains(event.relatedTarget as Node)) settle();
        }}
        className="relative flex items-center gap-1"
      >
        <span
          aria-hidden="true"
          style={rect ? { width: rect.width, transform: `translateX(${rect.left}px)` } : undefined}
          className={cn(
            "pointer-events-none absolute inset-y-0 left-0 rounded-full bg-brand-500 shadow-sm",
            "transition-[transform,width,opacity] duration-300 ease-[var(--ease-out)]",
            rect ? "opacity-100" : "opacity-0",
          )}
        />

        {NAV_LINKS.map((link) =>
          link.children ? (
            <li key={link.href}>
              <CategoryDropdown link={link} />
            </li>
          ) : (
            <li key={link.href}>
              <NavLinkItem href={link.href} label={link.label} />
            </li>
          ),
        )}
      </ul>
    </nav>
  );
}
