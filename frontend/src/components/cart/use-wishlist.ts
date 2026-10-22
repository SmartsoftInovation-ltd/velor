"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { ItemSnapshot, WishlistItem } from "@/lib/cart/types";
import { hasItem, removeItem, toggleItem } from "@/lib/cart/wishlist-store";
import { useShopStorage } from "./shop-storage-provider";
import { useHydrated } from "./use-cart";

const EMPTY: WishlistItem[] = [];
const serverSnapshot = () => EMPTY;

export function useWishlist() {
  const { wishlist } = useShopStorage();
  const items = useSyncExternalStore(wishlist.subscribe, wishlist.get, serverSnapshot);
  const ready = useHydrated();

  const has = useCallback((productId: string, variantId: string | null) => hasItem(items, productId, variantId), [items]);
  /** Returns whether the item is saved afterwards */
  const toggle = useCallback(
    (item: ItemSnapshot) => {
      const { items: next, saved } = toggleItem(wishlist.get(), item);
      wishlist.set(next);
      return saved;
    },
    [wishlist],
  );
  const remove = useCallback((key: string) => wishlist.set(removeItem(wishlist.get(), key)), [wishlist]);
  const clear = useCallback(() => wishlist.set([]), [wishlist]);

  return { items, ready, has, toggle, remove, clear };
}
