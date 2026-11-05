import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { buildSitemap } from "@/lib/catalog/sitemap";
import { getStoreProducts } from "@/lib/catalog/storefront";
import { requestOrigin, storeHostFrom } from "@/lib/store-api";

// Reading the request keeps this per domain: each store lists only its own products.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const requestHeaders = await headers();
  const origin = requestOrigin(requestHeaders);
  if (!origin) return [];
  return buildSitemap(origin, await getStoreProducts(storeHostFrom(requestHeaders)));
}
