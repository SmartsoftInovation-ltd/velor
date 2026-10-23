import { CheckoutSection } from "@/components/checkout/checkout-section";
import { FieldError } from "@/components/checkout/field-error";
import { TruckIcon } from "@/components/ui/icons";
import type { DeliveryOption } from "@/lib/checkout";

type Props = {
  options: DeliveryOption[];
  selected: string;
  onSelect: (id: string) => void;
  error?: string;
};

/* The shop's own delivery options, from GET /shop/delivery-options. The price
   shown is a preview; the order is charged what the shop has on record. */
export function DeliveryOptions({ options, selected, onSelect, error }: Props) {
  return (
    <CheckoutSection step={3} title="Delivery" description="Choose where it is delivered.">
      {options.length ? (
        <fieldset className="space-y-3">
          <legend className="sr-only">Delivery method</legend>

          {options.map((option) => (
            <div key={option._id} className="relative">
              <input
                type="radio"
                name="deliveryChargeId"
                id={`delivery-${option._id}`}
                value={option._id}
                checked={selected === option._id}
                onChange={() => onSelect(option._id)}
                className="peer sr-only"
              />
              <label
                htmlFor={`delivery-${option._id}`}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-border-default bg-bg-surface p-4 transition-colors duration-150 hover:border-border-strong hover:bg-bg-hover peer-checked:border-border-brand peer-checked:bg-brand-50 peer-focus-visible:border-border-brand"
              >
                <TruckIcon className="size-5 shrink-0 text-text-tertiary" />
                <span className="min-w-0 flex-1">
                  <span className="block text-small font-semibold text-text-primary">{option.name}</span>
                  {option.description ? (
                    <span className="block text-caption text-text-secondary">{option.description}</span>
                  ) : null}
                </span>
                <span className="shrink-0 text-small font-semibold tabular text-text-primary">
                  {option.charge ? `৳${option.charge.toLocaleString()}` : "Free"}
                </span>
              </label>
            </div>
          ))}
        </fieldset>
      ) : (
        <p className="text-small text-text-secondary">Delivery is arranged by the shop after you order.</p>
      )}
      <FieldError message={error} />
    </CheckoutSection>
  );
}
