"use client";

import { useState } from "react";
import { CheckCircleIcon } from "@/components/ui/icons-filter";
import { forVariant } from "@/lib/cart/snapshot";
import type { ItemSnapshot } from "@/lib/cart/types";
import type { ProductVariant, SizeChart } from "@/lib/catalog/types";
import { BuyActions } from "./buy-actions";
import { ProductOptions } from "./product-options";
import { QuickViewOptions } from "./quick-view-options";
import { SizeChartButton } from "./size-chart-button";

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
  sizeChart,
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
  sizeChart: SizeChart | null;
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
    <div className="space-y-4">
      <p className="flex items-baseline gap-3" aria-live="polite">
        <span className="text-h1 font-bold tabular text-success-text">৳ {shownPrice.toLocaleString()}</span>
        {wasPrice && wasPrice > shownPrice ? (
          <span className="text-h3 font-medium tabular text-text-tertiary line-through">
            ৳{wasPrice.toLocaleString()}
          </span>
        ) : null}
      </p>

      {/* The pickers on the left, Size Chart beside them on a wide screen */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
        <div className="min-w-0 flex-1">
          {variants.length > 1 && variant ? (
            // Colour first, then the sizes that colour comes in, as in the quick view
            <QuickViewOptions variants={variants} selected={variant} onSelect={pickVariant} />
          ) : (
            // Colour and size pickers only for a product without variants that has them
            <ProductOptions colors={colors} sizes={sizes} soldOutSizes={soldOutSizes} />
          )}
        </div>
        {sizeChart ? (
          <div className="self-start sm:self-center">
            <SizeChartButton chart={sizeChart} />
          </div>
        ) : null}
      </div>

      {available > 0 ? (
        <p className="flex items-center gap-1.5 text-small font-medium text-success-text" aria-live="polite">
          <CheckCircleIcon className="size-4" />
          In Stock : {available}
        </p>
      ) : (
        <p className="text-small font-medium text-danger-text" aria-live="polite">
          Out of stock
        </p>
      )}

      <div className="pt-1">
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
