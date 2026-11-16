import { cache } from "react";

/**
 * Talking to the ECOMPOS API as one store.
 *
 * One storefront build serves every seller. The API tells them apart by the
 * domain the shopper typed, so every call carries `x-tenant-host`: the Host
 * the page request arrived on. The shopper cannot choose it. Traefik only
 * routes a request to this app when its Host is a domain added here, and the
 * header is set on this server, never in the browser.
 *
 * Framework-free: callers pass the request headers in (`await headers()` in a
 * Server Component or Server Action), so nothing here imports next/*.
 */

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);

/**
 * The store domain for a request. On localhost there is no real domain, so
 * DEV_TENANT_HOST names the store to preview (e.g. mysmartsoftinnovation.com).
 */
export function storeHostFrom(requestHeaders: Headers): string {
  const host = requestHeaders.get("host")?.toLowerCase().replace(/:\d+$/, "") ?? "";
  if (!host || LOCAL_HOSTS.has(host)) return process.env.DEV_TENANT_HOST?.trim().toLowerCase() ?? "";
  return host;
}

/**
 * The address this request came in on, for links that must be absolute. Unlike
 * storeHostFrom it stays on localhost in development. The proxy says whether the
 * shopper used https; with no proxy in front, a real domain still means https.
 */
export function requestOrigin(requestHeaders: Headers): string | undefined {
  const host = requestHeaders.get("host")?.toLowerCase();
  if (!host) return undefined;
  const local = LOCAL_HOSTS.has(host.replace(/:\d+$/, ""));
  const proto = requestHeaders.get("x-forwarded-proto")?.split(",")[0].trim() || (local ? "http" : "https");
  try {
    return new URL(`${proto}://${host}`).origin;
  } catch {
    return undefined;
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

// The API's base URL including /api/v1. In Docker, use the internal service
// address so the public API can strip `x-tenant-host` from outside callers.
function apiUrl(): string {
  const url = process.env.API_URL;
  if (!url) throw new Error("API_URL is not set");
  return url.replace(/\/+$/, "");
}

/**
 * Calls the API as the store at `tenantHost`. Never cached across requests:
 * Next's fetch cache is keyed by URL alone, so a cached answer would serve one
 * shop's data on another shop's domain.
 */
export async function apiFetch<T>(tenantHost: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${apiUrl()}${path}`, {
    ...init,
    cache: "no-store",
    headers: { ...init.headers, "x-tenant-host": tenantHost },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(body?.message ?? `API ${res.status}`, res.status);
  return body?.data as T;
}

/** `id` is the tenant id: the browser keys its cart and wishlist by it */
export type Store = {
  id: string;
  name: string;
  logo: string;
  primaryColor: string;
  bannerLayout: string;
  cardLayout: string;
  gridColumns: string;
  categoryLayout: string;
  galleryPosition: string;
  thumbnailPosition: string;
  filterLayout: string;
  footerLayout: string;
  buttonStyle: string;
  menuColor: string;
  menuAlign: string;
  announcementEnabled: string;
  announcementText: string;
} & Partial<StoreContact>;

/**
 * What the seller filled in under Settings → Store Information. Optional: a
 * field the API does not send, or the seller left empty, is simply not shown.
 */
export type StoreContact = {
  slogan: string;
  businessType: string;
  address: string;
  phone: string;
  secondaryPhone: string;
  email: string;
  businessHours: string;
  googleMapLink: string;
  facebookLink: string;
  instagramLink: string;
  whatsappLink: string;
  messengerLink: string;
};

/**
 * The store's name, logo and look, or null when the API cannot be reached or the
 * domain belongs to no store. Deduplicated per render: header and footer both ask.
 */
export const getStore = cache(async (tenantHost: string): Promise<Store | null> => {
  if (!tenantHost) return null;
  try {
    return await apiFetch<Store>(tenantHost, "/shop/store");
  } catch {
    return null;
  }
});
