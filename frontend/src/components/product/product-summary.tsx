import { WishlistToggle } from "@/components/cart/wishlist-toggle";
import { Stars } from "@/components/ui/stars";
import type { ProductDetail } from "@/lib/catalog/types";
import { ProductPurchase } from "./product-purchase";
import { ShareButton } from "./share-button";

export function ProductSummary({
  product,
  initialVariantId,
}: {
  product: ProductDetail;
  initialVariantId?: string;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-h1 font-bold tracking-tight text-text-primary">{product.name}</h1>
          <div className="flex shrink-0 items-center gap-2 pt-1">
            <WishlistToggle item={product.item} size="sm" className="rounded-full" />
            <ShareButton productName={product.name} />
          </div>
        </div>
        {product.brand ? <p className="text-small text-text-tertiary">{product.brand}</p> : null}
        {product.sku ? (
          <p className="flex items-center gap-2 text-small text-text-tertiary">
            SKU
            <span className="rounded-sm bg-bg-sunken px-1.5 py-0.5 font-mono text-caption text-text-secondary">
              {product.sku}
            </span>
          </p>
        ) : null}
        {product.rating > 0 ? (
          <div className="flex items-center gap-2">
            <Stars rating={product.rating} className="size-4" />
            <span className="text-small tabular text-text-secondary">
              {product.reviews ? `${product.reviews} Ratings` : product.rating}
            </span>
          </div>
        ) : null}
      </div>

      <ProductPurchase
        price={product.price}
        compareAtPrice={product.compareAtPrice}
        stockCount={product.stockCount}
        variants={product.variants}
        colors={product.colors}
        sizes={product.sizes}
        soldOutSizes={product.soldOutSizes}
        productName={product.name}
        item={product.item}
        initialVariantId={initialVariantId}
        sizeChart={product.sizeChart}
      />
    </div>
  );
}
