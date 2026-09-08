"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SearchIcon } from "@/components/ui/icons-nav";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";

const MODES = [
  {
    id: "invoice",
    label: "Invoice number",
    placeholder: "TZ-2026-04821",
    hint: "Printed at the top of your confirmation email.",
    autoComplete: "off",
    inputMode: "text",
  },
  {
    id: "phone",
    label: "Phone number",
    placeholder: "+880 1XXX XXXXXX",
    hint: "The number you gave at checkout.",
    autoComplete: "tel",
    inputMode: "tel",
  },
] as const;

/**
 * The one client leaf on this page — switching between the two lookup modes
 * needs state. Nothing submits: there is no action and no query anywhere.
 */
export function TrackForm() {
  const [mode, setMode] = useState<(typeof MODES)[number]["id"]>("invoice");
  const active = MODES.find((item) => item.id === mode) ?? MODES[0];

  return (
    <div className="rounded-xl border border-border-subtle bg-bg-surface p-5 shadow-sm sm:p-6">
      <div
        role="tablist"
        aria-label="Look up by"
        className="mb-5 inline-flex rounded-lg bg-bg-sunken p-1"
      >
        {MODES.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={mode === item.id}
            onClick={() => setMode(item.id)}
            className={cn(
              "rounded-md px-3 py-1.5 text-small font-medium transition-colors duration-150",
              mode === item.id
                ? "bg-bg-surface text-text-primary shadow-xs"
                : "text-text-secondary hover:text-text-primary",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* The card is full-bleed, but a search field that runs the whole page
          width reads as a text area — cap the row, not the card. */}
      <div className="flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex-1">
          <label htmlFor="track-input" className="sr-only">
            {active.label}
          </label>
          <Input
            id="track-input"
            key={active.id}
            icon={<SearchIcon />}
            inputMode={active.inputMode}
            autoComplete={active.autoComplete}
            placeholder={active.placeholder}
          />
          <p className="mt-1.5 text-micro text-text-tertiary">{active.hint}</p>
        </div>

        <Button variant="primary" size="md" className="sm:w-32">
          Track
        </Button>
      </div>
    </div>
  );
}
