"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { ChevronDownIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

/**
 * A collapsible facet group. Client only for the open/closed toggle — the
 * options inside stay server-rendered links, so filtering itself still costs
 * no JS.
 *
 * The body is hidden with a max-height transition rather than unmounted: a
 * height animation needs a measurable box, and the option lists here are short
 * enough that a generous cap animates cleanly.
 */
export function FilterSection({
  title,
  icon,
  defaultOpen = true,
  children,
}: {
  title: string;
  /** A 16px svg naming this facet — one per group, never repeated. */
  icon: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = `filter-${title.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <section className="border-b border-border-subtle py-4 first:pt-0 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={id}
        className="flex w-full items-center gap-2 text-left"
      >
        <span className="shrink-0 text-text-tertiary [&>svg]:size-4" aria-hidden="true">
          {icon}
        </span>
        <span className="flex-1 text-small font-semibold text-text-primary">
          {title}
        </span>
        <ChevronDownIcon
          className={cn(
            "size-4 shrink-0 text-text-tertiary transition-transform duration-200 ease-[var(--ease-hover)]",
            open && "rotate-180",
          )}
        />
      </button>

      <div
        id={id}
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-300 ease-[var(--ease-out)]",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <div className="pt-3">{children}</div>
        </div>
      </div>
    </section>
  );
}
