import Link from "next/link";
import { AppImage } from "@/components/ui/app-image";
import { Badge, StatusDot } from "@/components/ui/badge";
import { AddToCartButton } from "@/components/cart/add-to-cart-button";
import { BuyNowButton } from "@/components/cart/buy-now-button";
import { WishlistToggle } from "@/components/cart/wishlist-toggle";
import { Button } from "@/components/ui/button";
import { EyeIcon } from "@/components/ui/icons";
import { Stars } from "@/components/ui/stars";
import type { CatalogProduct } from "@/lib/catalog/types";

export function ProductCard({ product }: { product: CatalogProduct }) {
  const { compareAtPrice, price, stock } = product;
  const onSale = compareAtPrice !== undefined && compareAtPrice > price;
  const discountPct =
    onSale && compareAtPrice !== undefined
      ? Math.round(((compareAtPrice - price) / compareAtPrice) * 100)
      : null;

  // No stars until the product has been rated
  const rating =
    product.rating > 0 ? (
      <div className="flex items-center gap-2">
        <Stars rating={product.rating} />
        <span className="text-caption text-text-tertiary tabular card-overlay:text-white/70">
          {product.rating}
          {product.reviews ? ` (${product.reviews})` : null}
        </span>
      </div>
    ) : null;
  const stockLine = (
    <>
      {stock === "in" ? <StatusDot tone="success">In stock</StatusDot> : null}
      {stock === "low" ? (
        <StatusDot tone="warning">
          {product.stockCount ? `Only ${product.stockCount} left` : "Low stock"}
        </StatusDot>
      ) : null}
      {stock === "out" ? <StatusDot tone="danger">Out of stock</StatusDot> : null}
    </>
  );

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-lg border border-border-subtle bg-bg-surface shadow-sm card-minimal:rounded-none card-minimal:border-transparent card-minimal:bg-transparent card-minimal:shadow-none">
      <div className="relative aspect-4/3 overflow-hidden bg-bg-sunken card-minimal:aspect-square card-minimal:rounded-lg card-overlay:aspect-3/4">
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
          <WishlistToggle item={product.item} size="sm" className="rounded-full" />
        </div>

        {stock === "out" ? (
          <div className="absolute inset-0 flex items-center justify-center bg-bg-canvas/70 backdrop-blur-[1px]">
            <span className="rounded-md bg-bg-inverse px-3 py-1.5 text-caption font-medium text-text-inverse">
              Sold out
            </span>
          </div>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-4 p-5 max-sm:card-buy:p-3 card-minimal:gap-3 card-minimal:px-0 card-minimal:pb-0 card-minimal:pt-3 card-overlay:absolute card-overlay:inset-x-0 card-overlay:bottom-0 card-overlay:gap-3 card-overlay:bg-linear-to-t card-overlay:from-black/85 card-overlay:via-black/60 card-overlay:to-transparent card-overlay:p-4 card-overlay:pt-14">
        <div className="space-y-1.5">
          <p className="text-micro font-medium tracking-wide text-text-tertiary uppercase card-minimal:hidden card-buy:hidden card-overlay:text-white/70">
            {product.brand}
          </p>
          <h3 className="text-h3 font-semibold text-text-primary card-overlay:text-white card-buy:font-bold">
            <Link href={product.href} title={product.name} className="block truncate">
              {product.name}
            </Link>
          </h3>
          {rating ? <div className="card-buy:hidden">{rating}</div> : null}
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-h3 font-semibold text-text-primary tabular card-overlay:text-white card-buy:font-bold">
            ৳{price.toLocaleString()}
          </span>
          {onSale && compareAtPrice !== undefined ? (
            <span className="text-small text-text-tertiary line-through tabular card-overlay:text-white/70">
              ৳{compareAtPrice.toLocaleString()}
            </span>
          ) : null}
        </div>

        <div className="hidden flex-wrap items-center justify-between gap-x-3 gap-y-1 card-buy:flex">
          {rating}
          <div className="ml-auto">{stockLine}</div>
        </div>

        <div className="mt-auto space-y-3">
          <div className="card-minimal:hidden card-overlay:hidden card-buy:hidden">{stockLine}</div>

          <div className="flex gap-2 card-buy:@container">
            <AddToCartButton
              item={product.item}
              fullWidth
              className="card-buy:w-auto! card-buy:min-w-0 card-buy:flex-1 card-buy:gap-1.5 card-buy:rounded-full card-buy:bg-bg-inverse! card-buy:px-2.5 card-buy:text-small card-buy:font-semibold card-buy:text-text-inverse! card-buy:shadow-md! card-buy:hover:opacity-90 card-buy:@max-[13rem]:flex-none card-buy:@max-[13rem]:w-10! card-buy:@max-[13rem]:px-0 card-buy:@max-[13rem]:[&>span:not(:has(svg))]:hidden card-buy:@min-[13rem]:[&:is(a)>span:has(svg)]:hidden"
            />
            <BuyNowButton
              item={product.buyNowItem ?? product.item}
              className="hidden! card-buy:inline-flex! card-buy:min-w-0 card-buy:flex-1 card-buy:rounded-full card-buy:bg-[var(--buy-now)]! card-buy:px-2.5 card-buy:text-small card-buy:font-semibold card-buy:text-white! card-buy:shadow-md! card-buy:hover:opacity-90"
            />
            <Button
              variant="secondary"
              aria-label={`Quick view ${product.name}`}
              icon={<EyeIcon />}
              className="card-minimal:hidden card-overlay:hidden card-buy:hidden"
            />
          </div>
        </div>
      </div>
    </article>
  );
}
