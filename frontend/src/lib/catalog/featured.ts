import { apiFetch } from "@/lib/store-api";
import { type ApiProduct, toCatalogProduct } from "./storefront";
import type { CatalogProduct } from "./types";

// The home page's seller-curated lists, set in the dashboard under Website Management

/**
 * The seller's picks under Website Management → Limited Offer, in their order.
 * A store that picked nothing (or an unreachable API) gets an empty list.
 */
export async function getLimitedOffers(tenantHost: string): Promise<CatalogProduct[]> {
  if (!tenantHost) return [];
  try {
    const data = await apiFetch<{ products: ApiProduct[] }>(tenantHost, "/shop/limited-offers");
    return data.products.map(toCatalogProduct);
  } catch {
    return [];
  }
}

export type FlashSale = { title: string; endsAt: string; products: CatalogProduct[] };

/** The flash sale running now in the store, or null when none is. */
export async function getFlashSale(tenantHost: string): Promise<FlashSale | null> {
  if (!tenantHost) return null;
  try {
    const data = await apiFetch<{ sale: { title: string; endsAt: string } | null; products: ApiProduct[] }>(
      tenantHost,
      "/shop/flash-sale",
    );
    if (!data.sale || !data.products.length) return null;
    return { title: data.sale.title, endsAt: data.sale.endsAt, products: data.products.map(toCatalogProduct) };
  } catch {
    return null;
  }
}
