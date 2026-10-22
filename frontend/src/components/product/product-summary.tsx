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
          {product.rating > 0 ? (
            <div className="flex items-center gap-2">
              <Stars rating={product.rating} />
              <span className="text-small tabular text-text-secondary">{product.rating}</span>
            </div>
          ) : null}
          {product.sku ? (
            <span className="text-caption text-text-tertiary">
              SKU <span className="font-mono">{product.sku}</span>
            </span>
          ) : null}
        </div>
      </div>

      <ProductPurchase
        price={product.price}
        stockCount={product.stockCount}
        variants={product.variants}
        colors={product.colors}
        sizes={product.sizes}
        soldOutSizes={product.soldOutSizes}
        productName={product.name}
        initialVariantId={initialVariantId}
      />
    </div>
  );
}
