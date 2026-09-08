import type { Metadata } from "next";
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
import { CATEGORIES } from "@/lib/catalog/taxonomy";
import type { ShopQuery } from "@/lib/catalog/types";

export const metadata: Metadata = {
  title: "Shop",
  description: "Every piece in the ShoPzio catalogue, filtered how you like it.",
};

function crumbs(query: ShopQuery): Crumb[] {
  const trail: Crumb[] = [{ label: "Home", href: "/" }, { label: "Shop", href: "/shop" }];
  const category = CATEGORIES.find((item) => item.id === query.category);
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

function heading(query: ShopQuery) {
  const category = CATEGORIES.find((item) => item.id === query.category);
  if (!category) return "All products";
  const sub = category.subcategories.find((item) => item.id === query.subcategory);
  return sub ? sub.name : category.name;
}

export default async function ShopPage({ searchParams }: PageProps<"/shop">) {
  const query = parseShopQuery(await searchParams);
  const [result, counts] = await Promise.all([
    searchProducts(query),
    getFacetCounts(query),
  ]);

  const from = (result.page - 1) * PAGE_SIZE + 1;
  const to = Math.min(result.page * PAGE_SIZE, result.total);

  return (
    <main className="container py-6">
      {/* The breadcrumb carries the page's identity visually, but a document
          still needs one h1 — hence the visually hidden heading. */}
      <h1 className="sr-only">{heading(query)}</h1>

      <div className="mb-6">
        <Breadcrumb items={crumbs(query)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[17rem_1fr]">
        <div className="hidden lg:block">
          <FilterSidebar query={query} counts={counts} />
        </div>

        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border-subtle bg-bg-surface px-4 py-3">
            <MobileFilters activeCount={activeCount(query)}>
              <FilterSidebar query={query} counts={counts} bare />
            </MobileFilters>

            <SortSelect query={query} />

            <p className="ml-auto text-small text-text-secondary">
              {result.total
                ? `Showing ${from}–${to} of ${result.total}`
                : "No products match these filters"}
            </p>

            <ViewToggle query={query} />
          </div>

          <ActiveFilters query={query} />

          <ProductGrid products={result.products} view={query.view} />

          <Pagination query={query} page={result.page} pageCount={result.pageCount} />
        </div>
      </div>
    </main>
  );
}
