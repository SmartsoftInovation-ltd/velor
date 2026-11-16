"use client";

import Link from "next/link";
import { useState } from "react";
import { AddToCartButton } from "@/components/cart/add-to-cart-button";
import { Button } from "@/components/ui/button";
import { CheckCircleIcon } from "@/components/ui/icons-filter";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import type { ItemSnapshot } from "@/lib/cart/types";
import type { ProductVariant } from "@/lib/catalog/types";
import { QuickViewOptions } from "./quick-view-options";

const PILL = "h-12 flex-1 rounded-full! px-6! text-body font-semibold! shadow-md! hover:opacity-90";

/**
 * The quick view's options, stock line, quantity and its two buttons. Add to
 * cart puts the picked option in the cart and closes the modal; Buy Now opens
 * the product page on that option. Keyed by the option, so a new pick starts
 * again from a quantity of one.
 */
export function QuickViewPurchase({
  loading,
  failed,
  variants,
  variant,
  available,
  item,
  detailsHref,
  onPick,
  onClose,
}: {
  loading: boolean;
  failed: boolean;
  variants: ProductVariant[];
  variant?: ProductVariant;
  available: number;
  item: ItemSnapshot;
  detailsHref: string;
  onPick: (variantId: string) => void;
  onClose: () => void;
}) {
  const [qty, setQty] = useState(1);
  // Until the options have loaded, a product that needs one cannot be added
  const waiting = loading || item.needsOption;

  return (
    <div className="space-y-5">
      {loading ? (
        <div className="space-y-3" aria-hidden="true">
          <div className="h-4 w-28 animate-pulse rounded-sm bg-bg-sunken" />
          <div className="flex gap-2">
            <div className="size-12 animate-pulse rounded-md bg-bg-sunken" />
            <div className="size-12 animate-pulse rounded-md bg-bg-sunken" />
            <div className="size-12 animate-pulse rounded-md bg-bg-sunken" />
          </div>
        </div>
      ) : null}
      {failed ? (
        <p className="text-small text-text-secondary" role="status">
          The options could not be loaded. Open the product page to choose one.
        </p>
      ) : null}
      {variant ? <QuickViewOptions variants={variants} selected={variant} onSelect={onPick} /> : null}

      {available > 0 ? (
        <p className="flex items-center gap-2 text-body font-medium text-success-text">
          <CheckCircleIcon className="size-5" />
          In Stock : {available}
        </p>
      ) : (
        <p className="text-body font-medium text-danger-text">Out of stock</p>
      )}

      <QuantityStepper value={qty} max={Math.max(1, Math.min(available, 10))} onChange={setQty} />

      <div className="flex flex-wrap gap-3 pt-1">
        {waiting ? (
          <Button size="lg" disabled className={`${PILL} bg-bg-inverse! text-text-inverse!`}>
            Add to cart
          </Button>
        ) : (
          <AddToCartButton
            item={item}
            quantity={qty}
            size="lg"
            className={`${PILL} bg-bg-inverse! text-text-inverse!`}
            onDone={onClose}
          />
        )}
        <Link
          href={detailsHref}
          onClick={onClose}
          className={`${PILL} inline-flex items-center justify-center bg-[var(--buy-now)] text-white transition-opacity duration-200`}
        >
          Buy Now
        </Link>
      </div>
    </div>
  );
}
