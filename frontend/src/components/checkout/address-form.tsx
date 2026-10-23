import { CheckoutSection, Field } from "@/components/checkout/checkout-section";
import { FieldError } from "@/components/checkout/field-error";
import { Input } from "@/components/ui/input";
import type { CheckoutField } from "@/lib/checkout";

const CITIES = ["Dhaka", "Chattogram", "Sylhet", "Khulna", "Rajshahi"] as const;

const SELECT =
  "h-10 w-full appearance-none rounded-md border border-border-default bg-bg-surface px-3 text-body text-text-primary shadow-xs transition-colors duration-150 ease-out hover:border-border-strong focus-visible:border-border-brand focus-visible:outline-none";

export function AddressForm({ errors = {} }: { errors?: Partial<Record<CheckoutField, string>> }) {
  return (
    <CheckoutSection
      step={2}
      title="Shipping address"
      description="Where the order should arrive."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Street address" htmlFor="checkout-street" className="sm:col-span-2">
          <Input
            id="checkout-street"
            name="address"
            required
            autoComplete="street-address"
            placeholder="House 12, Road 4"
            aria-invalid={Boolean(errors.address)}
          />
          <FieldError message={errors.address} />
        </Field>

        <Field
          label="Apartment, floor (optional)"
          htmlFor="checkout-apartment"
          className="sm:col-span-2"
        >
          <Input id="checkout-apartment" name="apartment" autoComplete="address-line2" placeholder="Apt 5B" />
        </Field>

        <Field label="City" htmlFor="checkout-city">
          {/* Native select: the browser owns the choice; the form reads it on submit */}
          <div className="relative">
            <select id="checkout-city" name="city" autoComplete="address-level2" className={SELECT}>
              {CITIES.map((city) => (
                <option key={city}>{city}</option>
              ))}
            </select>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-text-tertiary"
            >
              ▾
            </span>
          </div>
        </Field>

        <Field label="Postal code" htmlFor="checkout-postal">
          <Input id="checkout-postal" name="postalCode" autoComplete="postal-code" placeholder="1207" />
        </Field>

        <Field
          label="Delivery note (optional)"
          htmlFor="checkout-note"
          className="sm:col-span-2"
        >
          <Input id="checkout-note" name="note" maxLength={300} placeholder="Leave at reception" />
        </Field>
      </div>
    </CheckoutSection>
  );
}
