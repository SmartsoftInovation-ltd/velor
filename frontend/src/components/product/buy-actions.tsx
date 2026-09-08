"use client";

import { Button } from "@/components/ui/button";
import { CartIcon } from "@/components/ui/icons";
import { PhoneIcon, WhatsAppIcon } from "@/components/ui/icons-footer";
import { useToast } from "@/components/ui/toast";

const WHATSAPP_NUMBER = "8801234567890";
const PHONE_NUMBER = "+880123456789";

/**
 * Quantity plus the four ways to order. Cart and checkout submit nothing yet —
 * see `.claude/specs/product-page.md`. The two contact buttons are real links:
 * they hand off to WhatsApp and the dialler, which need no backend.
 */
export function BuyActions({
  qty,
  setQty,
  max,
  soldOut,
  productName,
}: {
  qty: number;
  setQty: (next: number) => void;
  max: number;
  soldOut: boolean;
  productName: string;
}) {
  const toast = useToast();
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
        <Button
          variant="secondary"
          size="lg"
          icon={<CartIcon />}
          disabled={soldOut}
          fullWidth
          onClick={() =>
            toast({
              tone: "success",
              title: "Added to cart",
              description: `${productName} · qty ${qty}`,
            })
          }
        >
          Add to cart
        </Button>
        <Button variant="primary" size="lg" disabled={soldOut} fullWidth>
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
