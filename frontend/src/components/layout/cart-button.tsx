"use client";

import Link from "next/link";
import { useCart } from "@/components/cart/use-cart";
import { CartIcon } from "@/components/ui/icons";

/** The header's cart: units and subtotal of this shop's cart, live across tabs */
export function CartButton() {
  const { totals } = useCart();
  const itemCount = totals.count;
  const subtotal = totals.subtotal.toLocaleString();

  return (
    <Link
      href="/cart"
      data-slot="cart"
      aria-label={`Cart, ${itemCount} items, subtotal ৳${subtotal}`}
      className="group relative z-1 flex h-10 shrink-0 items-center gap-2 rounded-sm pr-3.5 pl-2.5 text-text-primary transition-colors duration-200 ease-[var(--ease-hover)]"
    >
      <span
        className="relative text-text-secondary transition-[color,transform] duration-200 ease-[var(--ease-hover)] group-hover:scale-110 group-hover:text-text-primary [&>svg]:size-5"
        aria-hidden="true"
      >
        <CartIcon />
        <span className="absolute -top-2 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-500 px-1 text-micro font-semibold text-white ring-2 ring-bg-surface">
          {itemCount}
        </span>
      </span>
      <span className="text-small font-semibold tabular">৳{subtotal}</span>
    </Link>
  );
}
