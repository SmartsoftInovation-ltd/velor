"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { addLine, cartTotals, refreshLines, removeLine, setQuantity, type FreshItem } from "@/lib/cart/cart-store";
import type { CartLine, ItemSnapshot } from "@/lib/cart/types";
import { useShopStorage } from "./shop-storage-provider";

// The server has no browser storage: it renders an empty cart, and the
// browser fills it in after hydration
const EMPTY: CartLine[] = [];
const serverSnapshot = () => EMPTY;
const noSubscribe = () => () => {};

/** False during server render and hydration, true once browser storage can be read */
export const useHydrated = () =>
  useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );

export function useCart() {
  const { cart } = useShopStorage();
  const lines = useSyncExternalStore(cart.subscribe, cart.get, serverSnapshot);
  const ready = useHydrated();
  const totals = useMemo(() => cartTotals(lines), [lines]);

  const add = useCallback(
    (item: ItemSnapshot, quantity = 1) => {
      const { lines: next, result } = addLine(cart.get(), item, quantity);
      if (next !== cart.get()) cart.set(next);
      return result;
    },
    [cart],
  );
  const update = useCallback((key: string, quantity: number) => cart.set(setQuantity(cart.get(), key, quantity)), [cart]);
  const remove = useCallback((key: string) => cart.set(removeLine(cart.get(), key)), [cart]);
  const clear = useCallback(() => cart.set([]), [cart]);
  const refresh = useCallback((fresh: Record<string, FreshItem | null>) => cart.set(refreshLines(cart.get(), fresh)), [cart]);

  return { lines, totals, ready, add, update, remove, clear, refresh };
}
