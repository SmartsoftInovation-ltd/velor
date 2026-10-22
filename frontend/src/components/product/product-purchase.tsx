"use client";

import { useState } from "react";
import { StatusDot } from "@/components/ui/badge";
import { forVariant } from "@/lib/cart/snapshot";
import type { ItemSnapshot } from "@/lib/cart/types";
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
  compareAtPrice,
  stockCount,
  variants,
  colors,
  sizes,
  soldOutSizes,
  productName,
  item,
  initialVariantId,
}: {
  price: number;
  compareAtPrice?: number;
  stockCount: number;
  variants: ProductVariant[];
  colors: string[];
  sizes: string[];
  soldOutSizes: string[];
  productName: string;
  /** The product as the cart stores it; narrowed to the picked variant below */
  item: ItemSnapshot;
  /** From ?variant= on the URL; otherwise the first option that can be bought */
  initialVariantId?: string;
}) {
  const [variantId, setVariantId] = useState(
    () =>
      variants.find((v) => v.id === initialVariantId)?.id ??
      (variants.find((v) => v.stock > 0) ?? variants[0])?.id ??
      "",
  );
  const [qty, setQty] = useState(1);

  const variant = variants.find((v) => v.id === variantId);
  const shownPrice = variant ? variant.price : price;
  // Struck through while a flash sale has this option on sale
  const wasPrice = variant ? variant.compareAtPrice : compareAtPrice;
  const available = variant ? variant.stock : stockCount;
  const cartItem = variant ? forVariant(item, variant) : item;

  const pickVariant = (id: string) => {
    setVariantId(id);
    setQty(1);
  };

  return (
    <div className="space-y-6">
      <p className="flex items-baseline gap-3" aria-live="polite">
        <span className="text-h2 font-semibold tabular text-text-primary">৳{shownPrice.toLocaleString()}</span>
        {wasPrice && wasPrice > shownPrice ? (
          <span className="text-h3 font-medium tabular text-text-tertiary line-through">
            ৳{wasPrice.toLocaleString()}
          </span>
        ) : null}
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
          item={cartItem}
        />
      </div>
    </div>
  );
}
