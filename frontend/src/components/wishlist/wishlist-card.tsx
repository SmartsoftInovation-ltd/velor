import Link from "next/link";
import { AppImage } from "@/components/ui/app-image";
import { Badge, StatusDot } from "@/components/ui/badge";
import { CartIcon, EyeIcon, TrashIcon } from "@/components/ui/icons";
import { Stars } from "@/components/ui/stars";
import type { WishlistItem } from "@/lib/catalog/wishlist-fixture";

function savedOn(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Dhaka",
  });
}

/**
 * A saved product. Close to the shop card, but the hover actions are replaced
 * by the two things a wishlist is for: move it to the bag, or drop it.
 */
export function WishlistCard({ item }: { item: WishlistItem }) {
  const { product } = item;
  const onSale =
    product.compareAtPrice !== undefined && product.compareAtPrice > product.price;
  const discountPct =
    onSale && product.compareAtPrice !== undefined
      ? Math.round(
          ((product.compareAtPrice - product.price) / product.compareAtPrice) * 100,
        )
      : null;

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-lg border border-border-subtle bg-bg-surface shadow-sm transition-shadow duration-200 hover:shadow-md">
      <div className="relative aspect-4/3 overflow-hidden bg-bg-sunken">
        <Link href={product.href} tabIndex={-1} aria-hidden="true" className="absolute inset-0">
          <AppImage
            src={product.image}
            alt={product.alt}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="transform-gpu object-cover transition-transform duration-300 ease-[var(--ease-hover)] group-hover:scale-[1.06]"
          />
        </Link>

        <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          {discountPct !== null ? (
            <Badge tone="brand" variant="solid">
              {discountPct}% OFF
            </Badge>
          ) : (
            <span />
          )}

          <button
            type="button"
            aria-label={`Remove ${product.name} from wishlist`}
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-bg-surface/90 text-text-tertiary shadow-xs backdrop-blur-sm transition-colors duration-150 hover:bg-danger-subtle hover:text-danger-text"
          >
            <TrashIcon className="size-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="text-micro font-medium uppercase tracking-wide text-text-tertiary">
          {product.brand}
        </p>

        <h3 className="line-clamp-2 text-small font-semibold text-text-primary">
          <Link href={product.href} className="hover:text-text-brand">
            {product.name}
          </Link>
        </h3>

        <Stars rating={product.rating} />

        <div className="flex flex-wrap items-baseline gap-2">
          <p className="text-body font-semibold tabular text-text-primary">
            ৳{product.price.toLocaleString()}
          </p>
          {onSale && product.compareAtPrice ? (
            <p className="text-caption tabular text-text-tertiary line-through">
              ৳{product.compareAtPrice.toLocaleString()}
            </p>
          ) : null}
        </div>

        <StatusDot tone={product.stock === "low" ? "warning" : "success"} size="sm">
          {product.stock === "low" ? "Only a few left" : "In stock"}
        </StatusDot>

        <div className="mt-auto space-y-2 pt-2">
          <div className="flex gap-2">
            <button
              type="button"
              className="shine relative inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-md bg-brand-500 px-4 text-small font-medium text-white shadow-brand transition-[background-color,transform] duration-200 ease-[var(--ease-hover)] hover:bg-brand-600 active:scale-[0.98]"
            >
              <span className="relative z-2 flex shrink-0 [&>svg]:size-4" aria-hidden="true">
                <CartIcon />
              </span>
              Move to bag
            </button>

            {/* Matches the shop card's icon-only view action, but this one
                navigates — so it is a Link wearing Button's secondary skin
                rather than a <button>. */}
            <Link
              href={product.href}
              aria-label={`View ${product.name}`}
              className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border-default bg-bg-surface text-text-primary shadow-xs transition-colors duration-200 ease-[var(--ease-hover)] hover:border-border-strong hover:bg-bg-hover"
            >
              <EyeIcon className="size-4" />
            </Link>
          </div>

          <p className="text-center text-micro text-text-tertiary">
            Saved {savedOn(item.savedAt)}
          </p>
        </div>
      </div>
    </article>
  );
}
