import { headers } from "next/headers";
import { getProduct } from "@/lib/catalog/product-detail";
import { toQuickView } from "@/lib/catalog/quick-view";
import { storeHostFrom } from "@/lib/store-api";

/**
 * GET /api/quick-view/:slug: the options, stock and SKU a product card's quick
 * view shows. Asked for when the modal opens, so a grid of cards does not carry
 * every product's variants. The answer depends on the Host, so nothing may cache it.
 */
export async function GET(_request: Request, { params }: RouteContext<"/api/quick-view/[slug]">) {
  const { slug } = await params;
  const product = await getProduct(storeHostFrom(await headers()), slug);
  if (!product) return Response.json({ message: "Product not found" }, { status: 404 });

  return Response.json(toQuickView(product), { headers: { "Cache-Control": "no-store" } });
}
