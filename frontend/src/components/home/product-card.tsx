import Link from "next/link";
import { AppImage } from "@/components/ui/app-image";
import { Badge, StatusDot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CartIcon, EyeIcon, HeartIcon } from "@/components/ui/icons";
import { Stars } from "@/components/ui/stars";
import type { Product } from "@/lib/product";

export function ProductCard({ product }: { product: Product }) {
  const { compareAtPrice, price, stock } = product;
  const onSale = compareAtPrice !== undefined && compareAtPrice > price;
  const discountPct =
    onSale && compareAtPrice !== undefined
      ? Math.round(((compareAtPrice - price) / compareAtPrice) * 100)
      : null;

  return (
    <article className="group flex flex-col overflow-hidden rounded-lg border border-border-subtle bg-bg-surface shadow-sm">
      <div className="relative aspect-4/3 overflow-hidden bg-bg-sunken">
        {/* The link fills the well itself: a bare <Link> is `static`, so the
            `fill` image below would size against the card instead of it. */}
        <Link
          href={product.href}
          tabIndex={-1}
          aria-hidden="true"
          className="absolute inset-0"
        >
          <AppImage
            src={product.image}
            alt={product.alt}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="transform-gpu object-cover transition-transform duration-300 ease-[var(--ease-hover)] group-hover:scale-[1.06]"
          />
        </Link>

        <div className="absolute inset-x-3 top-3 flex items-start justify-between">
          {discountPct !== null ? (
            <Badge tone="brand" variant="solid">
              {discountPct}% OFF
            </Badge>
          ) : (
            <span />
          )}
          <Button
            variant="secondary"
            size="sm"
            aria-label={`Save ${product.name} to wishlist`}
            icon={<HeartIcon />}
            className="rounded-full hover:text-danger-solid"
          />
        </div>

        {stock === "out" ? (
          <div className="absolute inset-0 flex items-center justify-center bg-bg-canvas/70 backdrop-blur-[1px]">
            <span className="rounded-md bg-bg-inverse px-3 py-1.5 text-caption font-medium text-text-inverse">
              Sold out
            </span>
          </div>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="space-y-1.5">
          <p className="text-micro font-medium tracking-wide text-text-tertiary uppercase">
            {product.brand}
          </p>
          <h3 className="text-h3 font-semibold text-text-primary">
            <Link href={product.href} title={product.name} className="block truncate">
              {product.name}
            </Link>
          </h3>
          {/* No stars until the product has been rated */}
          {product.rating > 0 ? (
            <div className="flex items-center gap-2">
              <Stars rating={product.rating} />
              <span className="text-caption text-text-tertiary tabular">
                {product.rating}
                {product.reviews ? ` (${product.reviews})` : null}
              </span>
            </div>
          ) : null}
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

        <div className="mt-auto space-y-3">
          {stock === "in" ? <StatusDot tone="success">In stock</StatusDot> : null}
          {stock === "low" ? (
            <StatusDot tone="warning">
              {product.stockCount ? `Only ${product.stockCount} left` : "Low stock"}
            </StatusDot>
          ) : null}
          {stock === "out" ? <StatusDot tone="danger">Out of stock</StatusDot> : null}

          <div className="flex gap-2">
            <Button
              variant="primary"
              fullWidth
              icon={<CartIcon />}
              disabled={stock === "out"}
            >
              Add to cart
            </Button>
            <Button
              variant="secondary"
              aria-label={`Quick view ${product.name}`}
              icon={<EyeIcon />}
            />
          </div>
        </div>
      </div>
    </article>
  );
}
