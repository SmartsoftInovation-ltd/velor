import { CATALOG_A } from "./products-a";
import { CATALOG_B } from "./products-b";
import type {
  Availability,
  CatalogProduct,
  ShopQuery,
  ShopResult,
  SortOption,
} from "./types";

const ALL: CatalogProduct[] = [...CATALOG_A, ...CATALOG_B];

export const PAGE_SIZE = 9;

const AVAILABILITY_STATES: Availability[] = ["in-stock", "out-of-stock", "offer"];

const SORTERS: Record<SortOption, (a: CatalogProduct, b: CatalogProduct) => number> = {
  relevance: (a, b) => b.rating - a.rating,
  "price-asc": (a, b) => a.price - b.price,
  "price-desc": (a, b) => b.price - a.price,
  rating: (a, b) => b.rating - a.rating,
  newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
};

function matches(product: CatalogProduct, query: ShopQuery) {
  if (query.category && product.categoryId !== query.category) return false;
  if (query.subcategory && product.subcategoryId !== query.subcategory) return false;
  if (query.brands?.length && !query.brands.includes(product.brand)) return false;
  if (query.minPrice !== undefined && product.price < query.minPrice) return false;
  if (query.maxPrice !== undefined && product.price > query.maxPrice) return false;
  if (query.minRating !== undefined && product.rating < query.minRating) return false;
  if (
    query.colors?.length &&
    !product.colors.some((color) => query.colors?.includes(color))
  ) {
    return false;
  }
  if (query.sizes?.length && !product.sizes.some((size) => query.sizes?.includes(size))) {
    return false;
  }
  if (query.availability?.length && !hasAvailability(product, query.availability)) {
    return false;
  }
  return true;
}

function hasAvailability(product: CatalogProduct, wanted: Availability[]) {
  return wanted.some((state) => {
    if (state === "in-stock") return product.stock !== "out";
    if (state === "out-of-stock") return product.stock === "out";
    return (
      product.compareAtPrice !== undefined && product.compareAtPrice > product.price
    );
  });
}

/**
 * Shaped like the eventual `GET /api/products` call — see
 * `.claude/specs/shop-page.md`. Swapping the body for a fetch is the whole
 * migration; nothing above it needs to change.
 */
export async function searchProducts(query: ShopQuery = {}): Promise<ShopResult> {
  const filtered = ALL.filter((product) => matches(product, query));
  const sorted = [...filtered].sort(SORTERS[query.sort ?? "relevance"]);

  const page = Math.max(1, query.page ?? 1);
  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const start = (page - 1) * PAGE_SIZE;

  return {
    products: sorted.slice(start, start + PAGE_SIZE),
    total: sorted.length,
    page,
    pageCount,
  };
}

export type FacetCounts = {
  categories: Record<string, number>;
  brands: Record<string, number>;
  availability: Record<Availability, number>;
};

/** Per-facet counts for the current filter set, so the sidebar can show them. */
export async function getFacetCounts(query: ShopQuery = {}): Promise<FacetCounts> {
  const categories: Record<string, number> = {};
  const brands: Record<string, number> = {};
  const availability: Record<Availability, number> = {
    "in-stock": 0,
    "out-of-stock": 0,
    offer: 0,
  };

  for (const product of ALL) {
    // Each facet counts against every filter except its own, so a count never
    // drops to zero just because that facet is the one being filtered on.
    if (matches(product, { ...query, category: undefined, subcategory: undefined })) {
      // "all" is the count with the category facet lifted — what the sidebar's
      // All products row would return if it were clicked.
      categories.all = (categories.all ?? 0) + 1;
      categories[product.categoryId] = (categories[product.categoryId] ?? 0) + 1;
      const key = `${product.categoryId}/${product.subcategoryId}`;
      categories[key] = (categories[key] ?? 0) + 1;
    }
    if (matches(product, { ...query, brands: undefined })) {
      brands[product.brand] = (brands[product.brand] ?? 0) + 1;
    }
    if (matches(product, { ...query, availability: undefined })) {
      for (const state of AVAILABILITY_STATES) {
        if (hasAvailability(product, [state])) availability[state] += 1;
      }
    }
  }

  return { categories, brands, availability };
}
