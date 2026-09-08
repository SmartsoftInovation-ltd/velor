"use client";

import { useState } from "react";
import { COLORS } from "@/lib/catalog/taxonomy";
import { cn } from "@/lib/cn";
import { BuyActions } from "./buy-actions";

/**
 * Selection state only — there is no cart yet, so the buttons do not submit.
 * See `.claude/specs/product-page.md` for the endpoints this will call.
 */
export function ProductOptions({
  colors,
  sizes,
  soldOutSizes,
  stockCount,
  productName,
}: {
  colors: string[];
  sizes: string[];
  soldOutSizes: string[];
  stockCount: number;
  productName: string;
}) {
  const [color, setColor] = useState(colors[0]);
  const [size, setSize] = useState(
    () => sizes.find((item) => !soldOutSizes.includes(item)) ?? sizes[0],
  );
  const [qty, setQty] = useState(1);

  const soldOut = stockCount === 0;
  const max = Math.max(1, Math.min(stockCount, 10));
  const colorName = COLORS.find((item) => item.id === color)?.name ?? color;

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-small text-text-secondary">
          Colour: <span className="font-medium text-text-primary">{colorName}</span>
        </p>
        <ul className="flex flex-wrap gap-2">
          {colors.map((id) => {
            const swatch = COLORS.find((item) => item.id === id);
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => setColor(id)}
                  aria-label={swatch?.name ?? id}
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
                    style={{ backgroundColor: swatch?.swatch ?? "#999" }}
                  />
                </button>
              </li>
            );
          })}
        </ul>
      </div>

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
                        ? "border-brand-500 bg-brand-500 text-white"
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

      <BuyActions
        qty={qty}
        setQty={setQty}
        max={max}
        soldOut={soldOut}
        productName={productName}
      />
    </div>
  );
}
