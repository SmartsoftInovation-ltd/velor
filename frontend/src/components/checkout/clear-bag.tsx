"use client";

import { useEffect } from "react";
import { useShopStorage } from "@/components/cart/shop-storage-provider";
import { useCart } from "@/components/cart/use-cart";

/**
 * Empties the bag and drops the checkout draft once the shop has confirmed the
 * order they became. Renders nothing.
 */
export function ClearBag() {
  const { ready, lines, clear } = useCart();
  const { checkoutDraft } = useShopStorage();

  useEffect(() => {
    if (ready && lines.length) clear();
  }, [ready, lines.length, clear]);

  useEffect(() => {
    if (checkoutDraft.get().length) checkoutDraft.set([]);
  }, [checkoutDraft]);

  return null;
}
