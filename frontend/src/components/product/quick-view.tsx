"use client";

import { useState } from "react";
import { WishlistToggle } from "@/components/cart/wishlist-toggle";
import { AppImage } from "@/components/ui/app-image";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Stars } from "@/components/ui/stars";
import { forVariant } from "@/lib/cart/snapshot";
import type { CatalogProduct } from "@/lib/catalog/types";
import { QuickViewPurchase } from "./quick-view-purchase";
import { useQuickView } from "./use-quick-view";

/**
 * A product in a modal, opened from its card: the card's own details at once,
 * then the options, stock and SKU as the API has them now. Price, photo and
 * stock follow the picked option, as they do on the product page.
 */
export function QuickView({ product, onClose }: { product: CatalogProduct; onClose: () => void }) {
  const { data, failed } = useQuickView(product.id);
  const [pickedId, setPickedId] = useState<string | null>(null);

  const variants = data?.variants ?? [];
  // The shopper's pick, else the option the card featured, else the first that can be bought
  const variant =
    variants.find((v) => v.id === (pickedId ?? product.item.variantId)) ??
    variants.find((v) => v.stock > 0) ??
    variants[0];
  const price = variant ? variant.price : product.price;
  const wasPrice = variant ? variant.compareAtPrice : product.compareAtPrice;
  const onSale = wasPrice !== undefined && wasPrice > price;
  const item = data ? (variant ? forVariant(data.item, variant) : data.item) : product.item;

  return (
    <Modal label={product.name} onClose={onClose} className="p-5 sm:p-8 lg:p-12">
      <div className="grid gap-6 sm:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] sm:gap-8">
        <div className="relative aspect-4/3 self-start overflow-hidden rounded-lg border border-border-subtle bg-bg-sunken sm:aspect-5/4">
          <AppImage
            src={variant?.image || product.image}
            alt={product.alt}
            fill
            sizes="(min-width: 640px) 360px, 100vw"
            className="object-cover"
          />
          <div className="absolute inset-x-3 top-3 flex items-start justify-between">
            {onSale ? (
              <Badge tone="brand" variant="solid">
                {Math.round(((wasPrice - price) / wasPrice) * 100)}% OFF
              </Badge>
            ) : (
              <span />
            )}
            <WishlistToggle item={product.item} size="sm" className="rounded-full" />
          </div>
        </div>

        <div className="min-w-0 space-y-5">
          <div className="space-y-2 pr-8">
            <h2 className="text-h1 font-semibold tracking-tight text-text-primary">{product.name}</h2>
            {product.brand ? <p className="text-body text-text-tertiary">{product.brand}</p> : null}
            {data?.sku ? (
              <p className="flex items-center gap-2 text-small text-text-tertiary">
                SKU
                <span className="rounded-sm bg-bg-sunken px-2 py-0.5 font-mono text-caption text-text-secondary">
                  {data.sku}
                </span>
              </p>
            ) : null}
            {product.rating > 0 ? (
              <div className="flex items-center gap-2">
                <Stars rating={product.rating} />
                <span className="text-small tabular text-text-secondary">{product.rating}</span>
              </div>
            ) : null}
          </div>

          <p className="flex items-baseline gap-3" aria-live="polite">
            <span className="text-h1 font-bold tabular text-success-solid">৳{price.toLocaleString()}</span>
            {onSale ? (
              <span className="text-body tabular text-text-tertiary line-through">৳{wasPrice.toLocaleString()}</span>
            ) : null}
          </p>

          <QuickViewPurchase
            key={variant?.id ?? "product"}
            loading={!data && !failed}
            failed={Boolean(failed)}
            variants={variants}
            variant={variant}
            available={variant ? variant.stock : (data?.stockCount ?? product.stockCount ?? 0)}
            item={item}
            detailsHref={variant ? item.href : product.href}
            onPick={setPickedId}
            onClose={onClose}
          />
        </div>
      </div>
    </Modal>
  );
}
