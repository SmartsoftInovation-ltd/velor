import { AppImage } from "@/components/ui/app-image";
import type { CartLine } from "@/lib/cart/types";

/** The bag's lines as read-only thumbnails in the checkout panel. */
export function OrderReviewLines({ lines }: { lines: CartLine[] }) {
  return (
    <ul className="space-y-3">
      {lines.map((line) => (
        <li key={line.key} className="flex items-center gap-3">
          <div className="relative size-14 shrink-0 overflow-hidden rounded-md bg-bg-sunken">
            <AppImage src={line.image} alt={line.name} fill sizes="56px" className="object-cover" />
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-small font-medium text-text-primary">{line.name}</p>
            {/* Quantity rides the variant line rather than sitting as a
                badge over the thumbnail, which covered the product. */}
            <p className="flex flex-wrap items-center gap-x-1.5 text-caption text-text-tertiary">
              {line.optionLabel ? (
                <>
                  <span>{line.optionLabel}</span>
                  <span aria-hidden="true" className="text-border-default">
                    |
                  </span>
                </>
              ) : null}
              <span>
                Qty <span className="font-medium tabular text-text-secondary">{line.quantity}</span>
              </span>
            </p>
          </div>

          <p className="shrink-0 text-small font-semibold tabular text-text-primary">
            ৳{(line.unitPrice * line.quantity).toLocaleString()}
          </p>
        </li>
      ))}
    </ul>
  );
}
