"use client";

import { useRouter } from "next/navigation";
import { AddToCartButton } from "@/components/cart/add-to-cart-button";
import { useCart } from "@/components/cart/use-cart";
import { Button } from "@/components/ui/button";
import { PhoneIcon, WhatsAppIcon } from "@/components/ui/icons-footer";
import type { ItemSnapshot } from "@/lib/cart/types";

const WHATSAPP_NUMBER = "8801234567890";
const PHONE_NUMBER = "+880123456789";

/**
 * Quantity plus the four ways to order. Add to cart saves the picked option
 * in this shop's cart (see `.claude/specs/cart-wishlist.md`); Buy now does
 * the same and goes straight to the cart. The two contact buttons are real
 * links: they hand off to WhatsApp and the dialler, which need no backend.
 */
export function BuyActions({
  qty,
  setQty,
  max,
  soldOut,
  productName,
  item,
}: {
  qty: number;
  setQty: (next: number) => void;
  max: number;
  soldOut: boolean;
  productName: string;
  item: ItemSnapshot;
}) {
  const router = useRouter();
  const { add } = useCart();
  const buyNow = () => {
    const result = add(item, qty);
    if (result !== "full" && result !== "unavailable") router.push("/cart");
  };
  const message = encodeURIComponent(
    `Hi, I'd like to order: ${productName} (qty ${qty})`,
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-small font-medium text-text-secondary">Quantity</span>
        <div className="flex h-11 items-center rounded-md border border-border-default">
          <button
            type="button"
            onClick={() => setQty(Math.max(1, qty - 1))}
            disabled={qty <= 1}
            aria-label="Decrease quantity"
            className="flex size-11 items-center justify-center rounded-l-md text-text-secondary transition-colors duration-150 hover:bg-bg-hover hover:text-text-primary disabled:text-text-disabled disabled:hover:bg-transparent"
          >
            −
          </button>
          <span className="w-10 text-center text-body font-medium tabular">{qty}</span>
          <button
            type="button"
            onClick={() => setQty(Math.min(max, qty + 1))}
            disabled={qty >= max}
            aria-label="Increase quantity"
            className="flex size-11 items-center justify-center rounded-r-md text-text-secondary transition-colors duration-150 hover:bg-bg-hover hover:text-text-primary disabled:text-text-disabled disabled:hover:bg-transparent"
          >
            +
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <AddToCartButton item={item} quantity={qty} variant="secondary" size="lg" fullWidth />
        <Button variant="primary" size="lg" disabled={soldOut || item.needsOption} fullWidth onClick={buyNow}>
          Buy now
        </Button>

        <a
          href={`https://wa.me/${WHATSAPP_NUMBER}?text=${message}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-12 items-center justify-center gap-2 rounded-md bg-success-solid px-5 text-body font-medium text-white shadow-xs transition-[filter] duration-200 ease-[var(--ease-hover)] hover:brightness-95"
        >
          <WhatsAppIcon className="size-5" />
          Order on WhatsApp
        </a>

        <a
          href={`tel:${PHONE_NUMBER}`}
          className="flex h-12 items-center justify-center gap-2 rounded-md bg-info-solid px-5 text-body font-medium text-white shadow-xs transition-[filter] duration-200 ease-[var(--ease-hover)] hover:brightness-95"
        >
          <PhoneIcon className="size-5" />
          Call for order
        </a>
      </div>
    </div>
  );
}
