import { CheckoutSection, Field } from "@/components/checkout/checkout-section";
import { FieldError } from "@/components/checkout/field-error";
import { Input } from "@/components/ui/input";
import type { CheckoutField } from "@/lib/checkout";
import type { CheckoutDraft } from "@/lib/checkout-draft";

const CITIES = ["Dhaka", "Chattogram", "Sylhet", "Khulna", "Rajshahi"] as const;

const SELECT =
  "h-10 w-full appearance-none rounded-md border border-border-default bg-bg-surface px-3 text-body text-text-primary shadow-xs transition-colors duration-150 ease-out hover:border-border-strong focus-visible:border-border-brand focus-visible:outline-none";

type Props = { errors?: Partial<Record<CheckoutField, string>>; draft?: CheckoutDraft | null };

export function AddressForm({ errors = {}, draft }: Props) {
  return (
    <CheckoutSection
      step={2}
      title="Shipping address"
      description="Where the order should arrive."
    >
      <div className="grid gap-4">
        <Field label="City" htmlFor="checkout-city">
          {/* Native select: the browser owns the choice; the form reads it on submit */}
          <div className="relative">
            <select id="checkout-city" name="city" defaultValue={draft?.city} autoComplete="address-level2" className={SELECT}>
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
          <FieldError message={errors.city} />
        </Field>

        <Field label="Address" htmlFor="checkout-address">
          <Input
            id="checkout-address"
            name="address"
            defaultValue={draft?.address}
            required
            autoComplete="street-address"
            placeholder="House 12, Road 4, Dhanmondi"
            aria-invalid={Boolean(errors.address)}
          />
          <FieldError message={errors.address} />
        </Field>
      </div>
    </CheckoutSection>
  );
}
