import { CheckoutSection, Field } from "@/components/checkout/checkout-section";
import { ShieldCheckIcon } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";

const METHODS = [
  { id: "card", name: "Card", note: "Visa, Mastercard, Amex", defaultChecked: true },
  { id: "bkash", name: "bKash", note: "Pay from your wallet", defaultChecked: false },
  { id: "cod", name: "Cash on delivery", note: "Pay the courier", defaultChecked: false },
] as const;

export function PaymentMethods() {
  return (
    <CheckoutSection
      step={4}
      title="Payment"
      description="All transactions are encrypted."
      action={
        <span className="flex shrink-0 items-center gap-1.5 text-caption text-text-tertiary">
          <ShieldCheckIcon className="size-4" />
          Secure
        </span>
      }
    >
      <fieldset className="space-y-3">
        <legend className="sr-only">Payment method</legend>

        <div className="grid gap-3 sm:grid-cols-3">
          {METHODS.map((method) => (
            <div key={method.id} className="relative">
              <input
                type="radio"
                name="payment"
                id={`payment-${method.id}`}
                defaultChecked={method.defaultChecked}
                className="peer sr-only"
              />
              <label
                htmlFor={`payment-${method.id}`}
                className="block h-full cursor-pointer rounded-lg border border-border-default bg-bg-surface p-4 transition-colors duration-150 hover:border-border-strong hover:bg-bg-hover peer-checked:border-border-brand peer-checked:bg-brand-50 peer-focus-visible:border-border-brand"
              >
                <span className="block text-small font-semibold text-text-primary">
                  {method.name}
                </span>
                <span className="block text-caption text-text-secondary">{method.note}</span>
              </label>
            </div>
          ))}
        </div>
      </fieldset>

      {/* Card fields are shown flat rather than revealed on selection —
          toggling them would need client state this page deliberately has none
          of. */}
      <div className="mt-5 grid gap-4 border-t border-border-subtle pt-5 sm:grid-cols-2">
        <Field label="Card number" htmlFor="checkout-card" className="sm:col-span-2">
          <Input
            id="checkout-card"
            inputMode="numeric"
            autoComplete="cc-number"
            placeholder="4242 4242 4242 4242"
          />
        </Field>

        <Field label="Expiry" htmlFor="checkout-expiry">
          <Input id="checkout-expiry" autoComplete="cc-exp" placeholder="MM / YY" />
        </Field>

        <Field label="CVC" htmlFor="checkout-cvc">
          <Input id="checkout-cvc" autoComplete="cc-csc" placeholder="123" />
        </Field>
      </div>
    </CheckoutSection>
  );
}
