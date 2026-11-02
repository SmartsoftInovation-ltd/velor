"use client";

import { useState, type ReactNode } from "react";
import { CloseIcon } from "@/components/ui/icons";

/**
 * Wraps the sidebar in a drawer below lg. The filters themselves stay server
 * components — this only owns the open/closed state and renders them through
 * `children`, so none of the filter markup ships to the browser.
 */
export function MobileFilters({
  activeCount,
  children,
}: {
  activeCount: number;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-10 items-center gap-2 rounded-md border border-border-default bg-bg-surface px-4 text-small font-medium text-text-primary shadow-xs transition-colors duration-150 hover:border-border-strong hover:bg-bg-hover"
      >
        Filters
        {activeCount ? (
          <span className="flex size-5 items-center justify-center rounded-full bg-brand-500 text-micro font-semibold text-on-brand">
            {activeCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex">
          <button
            type="button"
            aria-label="Close filters"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-bg-inverse/40 backdrop-blur-[2px]"
          />
          <div className="relative flex h-full w-80 max-w-[88vw] flex-col bg-bg-elevated shadow-xl">
            <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
              <h2 className="text-body font-semibold text-text-primary">Filters</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close filters"
                className="flex size-9 items-center justify-center rounded-full text-text-secondary transition-colors duration-150 hover:bg-bg-hover hover:text-text-primary"
              >
                <CloseIcon className="size-5" />
              </button>
            </div>
            {/* Every control inside is a link, so picking one navigates and the
                drawer unmounts with the page — no close handler needed. */}
            <div className="flex-1 overflow-y-auto p-4">{children}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
