"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useCart } from "@/components/cart/use-cart";
import { CartIcon } from "@/components/ui/icons";

// Only downloaded once a shopper opens the cart
const CartDrawer = dynamic(() => import("@/components/cart/cart-drawer").then((mod) => mod.CartDrawer), { ssr: false });

// These pages already show the cart; there the button is a plain link
const CART_PAGES = ["/cart", "/checkout"];

/**
 * The header's cart: units and subtotal of this shop's cart, live across tabs.
 * A click opens the cart drawer; it stays a link to /cart, so a new-tab click
 * or a browser without JavaScript still reaches the cart.
 */
export function CartButton() {
  const { totals } = useCart();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const itemCount = totals.count;
  const subtotal = totals.subtotal.toLocaleString();
  const onCartPage = CART_PAGES.some((page) => pathname === page || pathname.startsWith(`${page}/`));

  return (
    <>
      <Link
        href="/cart"
        data-slot="cart"
        aria-haspopup={onCartPage ? undefined : "dialog"}
        aria-label={`Cart, ${itemCount} items, subtotal ৳${subtotal}`}
        onClick={(event) => {
          if (onCartPage || event.metaKey || event.ctrlKey || event.shiftKey) return;
          event.preventDefault();
          setOpen(true);
        }}
        className="group relative z-1 flex h-10 shrink-0 items-center gap-2 rounded-sm pr-3.5 pl-2.5 text-text-primary transition-colors duration-200 ease-[var(--ease-hover)]"
      >
        <span
          className="relative text-text-secondary transition-[color,transform] duration-200 ease-[var(--ease-hover)] group-hover:scale-110 group-hover:text-text-primary [&>svg]:size-5"
          aria-hidden="true"
        >
          <CartIcon />
          <span className="absolute -top-2 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-500 px-1 text-micro font-semibold text-on-brand ring-2 ring-bg-surface">
            {itemCount}
          </span>
        </span>
        <span className="text-small font-semibold tabular">৳{subtotal}</span>
      </Link>
      {open ? <CartDrawer onClose={() => setOpen(false)} /> : null}
    </>
  );
}
