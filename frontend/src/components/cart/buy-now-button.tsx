"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, buttonClassName } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { ItemSnapshot } from "@/lib/cart/types";
import { useCart } from "./use-cart";

/**
 * Adds one to the cart and goes there, as Buy now does on the product page.
 * The card passes a variant for a product that has several (see buyNowSnapshot).
 * An item that still needs an option, because every variant is sold out, opens
 * the product page instead, and with no stock it stays disabled.
 */
export function BuyNowButton({ item, className }: { item: ItemSnapshot; className?: string }) {
  const router = useRouter();
  const { add } = useCart();

  if (item.needsOption) {
    return (
      <Link href={item.href} className={cn(buttonClassName("primary", "md"), className)}>
        <span className="relative z-2">Buy Now</span>
      </Link>
    );
  }

  const buyNow = () => {
    const result = add(item, 1);
    if (result !== "full" && result !== "unavailable") router.push("/cart");
  };

  return (
    <Button className={className} disabled={item.maxQuantity < 1} onClick={buyNow}>
      Buy Now
    </Button>
  );
}
