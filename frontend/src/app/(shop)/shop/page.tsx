import type { Metadata } from "next";
import { headers } from "next/headers";
import { ActiveFilters } from "@/components/shop/active-filters";
import { Breadcrumb, type Crumb } from "@/components/shop/breadcrumb";
import { FilterSidebar } from "@/components/shop/filter-sidebar";
import { MobileFilters } from "@/components/shop/mobile-filters";
import { Pagination } from "@/components/shop/pagination";
import { ProductGrid } from "@/components/shop/product-grid";
import { SortSelect } from "@/components/shop/sort-select";
import { ViewToggle } from "@/components/shop/view-toggle";
import { parseShopQuery } from "@/lib/catalog/query-params";
import { getFacetCounts, PAGE_SIZE, searchProducts } from "@/lib/catalog/shop";
import { buildTaxonomy, getStoreProducts, toCatalogProduct } from "@/lib/catalog/storefront";
import type { Category, ShopQuery } from "@/lib/catalog/types";
import { storeHostFrom } from "@/lib/store-api";

export const metadata: Metadata = {
  title: "Shop",
  description: "Every product in the shop, filtered how you like it.",
};

function crumbs(query: ShopQuery, categories: Category[]): Crumb[] {
  const trail: Crumb[] = [{ label: "Home", href: "/" }, { label: "Shop", href: "/shop" }];
  const category = categories.find((item) => item.id === query.category);
  if (!category) return trail;

  trail.push({ label: category.name, href: `/shop?category=${category.id}` });
  const sub = category.subcategories.find((item) => item.id === query.subcategory);
  if (sub) trail.push({ label: sub.name });
  return trail;
}

function activeCount(query: ShopQuery) {
  return (
    (query.category ? 1 : 0) +
    (query.brands?.length ?? 0) +
    (query.colors?.length ?? 0) +
    (query.sizes?.length ?? 0) +
    (query.availability?.length ?? 0) +
    (query.minPrice !== undefined || query.maxPrice !== undefined ? 1 : 0) +
    (query.minRating !== undefined ? 1 : 0)
  );
}

function heading(query: ShopQuery, categories: Category[]) {
  const category = categories.find((item) => item.id === query.category);
  if (!category) return "All products";
  const sub = category.subcategories.find((item) => item.id === query.subcategory);
  return sub ? sub.name : category.name;
}

export default async function ShopPage({ searchParams }: PageProps<"/shop">) {
  const query = parseShopQuery(await searchParams);
  // The store's whole active catalogue, filtered and counted here (see shop.ts)
  const apiProducts = await getStoreProducts(storeHostFrom(await headers()));
  const all = apiProducts.map(toCatalogProduct);
  const taxonomy = buildTaxonomy(apiProducts);
  const result = searchProducts(all, query);
  const counts = getFacetCounts(all, query);

  const from = (result.page - 1) * PAGE_SIZE + 1;
  const to = Math.min(result.page * PAGE_SIZE, result.total);

  return (
    <main className="container py-6">
      {/* The breadcrumb carries the page's identity visually, but a document
          still needs one h1 — hence the visually hidden heading. */}
      <h1 className="sr-only">{heading(query, taxonomy.categories)}</h1>

      <div className="mb-6">
        <Breadcrumb items={crumbs(query, taxonomy.categories)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[17rem_1fr]">
        <div className="hidden lg:block">
          <FilterSidebar query={query} counts={counts} taxonomy={taxonomy} />
        </div>

        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border-subtle bg-bg-surface px-4 py-3">
            <MobileFilters activeCount={activeCount(query)}>
              <FilterSidebar query={query} counts={counts} taxonomy={taxonomy} bare />
            </MobileFilters>

            <SortSelect query={query} />

            <p className="ml-auto text-small text-text-secondary">
              {result.total
                ? `Showing ${from}–${to} of ${result.total}`
                : "No products match these filters"}
            </p>

            <ViewToggle query={query} />
          </div>

          <ActiveFilters query={query} taxonomy={taxonomy} />

          <ProductGrid products={result.products} view={query.view} />

          <Pagination query={query} page={result.page} pageCount={result.pageCount} />
        </div>
      </div>
    </main>
  );
}
