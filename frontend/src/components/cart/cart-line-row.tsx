import Link from "next/link";
import { AppImage } from "@/components/ui/app-image";
import { StatusDot } from "@/components/ui/badge";
import { HeartIcon, TrashIcon } from "@/components/ui/icons";
import type { CartLine } from "@/lib/cart/types";

const STEP =
  "flex size-9 items-center justify-center text-text-secondary transition-colors duration-150 hover:bg-bg-hover hover:text-text-primary disabled:text-text-disabled disabled:hover:bg-transparent";

/**
 * One cart line: what it is, its price, and the controls to change it. The
 * row owns no state; the cart view passes the handlers in.
 */
export function CartLineRow({
  line,
  onQuantity,
  onRemove,
  onSave,
}: {
  line: CartLine;
  onQuantity: (quantity: number) => void;
  onRemove: () => void;
  onSave: () => void;
}) {
  const lineTotal = line.unitPrice * line.quantity;
  const onSale = line.compareAtPrice !== null && line.compareAtPrice > line.unitPrice;
  const low = line.maxQuantity <= 5;

  return (
    <li className="flex gap-4 rounded-xl border border-border-subtle bg-bg-surface p-4 shadow-xs sm:gap-5 sm:p-5">
      <Link href={line.href} className="relative size-24 shrink-0 overflow-hidden rounded-lg bg-bg-sunken sm:size-32">
        <AppImage src={line.image} alt={line.name} fill sizes="128px" className={line.unavailable ? "object-cover opacity-50" : "object-cover"} />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col justify-between gap-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-1.5">
            <h2 className="truncate text-body font-semibold text-text-primary">
              <Link href={line.href} className="hover:text-text-brand">
                {line.name}
              </Link>
            </h2>
            {line.optionLabel ? <p className="text-caption text-text-secondary">{line.optionLabel}</p> : null}

            {line.unavailable ? (
              <StatusDot tone="danger" size="sm">
                No longer available
              </StatusDot>
            ) : (
              <StatusDot tone={low ? "warning" : "success"} size="sm">
                {low ? `Only ${line.maxQuantity} left` : "In stock"}
              </StatusDot>
            )}
          </div>

          <div className="shrink-0 text-right">
            <p className="text-body font-semibold tabular text-text-primary">৳{lineTotal.toLocaleString()}</p>
            {onSale && line.compareAtPrice ? (
              <p className="text-caption tabular text-text-tertiary line-through">
                ৳{(line.compareAtPrice * line.quantity).toLocaleString()}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex h-9 items-center rounded-md border border-border-default bg-bg-surface">
            <button
              type="button"
              onClick={() => onQuantity(line.quantity - 1)}
              disabled={line.unavailable || line.quantity <= 1}
              aria-label={`Decrease quantity of ${line.name}`}
              className={`${STEP} rounded-l-md`}
            >
              −
            </button>
            <span className="w-8 text-center text-small font-medium tabular" aria-live="polite">
              {line.quantity}
            </span>
            <button
              type="button"
              onClick={() => onQuantity(line.quantity + 1)}
              disabled={line.unavailable || line.quantity >= line.maxQuantity}
              aria-label={`Increase quantity of ${line.name}`}
              className={`${STEP} rounded-r-md`}
            >
              +
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onSave}
              className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-caption font-medium text-text-tertiary transition-colors duration-150 hover:bg-bg-hover hover:text-text-primary"
            >
              <HeartIcon className="size-4" />
              Save for later
            </button>
            <button
              type="button"
              onClick={onRemove}
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
