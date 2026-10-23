"use client";

import { useEffect } from "react";
import { useCart } from "@/components/cart/use-cart";

/** Empties the bag once the shop has confirmed the order it became. Renders nothing. */
export function ClearBag() {
  const { ready, lines, clear } = useCart();

  useEffect(() => {
    if (ready && lines.length) clear();
  }, [ready, lines.length, clear]);

  return null;
}
