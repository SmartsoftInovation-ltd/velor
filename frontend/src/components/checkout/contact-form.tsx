import { CheckoutSection, Field } from "@/components/checkout/checkout-section";
import { FieldError } from "@/components/checkout/field-error";
import { Input } from "@/components/ui/input";
import type { CheckoutField } from "@/lib/checkout";

type Errors = Partial<Record<CheckoutField, string>>;

/** Plain inputs read by the checkout form on submit; errors come back from the server. */
export function ContactForm({ errors = {} }: { errors?: Errors }) {
  return (
    <CheckoutSection
      step={1}
      title="Contact"
      description="We send order updates here."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Email (optional)" htmlFor="checkout-email" className="sm:col-span-2">
          <Input
            id="checkout-email"
            name="email"
            type="email"
            aria-invalid={Boolean(errors.email)}
            autoComplete="email"
            placeholder="you@example.com"
          />
          <FieldError message={errors.email} />
        </Field>

        <Field label="First name" htmlFor="checkout-first-name">
          <Input
            id="checkout-first-name"
            name="firstName"
            required
            autoComplete="given-name"
            placeholder="Taufik"
            aria-invalid={Boolean(errors.firstName)}
          />
          <FieldError message={errors.firstName} />
        </Field>

        <Field label="Last name" htmlFor="checkout-last-name">
          <Input id="checkout-last-name" name="lastName" autoComplete="family-name" placeholder="Islam" />
        </Field>

        <Field
          label="Phone"
          htmlFor="checkout-phone"
          hint="The courier calls this number before delivery."
          className="sm:col-span-2"
        >
          <Input
            id="checkout-phone"
            name="phone"
            required
            type="tel"
            aria-invalid={Boolean(errors.phone)}
            autoComplete="tel"
            placeholder="01XXXXXXXXX"
          />
          <FieldError message={errors.phone} />
        </Field>
      </div>
    </CheckoutSection>
  );
}
