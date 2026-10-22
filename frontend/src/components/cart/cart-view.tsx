"use client";

import { useEffect, useRef } from "react";
import { useToast } from "@/components/ui/toast";
import { refreshCartAction } from "@/lib/actions/cart";
import { CartLineRow } from "./cart-line-row";
import { EmptyCart } from "./empty-cart";
import { OrderSummary } from "./order-summary";
import { useCart } from "./use-cart";
import { useWishlist } from "./use-wishlist";

/**
 * The cart page's body, read from this shop's cart in the browser. It draws
 * at once from what was saved, then asks the shop for current prices and
 * stock and updates the lines once.
 */
export function CartView() {
  const { lines, totals, ready, update, remove, refresh } = useCart();
  const { has, toggle } = useWishlist();
  const toast = useToast();
  const refreshed = useRef(false);

  useEffect(() => {
    if (!ready || refreshed.current || !lines.length) return;
    refreshed.current = true;
    refreshCartAction(lines.map(({ productId, variantId }) => ({ productId, variantId })))
      .then(refresh)
      .catch(() => {});
  }, [ready, lines, refresh]);

  if (!ready) return <CartSkeleton />;
  if (!lines.length) return <EmptyCart />;

  const saveForLater = (key: string) => {
    const line = lines.find((row) => row.key === key);
    if (!line) return;
    if (!has(line.productId, line.variantId)) toggle(line);
    remove(key);
    toast({ title: "Saved for later", description: `${line.name} moved to your wishlist.` });
  };

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_23rem]">
      <ul className="space-y-3">
        {lines.map((line) => (
          <CartLineRow
            key={line.key}
            line={line}
            onQuantity={(quantity) => update(line.key, quantity)}
            onRemove={() => remove(line.key)}
            onSave={() => saveForLater(line.key)}
          />
        ))}
      </ul>

      {/* Sticky on desktop: the summary is the thing you keep glancing at
          while editing lines further down the list. */}
      <div className="lg:sticky lg:top-32">
        <OrderSummary subtotal={totals.subtotal} saved={totals.saved} count={totals.count} />
      </div>
    </div>
  );
}

function CartSkeleton() {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_23rem]" aria-busy="true">
      <div className="space-y-3">
        {[0, 1].map((row) => (
          <div key={row} className="h-40 animate-pulse rounded-xl bg-bg-sunken" />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-xl bg-bg-sunken" />
    </div>
  );
}
