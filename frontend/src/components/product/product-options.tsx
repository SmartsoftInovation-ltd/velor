"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

// Colour ids are lowercase dashboard names; "navy blue" paints as CSS `navyblue`
const colorName = (id: string) => id.replace(/\b\w/g, (c) => c.toUpperCase());
const swatchOf = (id: string) => id.replace(/\s+/g, "");

/** Colour and size pickers for a product without variants. Selection state only. */
export function ProductOptions({
  colors,
  sizes,
  soldOutSizes,
}: {
  colors: string[];
  sizes: string[];
  soldOutSizes: string[];
}) {
  const [color, setColor] = useState(colors[0]);
  const [size, setSize] = useState(
    () => sizes.find((item) => !soldOutSizes.includes(item)) ?? sizes[0],
  );
  if (!colors.length && !sizes.length) return null;

  return (
    <div className="space-y-5">
      {colors.length > 0 ? (
        <div className="space-y-2">
          <p className="text-small text-text-secondary">
            Colour:{" "}
            <span className="font-medium text-text-primary">
              {colorName(color)}
            </span>
          </p>
          <ul className="flex flex-wrap gap-2">
            {colors.map((id) => {
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => setColor(id)}
                    aria-label={colorName(id)}
                    aria-pressed={id === color}
                    className={cn(
                      "flex size-9 items-center justify-center rounded-full border transition-[border-color,box-shadow] duration-200 ease-[var(--ease-hover)]",
                      id === color
                        ? "border-brand-500 shadow-[0_0_0_2px_var(--color-brand-100)]"
                        : "border-border-default hover:border-border-strong",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className="size-6 rounded-full border border-black/10"
                      style={{ backgroundColor: swatchOf(id) }}
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {sizes.length > 0 ? (
        <div className="space-y-2">
          <p className="text-small text-text-secondary">
            Size: <span className="font-medium text-text-primary">{size}</span>
          </p>
          <ul className="flex flex-wrap gap-2">
            {sizes.map((item) => {
              const unavailable = soldOutSizes.includes(item);
              return (
                <li key={item}>
                  <button
                    type="button"
                    onClick={() => setSize(item)}
                    disabled={unavailable}
                    aria-pressed={item === size}
                    aria-label={unavailable ? `${item} — sold out` : undefined}
                    className={cn(
                      "relative flex h-10 min-w-12 items-center justify-center overflow-hidden rounded-md border px-3 text-small font-medium transition-colors duration-200 ease-[var(--ease-hover)]",
                      unavailable
                        ? "cursor-not-allowed border-border-subtle bg-bg-sunken text-text-tertiary"
                        : item === size
                          ? "border-brand-500 bg-brand-500 text-on-brand"
                          : "border-border-default text-text-secondary hover:border-border-strong hover:bg-bg-hover hover:text-text-primary",
                    )}
                  >
                    {/* The rule sits behind the label so the size stays legible —
                      the point is to say which size is gone, not to hide it. */}
                    {unavailable ? (
                      <span
                        aria-hidden="true"
                        className="absolute inset-0 flex items-center justify-center"
                      >
                        <span className="h-px w-[140%] rotate-[-24deg] bg-border-strong" />
                      </span>
                    ) : null}
                    <span className="relative">{item}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
