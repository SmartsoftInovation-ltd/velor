"use client";

import Link from "next/link";
import { Drawer } from "@/components/ui/drawer";
import { CartIcon, CloseIcon } from "@/components/ui/icons";
import { CartDrawerLine } from "./cart-drawer-line";
import { useCart } from "./use-cart";

const ACTION =
  "flex h-12 items-center justify-center rounded-md px-5 text-body font-medium transition-[background-color,transform] duration-200 ease-[var(--ease-hover)] active:scale-[0.98]";

/** The cart as a side panel, opened from the header: edit lines, then check out */
export function CartDrawer({ onClose }: { onClose: () => void }) {
  const { lines, totals, update, remove } = useCart();

  return (
    <Drawer label="Your cart" onClose={onClose}>
      <header className="flex items-center justify-between gap-3 border-b border-border-subtle px-5 py-4">
        <h2 className="flex items-center gap-2 text-h3 font-semibold text-text-primary">
          Your Cart
          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-caption font-semibold text-text-brand tabular">
            {totals.count}
          </span>
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close cart"
          className="flex size-9 items-center justify-center rounded-full bg-bg-sunken text-text-secondary transition-colors duration-150 hover:bg-bg-hover hover:text-text-primary"
        >
          <CloseIcon className="size-4" />
        </button>
      </header>

      {lines.length ? (
        <>
          <ul className="flex-1 divide-y divide-border-subtle overflow-y-auto overscroll-contain px-5">
            {lines.map((line) => (
              <CartDrawerLine
                key={line.key}
                line={line}
                onQuantity={(quantity) => update(line.key, quantity)}
                onRemove={() => remove(line.key)}
                onNavigate={onClose}
              />
            ))}
          </ul>

          <footer className="space-y-3 border-t border-border-subtle bg-bg-surface px-5 pt-4 pb-5 shadow-lg">
            {totals.saved > 0 ? (
              <p className="flex justify-between text-small text-text-secondary">
                You save
                <span className="font-medium text-success-text tabular">−৳{totals.saved.toLocaleString()}</span>
              </p>
            ) : null}
            <p className="flex items-baseline justify-between text-body font-semibold text-text-primary">
              Cart Total
              <span className="text-h3 tabular">৳{totals.subtotal.toLocaleString()}</span>
            </p>
            <p className="text-caption text-text-tertiary">Delivery charge and coupons are applied at checkout.</p>
            <Link href="/checkout" onClick={onClose} className={`${ACTION} bg-brand-500 text-on-brand shadow-brand hover:bg-brand-600`}>
              Proceed to Checkout
            </Link>
            <Link href="/cart" onClick={onClose} className={`${ACTION} border border-border-default text-text-primary hover:bg-bg-hover`}>
              View Cart Page
            </Link>
          </footer>
        </>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center px-5 text-center">
          <span aria-hidden="true" className="mb-4 flex size-16 items-center justify-center rounded-full bg-brand-100 text-text-brand">
            <CartIcon className="size-7" />
          </span>
          <p className="text-body font-semibold text-text-primary">Your cart is empty</p>
          <p className="mt-1 text-small text-text-secondary">Add a product and it shows up here.</p>
          <Link href="/shop" onClick={onClose} className={`${ACTION} mt-5 bg-brand-500 text-on-brand hover:bg-brand-600`}>
            Browse the shop
          </Link>
        </div>
      )}
    </Drawer>
  );
}
