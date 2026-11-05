import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { requestOrigin } from "@/lib/store-api";

/**
 * Per domain, since one build serves every store. Private pages are not blocked
 * here on purpose: they carry noindex, which a crawler can only read if it is
 * allowed to fetch the page.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const origin = requestOrigin(await headers());
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    sitemap: origin ? `${origin}/sitemap.xml` : undefined,
  };
}
