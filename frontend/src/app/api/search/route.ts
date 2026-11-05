import { headers } from "next/headers";
import { searchCatalog } from "@/lib/catalog/product-search";
import { getStoreProducts, toCatalogProduct } from "@/lib/catalog/storefront";
import { storeHostFrom } from "@/lib/store-api";

/**
 * GET /api/search?q=: the header search box's suggestions. A route handler, not
 * a Server Action: the client dispatches actions one at a time and cannot cancel
 * them, and a search box has to drop the request a newer keystroke replaced.
 * The answer depends on the Host, so nothing may cache it.
 */
export async function GET(request: Request) {
  const term = new URL(request.url).searchParams.get("q") ?? "";
  const products = await getStoreProducts(storeHostFrom(await headers()));
  const result = searchCatalog(products.map(toCatalogProduct), term);

  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
