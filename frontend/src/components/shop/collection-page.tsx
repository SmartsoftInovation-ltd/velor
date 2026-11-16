import Link from "next/link";
import type { ReactNode } from "react";
import { ProductCard } from "@/components/home/product-card";
import type { CatalogProduct } from "@/lib/catalog/types";
import { Breadcrumb } from "./breadcrumb";
import { InfiniteList } from "./infinite-list";

type Props = {
  title: string;
  description: string;
  /** Beside the heading, e.g. a countdown */
  action?: ReactNode;
  products: CatalogProduct[];
  empty: { title: string; text: string };
};

/**
 * A fixed collection of the store's products (New arrivals, Offers): heading,
 * then its products as cards, more of them as the shopper scrolls. No filters;
 * the collection is the filter.
 */
export function CollectionPage({ title, description, action, products, empty }: Props) {
  return (
    <main className="container py-6">
      <div className="mb-6">
        <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Shop", href: "/shop" }, { label: title }]} />
      </div>

      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-h1 font-semibold tracking-tight text-text-primary">{title}</h1>
          <p className="mt-1 text-body text-text-secondary">
            {description}
            {products.length ? ` ${products.length} ${products.length === 1 ? "product" : "products"}.` : ""}
          </p>
        </div>
        {action}
      </div>

      {products.length ? (
        <InfiniteList className="product-grid grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 lg:gap-6">
          {products.map((product) => (
            <li key={`${product.id}:${product.href}`}>
              <ProductCard product={product} />
            </li>
          ))}
        </InfiniteList>
      ) : (
        <div className="rounded-lg border border-dashed border-border-default bg-bg-surface p-12 text-center">
          <p className="text-body font-semibold text-text-primary">{empty.title}</p>
          <p className="mt-1 text-small text-text-secondary">{empty.text}</p>
          <Link
            href="/shop"
            className="mt-4 inline-flex text-small font-medium text-text-brand transition-opacity duration-150 hover:opacity-80"
          >
            Browse all products
          </Link>
        </div>
      )}
    </main>
  );
}
