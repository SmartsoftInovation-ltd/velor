import { StatusDot } from "@/components/ui/badge";
import { Stars } from "@/components/ui/stars";
import type { ProductDetail } from "@/lib/catalog/types";
import { ProductOptions } from "./product-options";
import { ShareButton } from "./share-button";

export function ProductSummary({ product }: { product: ProductDetail }) {
  const { compareAtPrice, price } = product;
  const onSale = compareAtPrice !== undefined && compareAtPrice > price;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <p className="text-micro font-medium uppercase tracking-wide text-text-tertiary">
            {product.brand}
          </p>
          <ShareButton productName={product.name} />
        </div>
        <h1 className="text-h1 font-semibold tracking-tight text-text-primary">
          {product.name}
        </h1>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <div className="flex items-center gap-2">
            <Stars rating={product.rating} />
            <span className="text-small tabular text-text-secondary">
              {product.rating} ({product.reviews} ratings)
            </span>
          </div>
          <span className="text-caption text-text-tertiary">
            SKU <span className="font-mono">{product.sku}</span>
          </span>
        </div>
      </div>

      <div className="flex items-baseline gap-3">
        <p className="text-h2 font-semibold tabular text-text-primary">
          ৳{price.toLocaleString()}
        </p>
        {onSale && compareAtPrice ? (
          <p className="text-h2 font-medium tabular text-text-tertiary line-through">
            ৳{compareAtPrice.toLocaleString()}
          </p>
        ) : null}
      </div>

      <p className="flex items-center gap-2 text-small text-text-secondary">
        Availability:
        {product.stockCount > 0 ? (
          <StatusDot tone={product.stockCount <= 5 ? "warning" : "success"}>
            In stock · {product.stockCount} left
          </StatusDot>
        ) : (
          <StatusDot tone="danger">Out of stock</StatusDot>
        )}
      </p>

      <ProductOptions
        colors={product.colors}
        sizes={product.sizes}
        soldOutSizes={product.soldOutSizes}
        stockCount={product.stockCount}
        productName={product.name}
      />
    </div>
  );
}
