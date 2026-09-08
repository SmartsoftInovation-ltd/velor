import { CheckoutSection } from "@/components/checkout/checkout-section";
import { TruckIcon } from "@/components/ui/icons";
import { SHIPPING_FLAT } from "@/lib/catalog/cart-fixture";

const OPTIONS = [
  {
    id: "standard",
    name: "Standard",
    eta: "3–5 business days",
    price: SHIPPING_FLAT,
    defaultChecked: true,
  },
  { id: "express", name: "Express", eta: "1–2 business days", price: 260, defaultChecked: false },
  { id: "pickup", name: "Store pickup", eta: "Ready today, Banani outlet", price: 0, defaultChecked: false },
] as const;

/* `peer-checked` does the selected styling in CSS, so the radio group needs no
   client state — the browser owns which one is on. */
export function DeliveryOptions() {
  return (
    <CheckoutSection
      step={3}
      title="Delivery"
      description="Choose how fast it gets there."
    >
      <fieldset className="space-y-3">
        <legend className="sr-only">Delivery method</legend>

        {OPTIONS.map((option) => (
          <div key={option.id} className="relative">
            <input
              type="radio"
              name="delivery"
              id={`delivery-${option.id}`}
              defaultChecked={option.defaultChecked}
              className="peer sr-only"
            />
            <label
              htmlFor={`delivery-${option.id}`}
              className="flex cursor-pointer items-center gap-3 rounded-lg border border-border-default bg-bg-surface p-4 transition-colors duration-150 hover:border-border-strong hover:bg-bg-hover peer-checked:border-border-brand peer-checked:bg-brand-50 peer-focus-visible:border-border-brand"
            >
              <TruckIcon className="size-5 shrink-0 text-text-tertiary" />
              <span className="min-w-0 flex-1">
                <span className="block text-small font-semibold text-text-primary">
                  {option.name}
                </span>
                <span className="block text-caption text-text-secondary">{option.eta}</span>
              </span>
              <span className="shrink-0 text-small font-semibold tabular text-text-primary">
                {option.price ? `৳${option.price}` : "Free"}
              </span>
            </label>
          </div>
        ))}
      </fieldset>
    </CheckoutSection>
  );
}
