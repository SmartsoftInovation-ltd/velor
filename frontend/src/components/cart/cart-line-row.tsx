import Link from "next/link";
import { AppImage } from "@/components/ui/app-image";
import { StatusDot } from "@/components/ui/badge";
import { HeartIcon, TrashIcon } from "@/components/ui/icons";
import type { CartLine } from "@/lib/catalog/cart-fixture";
import { COLORS } from "@/lib/catalog/taxonomy";

export function CartLineRow({ line }: { line: CartLine }) {
  const { product } = line;
  const swatch = COLORS.find((item) => item.id === line.color);
  const lineTotal = product.price * line.quantity;
  const onSale =
    product.compareAtPrice !== undefined && product.compareAtPrice > product.price;

  return (
    <li className="flex gap-4 rounded-xl border border-border-subtle bg-bg-surface p-4 shadow-xs sm:gap-5 sm:p-5">
      <Link
        href={product.href}
        className="relative size-24 shrink-0 overflow-hidden rounded-lg bg-bg-sunken sm:size-32"
      >
        <AppImage
          src={product.image}
          alt={product.alt}
          fill
          sizes="128px"
          className="object-cover"
        />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col justify-between gap-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-1.5">
            <p className="text-micro font-medium uppercase tracking-wide text-text-tertiary">
              {product.brand}
            </p>
            <h2 className="truncate text-body font-semibold text-text-primary">
              <Link href={product.href} className="hover:text-text-brand">
                {product.name}
              </Link>
            </h2>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-text-secondary">
              <span className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="size-3 rounded-full border border-black/10"
                  style={{ backgroundColor: swatch?.swatch ?? "#999" }}
                />
                {swatch?.name ?? line.color}
              </span>
              <span className="text-border-default">|</span>
              <span>Size {line.size}</span>
            </div>

            <StatusDot
              tone={product.stock === "low" ? "warning" : "success"}
              size="sm"
            >
              {product.stock === "low" ? "Only a few left" : "In stock"}
            </StatusDot>
          </div>

          <div className="shrink-0 text-right">
            <p className="text-body font-semibold tabular text-text-primary">
              ৳{lineTotal.toLocaleString()}
            </p>
            {onSale && product.compareAtPrice ? (
              <p className="text-caption tabular text-text-tertiary line-through">
                ৳{(product.compareAtPrice * line.quantity).toLocaleString()}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex h-9 items-center rounded-md border border-border-default bg-bg-surface">
            <span
              aria-hidden="true"
              className="flex size-9 items-center justify-center text-text-tertiary"
            >
              −
            </span>
            <span className="w-8 text-center text-small font-medium tabular">
              {line.quantity}
            </span>
            <span
              aria-hidden="true"
              className="flex size-9 items-center justify-center text-text-tertiary"
            >
              +
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-caption font-medium text-text-tertiary transition-colors duration-150 hover:bg-bg-hover hover:text-text-primary"
            >
              <HeartIcon className="size-4" />
              Save
            </button>
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-md bg-danger-subtle px-2 py-1.5 text-caption font-medium text-danger-text transition-[filter] duration-150 hover:brightness-95"
            >
              <TrashIcon className="size-4" />
              Remove
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}
