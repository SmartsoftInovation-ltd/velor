import { CATALOG_A } from "./products-a";
import { CATALOG_B } from "./products-b";
import type { CatalogProduct } from "./types";

export type WishlistItem = {
  id: string;
  product: CatalogProduct;
  /** ISO 8601 — when the shopper saved it. */
  savedAt: string;
};

const ALL = [...CATALOG_A, ...CATALOG_B];

const DRAFT = [
  { id: "wish-1", productId: "leather-biker-jacket", savedAt: "2026-09-04T14:20:00+06:00" },
  { id: "wish-2", productId: "denim-jeans", savedAt: "2026-09-03T09:10:00+06:00" },
  { id: "wish-3", productId: "essential-tee", savedAt: "2026-08-30T18:45:00+06:00" },
  { id: "wish-4", productId: "leather-brogues", savedAt: "2026-08-28T11:05:00+06:00" },
  { id: "wish-5", productId: "shearling-jacket", savedAt: "2026-08-24T16:30:00+06:00" },
  { id: "wish-6", productId: "crossbody-bag", savedAt: "2026-08-21T08:15:00+06:00" },
  { id: "wish-7", productId: "checked-blazer", savedAt: "2026-08-18T13:40:00+06:00" },
  { id: "wish-8", productId: "knit-sweater-bundle", savedAt: "2026-08-15T10:25:00+06:00" },
];

/**
 * A hard-coded saved list so the wishlist page has something to lay out. There
 * is no wishlist state anywhere — this is a design fixture, not a store. Items
 * whose id no longer resolves are dropped rather than asserted away.
 */
export const WISHLIST_ITEMS: WishlistItem[] = DRAFT.flatMap((item) => {
  const product = ALL.find((row) => row.id === item.productId);
  return product ? [{ ...item, product }] : [];
});
