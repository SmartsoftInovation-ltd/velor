import Link from "next/link";
import { ProductCard } from "@/components/home/product-card";
import type { CatalogProduct, ViewMode } from "@/lib/catalog/types";
import { ProductRow } from "./product-row";

export function ProductGrid({
  products,
  view = "grid",
}: {
  products: CatalogProduct[];
  view?: ViewMode;
}) {
  if (!products.length) {
    return (
      <div className="rounded-lg border border-dashed border-border-default bg-bg-surface p-12 text-center">
        <p className="text-body font-semibold text-text-primary">
          Nothing matches those filters
        </p>
        <p className="mt-1 text-small text-text-secondary">
          Try widening the price range, or clearing a facet or two.
        </p>
        <Link
          href="/shop"
          className="mt-4 inline-flex text-small font-medium text-text-brand transition-opacity duration-150 hover:opacity-80"
        >
          Clear all filters
        </Link>
      </div>
    );
  }

  if (view === "list") {
    return (
      <ul className="space-y-4">
        {products.map((product) => (
          <li key={product.id}>
            <ProductRow product={product} />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul className="product-grid-filtered grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-3 lg:gap-6">
      {products.map((product) => (
        <li key={product.id}>
          <ProductCard product={product} />
        </li>
      ))}
    </ul>
  );
}
