import { apiFetch, ApiError } from "@/lib/store-api";
import { getStoreProducts, NO_IMAGE, toCatalogProduct, toVariant, type ApiProduct } from "./storefront";
import type { CatalogProduct, ProductDetail, Review } from "./types";

function specs(p: ApiProduct) {
  const rows = [
    { label: "Brand", value: p.brand?.name ?? "" },
    { label: "Category", value: [p.category?.name, p.subcategory?.name].filter(Boolean).join(" / ") },
    { label: "Colours", value: p.colors.join(", ") },
    { label: "Sizes", value: p.sizes.join(", ") },
    { label: "Warranty", value: p.warrantyInformation },
    { label: "Shipping", value: p.shippingInformation },
  ];
  return rows.filter((row) => row.value);
}

function buildDetail(p: ApiProduct): ProductDetail {
  const variants = p.variants.map(toVariant);
  const gallery = (p.gallery.length ? p.gallery : [NO_IMAGE]).map((src, i) => ({
    src,
    alt: i === 0 ? p.name : `${p.name}, photo ${i + 1}`,
  }));

  return {
    ...toCatalogProduct(p),
    sku: p.variants.length === 1 ? p.variants[0].sku || p.sku : p.sku,
    description: p.description,
    // The dashboard's free-text specifications field, one highlight per line
    highlights: p.specifications.split("\n").map((line) => line.trim()).filter(Boolean),
    specs: specs(p),
    gallery,
    stockCount: p.stock,
    // Sizes that every variant carrying them has sold out of
    soldOutSizes: p.sizes.filter((size) => {
      const withSize = p.variants.filter((v) => v.size === size);
      return withSize.length > 0 && withSize.every((v) => v.stock <= 0);
    }),
    maxPrice: p.maxPrice,
    variants,
    sizeCharts: (p.sizeCharts ?? []).map(({ _id, ...chart }) => ({ id: _id, ...chart })),
    sizeChartId: p.sizeChartId ?? null,
    categoryName: p.category?.name ?? "",
  };
}

/** One product of the store at `tenantHost` (GET /shop/products/:slug), or undefined. */
export async function getProduct(tenantHost: string, slug: string): Promise<ProductDetail | undefined> {
  if (!tenantHost) return undefined;
  try {
    const data = await apiFetch<{ product: ApiProduct }>(tenantHost, `/shop/products/${encodeURIComponent(slug)}`);
    return buildDetail(data.product);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return undefined;
    throw error;
  }
}

/** The store has no reviews yet; the tab shows its empty state. */
export async function getReviews(): Promise<Review[]> {
  return [];
}

/** Up to four other products from the same category. */
export async function getRelatedProducts(tenantHost: string, product: ProductDetail): Promise<CatalogProduct[]> {
  const all = await getStoreProducts(tenantHost);
  return all
    .map(toCatalogProduct)
    .filter((item) => item.id !== product.id && item.categoryId === product.categoryId)
    .slice(0, 4);
}
