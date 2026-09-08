"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

type Rect = { left: number; width: number };

/**
 * Wraps the header's three controls in one pill and slides a single ground
 * between them. The indicator follows hover and keyboard focus; with neither,
 * it rests on whichever child matches the current route, and hides when none
 * does — the theme toggle is not a destination, so nothing to rest on there.
 *
 * Children keep their own semantics: two links and a button, not tabs. The
 * indicator is decorative, so it carries no role and no aria state.
 */
export function HeaderActions({ children }: { children: ReactNode }) {
  const listRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const pathname = usePathname();

  const moveTo = (el: HTMLElement | null) => {
    if (el) setRect({ left: el.offsetLeft, width: el.offsetWidth });
  };

  /**
   * The resting slot: the link whose href prefixes the current route, and the
   * cart when none matches — one slot is always selected, so the indicator
   * never blinks out on a page that owns no slot of its own.
   */
  const settle = useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    const links = Array.from(
      list.querySelectorAll<HTMLAnchorElement>("a[data-slot]"),
    );
    const match =
      links.find((link) => pathname.startsWith(new URL(link.href).pathname)) ??
      list.querySelector<HTMLElement>('[data-slot="cart"]');
    if (match) setRect({ left: match.offsetLeft, width: match.offsetWidth });
  }, [pathname]);

  useEffect(settle, [settle]);

  return (
    <div
      ref={listRef}
      onMouseLeave={settle}
      onMouseOver={(event) =>
        moveTo((event.target as HTMLElement).closest<HTMLElement>("[data-slot]"))
      }
      onFocus={(event) =>
        moveTo((event.target as HTMLElement).closest<HTMLElement>("[data-slot]"))
      }
      onBlur={(event) => {
        if (!listRef.current?.contains(event.relatedTarget as Node)) settle();
      }}
      className="relative flex shrink-0 items-center gap-1 rounded-md border border-border-default bg-bg-surface p-1 shadow-xs"
    >
      {/* Width and offset are measured, so they have to be inline styles. Only
          the transform animates — moving via left/width would lay out on every
          frame. left-1 is the origin the translate is relative to, hence the
          -4px correction. */}
      <span
        aria-hidden="true"
        style={
          rect
            ? { width: rect.width, transform: `translateX(${rect.left - 4}px)` }
            : undefined
        }
        className={cnIndicator(rect !== null)}
      />
      {children}
    </div>
  );
}

function cnIndicator(visible: boolean) {
  return [
    "pointer-events-none absolute top-1 bottom-1 left-1 rounded-sm",
    "bg-brand-50 ring-1 ring-brand-500/20",
    "transition-[transform,width,opacity] duration-300 ease-[var(--ease-out)]",
    visible ? "opacity-100" : "opacity-0",
  ].join(" ");
}
