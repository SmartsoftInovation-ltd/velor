"use client";

import { useState } from "react";
import { StatusDot } from "@/components/ui/badge";
import type { ProductVariant } from "@/lib/catalog/types";
import { BuyActions } from "./buy-actions";
import { ProductOptions } from "./product-options";
import { VariantPicker } from "./variant-picker";

/**
 * Price, availability and the buy controls, which all follow the selected
 * option: picking a variant changes the one price shown, the stock line and
 * the most that can be added. A product without variants uses its own price
 * and stock.
 */
export function ProductPurchase({
  price,
  stockCount,
  variants,
  colors,
  sizes,
  soldOutSizes,
  productName,
}: {
  price: number;
  stockCount: number;
  variants: ProductVariant[];
  colors: string[];
  sizes: string[];
  soldOutSizes: string[];
  productName: string;
}) {
  // Start on the first option that can be bought
  const [variantId, setVariantId] = useState(
    () => (variants.find((v) => v.stock > 0) ?? variants[0])?.id ?? "",
  );
  const [qty, setQty] = useState(1);

  const variant = variants.find((v) => v.id === variantId);
  const shownPrice = variant ? variant.price : price;
  const available = variant ? variant.stock : stockCount;

  const pickVariant = (id: string) => {
    setVariantId(id);
    setQty(1);
  };

  return (
    <div className="space-y-6">
      <p className="text-h2 font-semibold tabular text-text-primary" aria-live="polite">
        ৳{shownPrice.toLocaleString()}
      </p>

      <p className="flex items-center gap-2 text-small text-text-secondary">
        Availability:
        {available > 0 ? (
          <StatusDot tone={available <= 5 ? "warning" : "success"}>
            In stock · {available} left
          </StatusDot>
        ) : (
          <StatusDot tone="danger">Out of stock</StatusDot>
        )}
      </p>

      <div className="space-y-5">
        {variants.length > 1 ? (
          <VariantPicker variants={variants} selectedId={variantId} onSelect={pickVariant} />
        ) : (
          // Colour and size pickers only for a product without variants that has them
          <ProductOptions colors={colors} sizes={sizes} soldOutSizes={soldOutSizes} />
        )}

        <BuyActions
          qty={qty}
          setQty={setQty}
          max={Math.max(1, Math.min(available, 10))}
          soldOut={available <= 0}
          productName={productName}
        />
      </div>
    </div>
  );
}
