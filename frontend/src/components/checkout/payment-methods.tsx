import { CheckoutSection } from "@/components/checkout/checkout-section";
import { ShieldCheckIcon } from "@/components/ui/icons";
import type { PaymentMethod } from "@/lib/checkout";

const METHODS = [
  {
    id: "sslcommerz",
    name: "Pay online",
    note: "Card, bKash, Nagad, Rocket or net banking on the secure SSLCommerz page",
  },
  { id: "cod", name: "Cash on delivery", note: "Pay the courier when it arrives" },
] as const satisfies readonly { id: PaymentMethod; name: string; note: string }[];

/* Card details are never typed here: online payment happens on the gateway's
   own page, so this shop never sees a card number. */
export function PaymentMethods({
  selected,
  onSelect,
}: {
  selected: PaymentMethod;
  onSelect: (method: PaymentMethod) => void;
}) {
  return (
    <CheckoutSection
      step={4}
      title="Payment"
      description="Online payments are handled by SSLCommerz."
      action={
        <span className="flex shrink-0 items-center gap-1.5 text-caption text-text-tertiary">
          <ShieldCheckIcon className="size-4" />
          Secure
        </span>
      }
    >
      <fieldset>
        <legend className="sr-only">Payment method</legend>

        <div className="grid gap-3 sm:grid-cols-2">
          {METHODS.map((method) => (
            <div key={method.id} className="relative">
              <input
                type="radio"
                name="paymentMethod"
                id={`payment-${method.id}`}
                value={method.id}
                checked={selected === method.id}
                onChange={() => onSelect(method.id)}
                className="peer sr-only"
              />
              <label
                htmlFor={`payment-${method.id}`}
                className="block h-full cursor-pointer rounded-lg border border-border-default bg-bg-surface p-4 transition-colors duration-150 hover:border-border-strong hover:bg-bg-hover peer-checked:border-border-brand peer-checked:bg-brand-50 peer-focus-visible:border-border-brand"
              >
                <span className="block text-small font-semibold text-text-primary">{method.name}</span>
                <span className="block text-caption text-text-secondary">{method.note}</span>
              </label>
            </div>
          ))}
        </div>
      </fieldset>
    </CheckoutSection>
  );
}
