import Link from "next/link";
import { AppImage } from "@/components/ui/app-image";
import { TrashIcon } from "@/components/ui/icons";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import type { CartLine } from "@/lib/cart/types";

/** One line of the cart drawer; the drawer passes the handlers in */
export function CartDrawerLine({
  line,
  onQuantity,
  onRemove,
  onNavigate,
}: {
  line: CartLine;
  onQuantity: (quantity: number) => void;
  onRemove: () => void;
  onNavigate: () => void;
}) {
  return (
    <li className="flex gap-3 py-4">
      <Link
        href={line.href}
        onClick={onNavigate}
        className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-bg-sunken"
      >
        <AppImage src={line.image} alt={line.name} fill sizes="80px" className={line.unavailable ? "object-cover opacity-50" : "object-cover"} />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-small font-semibold text-text-primary">
              <Link href={line.href} onClick={onNavigate} className="hover:text-text-brand">
                {line.name}
              </Link>
            </h3>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-caption text-text-secondary">
              {line.optionLabel ? <span>{line.optionLabel}</span> : null}
              <span className="rounded-sm bg-brand-50 px-1.5 py-0.5 font-medium text-text-brand tabular">
                ৳{line.unitPrice.toLocaleString()} each
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${line.name}`}
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-danger-text transition-colors duration-150 hover:bg-danger-subtle"
          >
            <TrashIcon className="size-4" />
          </button>
        </div>

        <div className="flex items-center justify-between gap-2">
          <QuantityStepper compact value={line.quantity} max={line.maxQuantity} disabled={line.unavailable} onChange={onQuantity} />
          {line.unavailable ? (
            <p className="text-caption font-medium text-danger-text">No longer available</p>
          ) : (
            <p className="text-small font-semibold text-success-text tabular">
              ৳{(line.unitPrice * line.quantity).toLocaleString()}
            </p>
          )}
        </div>
      </div>
    </li>
  );
}
