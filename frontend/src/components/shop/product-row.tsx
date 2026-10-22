import Link from "next/link";
import { AppImage } from "@/components/ui/app-image";
import { Badge, StatusDot } from "@/components/ui/badge";
import { AddToCartButton } from "@/components/cart/add-to-cart-button";
import { WishlistToggle } from "@/components/cart/wishlist-toggle";
import { Stars } from "@/components/ui/stars";
import type { CatalogProduct } from "@/lib/catalog/types";

/**
 * The list-view counterpart to ProductCard: same data, laid out on one row so
 * more of the result set fits on screen. A separate component rather than a
 * variant prop — the two share no markup beyond the pieces they both import.
 */
export function ProductRow({ product }: { product: CatalogProduct }) {
  const { compareAtPrice, price, stock } = product;
  const onSale = compareAtPrice !== undefined && compareAtPrice > price;
  const discountPct =
    onSale && compareAtPrice !== undefined
      ? Math.round(((compareAtPrice - price) / compareAtPrice) * 100)
      : null;

  return (
    <article className="group flex gap-4 overflow-hidden rounded-lg border border-border-subtle bg-bg-surface p-3 shadow-sm sm:gap-5 sm:p-4">
      <div className="relative aspect-square w-28 shrink-0 overflow-hidden rounded-md bg-bg-sunken sm:w-40">
        <Link href={product.href} tabIndex={-1} aria-hidden="true" className="absolute inset-0">
          <AppImage
            src={product.image}
            alt={product.alt}
            fill
            sizes="(min-width: 640px) 10rem, 7rem"
            className="transform-gpu object-cover transition-transform duration-300 ease-[var(--ease-hover)] group-hover:scale-[1.06]"
          />
        </Link>
        {discountPct !== null ? (
          <div className="absolute top-2 left-2">
            <Badge tone="brand" variant="solid">
              {discountPct}% OFF
            </Badge>
          </div>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="text-micro font-medium tracking-wide text-text-tertiary uppercase">
          {product.brand}
        </p>
        <h3 className="text-h3 font-semibold text-text-primary">
          <Link href={product.href} title={product.name} className="block truncate">
            {product.name}
          </Link>
        </h3>

        <div className="flex items-center gap-2">
          <Stars rating={product.rating} />
          <span className="text-caption text-text-tertiary tabular">
            {product.rating} ({product.reviews})
          </span>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-h3 font-semibold text-text-primary tabular">
            ৳{price.toLocaleString()}
          </span>
          {onSale && compareAtPrice !== undefined ? (
            <span className="text-small text-text-tertiary line-through tabular">
              ৳{compareAtPrice.toLocaleString()}
            </span>
          ) : null}
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-3">
          {stock === "in" ? <StatusDot tone="success">In stock</StatusDot> : null}
          {stock === "low" ? (
            <StatusDot tone="warning">
              {product.stockCount ? `Only ${product.stockCount} left` : "Low stock"}
            </StatusDot>
          ) : null}
          {stock === "out" ? <StatusDot tone="danger">Out of stock</StatusDot> : null}

          <div className="ml-auto flex gap-2">
            <WishlistToggle item={product.item} />
            <AddToCartButton item={product.item} />
          </div>
        </div>
      </div>
    </article>
  );
}
