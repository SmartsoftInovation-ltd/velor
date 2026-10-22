"use client";

import { useCart } from "@/components/cart/use-cart";
import { useWishlist } from "@/components/cart/use-wishlist";
import { useToast } from "@/components/ui/toast";
import type { WishlistItem } from "@/lib/cart/types";
import { EmptyWishlist } from "./empty-wishlist";
import { WishlistCard } from "./wishlist-card";
import { WishlistToolbar } from "./wishlist-toolbar";

/** The wishlist page's body, read from this shop's wishlist in the browser. */
export function WishlistView() {
  const { items, ready, remove, clear } = useWishlist();
  const { add } = useCart();
  const toast = useToast();

  if (!ready) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-3 lg:gap-6 xl:grid-cols-4" aria-busy="true">
        {[0, 1, 2, 3].map((cell) => (
          <div key={cell} className="aspect-3/4 animate-pulse rounded-lg bg-bg-sunken" />
        ))}
      </div>
    );
  }
  if (!items.length) return <EmptyWishlist />;

  // Moved items leave the wishlist; ones that need an option or are sold out stay
  const moveToCart = (item: WishlistItem) => {
    const result = add(item, 1);
    if (result === "full" || result === "unavailable") return false;
    remove(item.key);
    return true;
  };

  const moveOne = (item: WishlistItem) => {
    if (moveToCart(item)) toast({ tone: "success", title: "Moved to bag", description: item.name });
    else toast({ tone: "danger", title: "Couldn't add to bag", description: `${item.name} is sold out or your cart is full.` });
  };

  const moveAll = () => {
    const moved = items.filter((item) => !item.needsOption && moveToCart(item)).length;
    const left = items.length - moved;
    toast({
      tone: moved ? "success" : "default",
      title: moved ? `Moved ${moved} ${moved === 1 ? "item" : "items"} to bag` : "Nothing moved",
      description: left ? `${left} still need an option picked or are sold out.` : undefined,
    });
  };

  return (
    <>
      <WishlistToolbar count={items.length} onClear={clear} onMoveAll={moveAll} />

      <ul className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-3 lg:gap-6 xl:grid-cols-4">
        {items.map((item) => (
          <li key={item.key}>
            <WishlistCard item={item} onMove={() => moveOne(item)} onRemove={() => remove(item.key)} />
          </li>
        ))}
      </ul>
    </>
  );
}
