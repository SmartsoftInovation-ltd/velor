import { apiFetch } from "@/lib/store-api";

export type ShopCategory = {
  id: string;
  name: string;
  href: string;
  image: string;
  alt: string;
};

// The fields the storefront reads from GET /categories-active
type ApiCategory = {
  _id: string;
  name: string;
  slug: string;
  image?: { url?: string };
};

// Shown until the seller uploads a category photo
const NO_IMAGE = "/image-fallback.svg";

const toShopCategory = (category: ApiCategory): ShopCategory => ({
  id: category._id,
  name: category.name,
  href: `/shop?category=${encodeURIComponent(category.slug)}`,
  image: category.image?.url || NO_IMAGE,
  alt: category.name,
});

/**
 * The store's active categories, newest first. An unreachable API yields an
 * empty list so the home page still renders without the section.
 */
export async function getShopCategories(tenantHost: string): Promise<ShopCategory[]> {
  if (!tenantHost) return [];
  try {
    const data = await apiFetch<{ categories: ApiCategory[] }>(tenantHost, "/categories-active");
    return data.categories.map(toShopCategory);
  } catch {
    return [];
  }
}
