import { itemKey, WISHLIST_MAX_ITEMS, type ItemSnapshot, type WishlistItem } from "./types";

/** The wishlist's rules as pure functions; newest saved first. */

export const hasItem = (items: WishlistItem[], productId: string, variantId: string | null) =>
  items.some((item) => item.key === itemKey(productId, variantId));

export function toggleItem(items: WishlistItem[], item: ItemSnapshot, now = new Date()) {
  const key = itemKey(item.productId, item.variantId);
  if (items.some((row) => row.key === key)) {
    return { items: items.filter((row) => row.key !== key), saved: false };
  }
  // A full list drops the oldest save rather than refusing the new one
  const next = [{ ...item, key, savedAt: now.toISOString() }, ...items].slice(0, WISHLIST_MAX_ITEMS);
  return { items: next, saved: true };
}

export const removeItem = (items: WishlistItem[], key: string) => items.filter((item) => item.key !== key);
