"use client";

import { AppImage } from "@/components/ui/app-image";
import type { ProductVariant } from "@/lib/catalog/types";
import { cn } from "@/lib/cn";
import { VariantPicker } from "./variant-picker";

const unique = (values: string[]) => [...new Set(values.filter(Boolean))];

/**
 * Colour and size pickers over a product's variants. A colour shows the photo
 * of its option; the sizes listed are the ones that colour comes in, struck
 * through when sold out. Variants named some other way fall back to chips.
 */
export function QuickViewOptions({
  variants,
  selected,
  onSelect,
}: {
  variants: ProductVariant[];
  selected: ProductVariant;
  onSelect: (variantId: string) => void;
}) {
  const colors = unique(variants.map((v) => v.color));
  const inColor = colors.length ? variants.filter((v) => v.color === selected.color) : variants;
  const sizes = unique(inColor.map((v) => v.size));

  if (variants.length < 2) return null;
  if (!colors.length && !sizes.length) {
    return <VariantPicker variants={variants} selectedId={selected.id} onSelect={onSelect} />;
  }

  // Keep the size when the new colour has it in stock, else its first buyable option
  const pickColor = (color: string) => {
    const options = variants.filter((v) => v.color === color);
    const next =
      options.find((v) => v.size === selected.size && v.stock > 0) ?? options.find((v) => v.stock > 0) ?? options[0];
    onSelect(next.id);
  };

  return (
    <div className="space-y-3">
      {colors.length > 0 ? (
        <div className="space-y-2">
          <p className="text-small font-medium text-text-primary">Select Color: {selected.color}</p>
          <ul className="flex flex-wrap gap-2">
            {colors.map((color) => {
              const photo = variants.find((v) => v.color === color && v.image)?.image;
              return (
                <li key={color}>
                  <button
                    type="button"
                    onClick={() => pickColor(color)}
                    aria-label={color}
                    aria-pressed={color === selected.color}
                    className={cn(
                      "relative flex size-11 items-center justify-center overflow-hidden rounded-md border-2 transition-colors duration-200 ease-[var(--ease-hover)]",
                      color === selected.color ? "border-brand-500" : "border-border-default hover:border-border-strong",
                    )}
                  >
                    {photo ? (
                      <AppImage src={photo} alt="" fill sizes="44px" className="object-cover" />
                    ) : (
                      // Dashboard colours are free text; a CSS colour name paints itself
                      <span
                        aria-hidden="true"
                        className="size-7 rounded-full border border-black/10"
                        style={{ backgroundColor: color.toLowerCase().replace(/\s+/g, "") }}
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {sizes.length > 0 ? (
        <div className="space-y-2">
          <p className="text-small font-medium text-text-primary">Select Size: {selected.size}</p>
          <ul className="flex flex-wrap gap-2">
            {sizes.map((size) => {
              const option = inColor.find((v) => v.size === size && v.stock > 0) ?? inColor.find((v) => v.size === size);
              if (!option) return null;
              const soldOut = option.stock <= 0;
              const active = size === selected.size;
              return (
                <li key={size}>
                  <button
                    type="button"
                    onClick={() => onSelect(option.id)}
                    disabled={soldOut}
                    aria-pressed={active}
                    aria-label={soldOut ? `${size}, sold out` : undefined}
                    className={cn(
                      "relative flex h-10 min-w-10 items-center justify-center overflow-hidden rounded-md border px-2 text-small font-medium transition-colors duration-200 ease-[var(--ease-hover)]",
                      soldOut
                        ? "cursor-not-allowed border-transparent bg-text-tertiary text-text-inverse"
                        : active
                          ? "border-bg-inverse bg-bg-inverse text-text-inverse"
                          : "border-border-default text-text-primary hover:border-border-strong hover:bg-bg-hover",
                    )}
                  >
                    {soldOut ? (
                      <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center">
                        <span className="h-px w-[140%] rotate-[-45deg] bg-text-inverse/80" />
                      </span>
                    ) : null}
                    <span className="relative">{size}</span>
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
