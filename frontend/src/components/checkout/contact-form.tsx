import { CheckoutSection, Field } from "@/components/checkout/checkout-section";
import { Input } from "@/components/ui/input";

/** Static markup — no action, no validation. Design only. */
export function ContactForm() {
  return (
    <CheckoutSection
      step={1}
      title="Contact"
      description="We send order updates here."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Email" htmlFor="checkout-email" className="sm:col-span-2">
          <Input
            id="checkout-email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
          />
        </Field>

        <Field label="First name" htmlFor="checkout-first-name">
          <Input id="checkout-first-name" autoComplete="given-name" placeholder="Taufik" />
        </Field>

        <Field label="Last name" htmlFor="checkout-last-name">
          <Input id="checkout-last-name" autoComplete="family-name" placeholder="Islam" />
        </Field>

        <Field
          label="Phone"
          htmlFor="checkout-phone"
          hint="The courier calls this number before delivery."
          className="sm:col-span-2"
        >
          <Input
            id="checkout-phone"
            type="tel"
            autoComplete="tel"
            placeholder="+880 1XXX XXXXXX"
          />
        </Field>
      </div>
    </CheckoutSection>
  );
}
