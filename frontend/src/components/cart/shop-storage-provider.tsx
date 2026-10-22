"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { createPersistedList, type PersistedList } from "@/lib/cart/persisted-list";
import { isCartLine, isWishlistItem, type CartLine, type WishlistItem } from "@/lib/cart/types";

type ShopStorage = {
  tenantId: string;
  cart: PersistedList<CartLine>;
  wishlist: PersistedList<WishlistItem>;
};

const ShopStorageContext = createContext<ShopStorage | null>(null);

/**
 * Opens this shop's cart and wishlist in the browser. `tenantId` comes from
 * the server (GET /shop/store), so the lists are keyed by the store the domain
 * belongs to. `children` stay server-rendered and pass straight through.
 */
export function ShopStorageProvider({ tenantId, children }: { tenantId: string; children: ReactNode }) {
  const value = useMemo(
    () => ({
      tenantId,
      cart: createPersistedList(tenantId, "cart", isCartLine),
      wishlist: createPersistedList(tenantId, "wishlist", isWishlistItem),
    }),
    [tenantId],
  );
  return <ShopStorageContext.Provider value={value}>{children}</ShopStorageContext.Provider>;
}

/** Throws rather than no-oping: a cart button outside the provider is a bug. */
export function useShopStorage() {
  const storage = useContext(ShopStorageContext);
  if (!storage) throw new Error("useShopStorage must be used inside <ShopStorageProvider>");
  return storage;
}
