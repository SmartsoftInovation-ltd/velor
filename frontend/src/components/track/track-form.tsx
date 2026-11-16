"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PhoneIcon } from "@/components/ui/icons-footer";
import { SearchIcon } from "@/components/ui/icons-nav";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";

const MODES = [
  {
    id: "invoice",
    label: "Invoice number",
    placeholder: "e.g. INV-2026-0001",
    hint: "Shown after checkout and in your confirmation.",
    type: "text",
    autoComplete: "off",
    inputMode: "text",
    maxLength: 64,
  },
  {
    id: "phone",
    label: "Phone number",
    placeholder: "01XXXXXXXXX",
    hint: "The number you gave at checkout. Shows your recent orders.",
    type: "tel",
    autoComplete: "tel",
    inputMode: "tel",
    maxLength: 20,
  },
] as const;

type Mode = (typeof MODES)[number]["id"];

/**
 * Look up by invoice number or by phone, one at a time. A plain GET form, so
 * the search works without JavaScript and a result can be bookmarked; the
 * tabs only choose which field is sent.
 */
export function TrackForm({ mode: initialMode = "invoice", value = "" }: { mode?: Mode; value?: string }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const active = MODES.find((item) => item.id === mode) ?? MODES[0];

  return (
    <form action="/track-order" method="get" className="rounded-xl border border-border-subtle bg-bg-surface p-5 shadow-sm sm:p-6">
      <div role="tablist" aria-label="Look up by" className="mb-5 inline-flex rounded-lg bg-bg-sunken p-1">
        {MODES.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={mode === item.id}
            onClick={() => setMode(item.id)}
            className={cn(
              "rounded-md px-3 py-1.5 text-small font-medium transition-colors duration-150",
              mode === item.id ? "bg-bg-surface text-text-primary shadow-xs" : "text-text-secondary hover:text-text-primary",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* The card is full-bleed; the search row is capped so it does not read as a text area */}
      <div className="flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex-1">
          <label htmlFor="track-input" className="sr-only">
            {active.label}
          </label>
          <Input
            id="track-input"
            key={active.id}
            name={active.id}
            type={active.type}
            icon={active.id === "phone" ? <PhoneIcon /> : <SearchIcon />}
            inputMode={active.inputMode}
            autoComplete={active.autoComplete}
            placeholder={active.placeholder}
            maxLength={active.maxLength}
            defaultValue={active.id === initialMode ? value : ""}
            required
          />
          <p className="mt-1.5 text-micro text-text-tertiary">{active.hint}</p>
        </div>

        <Button type="submit" variant="primary" size="md" className="sm:w-32">
          Track
        </Button>
      </div>
    </form>
  );
}
