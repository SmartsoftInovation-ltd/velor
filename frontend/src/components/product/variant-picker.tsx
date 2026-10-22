"use client";

import type { ProductVariant } from "@/lib/catalog/types";
import { cn } from "@/lib/cn";

/**
 * The product's buyable options as chips. The price and stock of the
 * selected one are shown above by ProductPurchase.
 */
export function VariantPicker({
  variants,
  selectedId,
  onSelect,
}: {
  variants: ProductVariant[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const selected = variants.find((variant) => variant.id === selectedId) ?? variants[0];

  return (
    <div className="space-y-2">
      <p className="text-small text-text-secondary">
        Option: <span className="font-medium text-text-primary">{selected.label}</span>
      </p>
      <ul className="flex flex-wrap gap-2">
        {variants.map((variant) => {
          const soldOut = variant.stock <= 0;
          const active = variant.id === selected.id;
          return (
            <li key={variant.id}>
              <button
                type="button"
                onClick={() => onSelect(variant.id)}
                aria-pressed={active}
                className={cn(
                  "flex h-10 items-center justify-center rounded-md border px-3 text-small font-medium transition-colors duration-200 ease-[var(--ease-hover)]",
                  active
                    ? "border-brand-500 bg-brand-500 text-white"
                    : "border-border-default text-text-secondary hover:border-border-strong hover:bg-bg-hover hover:text-text-primary",
                  soldOut && !active && "border-border-subtle bg-bg-sunken text-text-tertiary line-through",
                )}
              >
                {variant.label}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
