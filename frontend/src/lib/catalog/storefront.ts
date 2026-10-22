import { cache } from "react";
import { apiFetch } from "@/lib/store-api";
import type { Stock } from "@/lib/product";
import type { CatalogProduct, Category, ColorOption, ProductVariant, Taxonomy } from "./types";

/**
 * The store's catalogue from the API (GET /shop/products), turned into the
 * shapes the shop components already use. Prices and stock are the API's:
 * `price` is the retail price checkout charges, `stock` the units sellable now.
 */

type ApiRef = { name: string; slug: string } | null;

export type ApiVariant = {
  _id: string;
  slug: string;
  name: string;
  sku: string;
  size: string;
  color: string;
  price: number;
  stock: number;
  image: string;
};

export type ApiProduct = {
  _id: string;
  slug: string;
  name: string;
  description: string;
  brand: ApiRef;
  category: ApiRef;
  subcategory: ApiRef;
  image: string;
  gallery: string[];
  price: number;
  maxPrice: number;
  stock: number;
  sizes: string[];
  colors: string[];
  variants: ApiVariant[];
  sku: string;
  rating: number;
  sold: number;
  specifications: string;
  warrantyInformation: string;
  shippingInformation: string;
  createdAt: string;
};

// Shown until the seller uploads a product photo
export const NO_IMAGE = "/image-fallback.svg";
const LOW_STOCK = 5;

const stockState = (count: number): Stock => (count <= 0 ? "out" : count <= LOW_STOCK ? "low" : "in");

// Colour filters and chips key on a lowercase id; the name is what was typed in the dashboard
export const colorId = (name: string) => name.trim().toLowerCase();

export function toCatalogProduct(p: ApiProduct): CatalogProduct {
  return {
    id: p.slug,
    name: p.name,
    brand: p.brand?.name ?? "",
    price: p.price,
    rating: p.rating,
    reviews: "",
    stock: stockState(p.stock),
    stockCount: p.stock,
    href: `/product/${p.slug}`,
    image: p.image || NO_IMAGE,
    alt: p.name,
    categoryId: p.category?.slug ?? "",
    subcategoryId: p.subcategory?.slug ?? "",
    colors: p.colors.map(colorId),
    sizes: p.sizes,
    createdAt: p.createdAt,
    sold: p.sold,
  };
}

export function toVariant(v: ApiVariant): ProductVariant {
  return {
    id: v._id,
    // Size and colour name a variant best; a variant without them goes by its name
    label: [v.color, v.size].filter(Boolean).join(" / ") || v.name,
    price: v.price,
    stock: v.stock,
  };
}

const toColor = (name: string): ColorOption => ({
  id: colorId(name),
  name,
  // Dashboard colours are free text; a CSS colour name ("Navy") paints itself
  swatch: colorId(name).replace(/\s+/g, ""),
});

/** The filters' options, built from what the store actually sells. */
export function buildTaxonomy(products: ApiProduct[]): Taxonomy {
  const categories = new Map<string, Category>();
  const colors = new Map<string, ColorOption>();
  const brands = new Set<string>();
  const sizes = new Set<string>();

  for (const p of products) {
    if (p.category) {
      const category = categories.get(p.category.slug) ?? { id: p.category.slug, name: p.category.name, subcategories: [] };
      if (p.subcategory && !category.subcategories.some((s) => s.id === p.subcategory?.slug)) {
        category.subcategories.push({ id: p.subcategory.slug, name: p.subcategory.name });
      }
      categories.set(category.id, category);
    }
    if (p.brand) brands.add(p.brand.name);
    p.sizes.forEach((size) => sizes.add(size));
    p.colors.forEach((name) => colors.set(colorId(name), toColor(name)));
  }

  return {
    categories: [...categories.values()],
    brands: [...brands],
    colors: [...colors.values()],
    sizes: [...sizes],
  };
}

/** The newest products (the API lists newest first). */
export const newestProducts = (products: ApiProduct[], count: number) =>
  products.slice(0, count).map(toCatalogProduct);

/** The most sold products; a store with no sales yet gets none, not a random pick. */
export const bestSellingProducts = (products: ApiProduct[], count: number) =>
  products
    .filter((p) => p.sold > 0)
    .sort((a, b) => b.sold - a.sold)
    .slice(0, count)
    .map(toCatalogProduct);

/** Every active product of the store at `tenantHost`, newest first. One call per render. */
export const getStoreProducts = cache(async (tenantHost: string): Promise<ApiProduct[]> => {
  if (!tenantHost) return [];
  try {
    const data = await apiFetch<{ products: ApiProduct[] }>(tenantHost, "/shop/products");
    return data.products;
  } catch {
    return [];
  }
});
