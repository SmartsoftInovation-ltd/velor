"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CartIcon } from "@/components/ui/icons";
import type { CatalogProduct } from "@/lib/catalog/types";

// Only downloaded once a shopper opens a quick view
const QuickView = dynamic(() => import("./quick-view").then((mod) => mod.QuickView), { ssr: false });

/**
 * The card's Add to cart. It opens the quick view, where the shopper picks the
 * option and quantity before anything reaches the cart.
 */
export function QuickViewButton({ product, className }: { product: CatalogProduct; className?: string }) {
  const [open, setOpen] = useState(false);
  const soldOut = product.stock === "out";
  const label = soldOut ? "Sold out" : "Add to cart";

  return (
    <>
      <Button
        fullWidth
        className={className}
        aria-label={label}
        aria-haspopup="dialog"
        icon={<CartIcon />}
        disabled={soldOut}
        onClick={() => setOpen(true)}
      >
        {label}
      </Button>
      {open ? <QuickView product={product} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
