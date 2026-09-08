"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tab = { id: string; label: string; panel: ReactNode };

/**
 * Takes rendered panels as props, so the panel content stays server-rendered —
 * only the active-tab state lives in the browser.
 */
export function ProductTabs({ tabs }: { tabs: Tab[] }) {
  const [active, setActive] = useState(tabs[0]?.id);

  return (
    <div className="rounded-xl border border-border-subtle bg-bg-surface">
      <div role="tablist" className="flex gap-1 border-b border-border-subtle p-1.5">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={tab.id === active}
            aria-controls={`panel-${tab.id}`}
            onClick={() => setActive(tab.id)}
            className={cn(
              "flex-1 rounded-lg px-4 py-2.5 text-small font-medium transition-colors duration-200 ease-[var(--ease-hover)]",
              tab.id === active
                ? "bg-brand-100 text-text-brand"
                : "text-text-secondary hover:bg-bg-hover hover:text-text-primary",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`panel-${tab.id}`}
          aria-labelledby={`tab-${tab.id}`}
          hidden={tab.id !== active}
          className="p-6"
        >
          {tab.panel}
        </div>
      ))}
    </div>
  );
}
