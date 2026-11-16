import { CheckoutSection, Field } from "@/components/checkout/checkout-section";
import { FieldError } from "@/components/checkout/field-error";
import { Input } from "@/components/ui/input";
import type { CheckoutField } from "@/lib/checkout";
import type { CheckoutDraft } from "@/lib/checkout-draft";

type Errors = Partial<Record<CheckoutField, string>>;

/** Plain inputs read by the checkout form on submit; errors come back from the server. */
export function ContactForm({ errors = {}, draft }: { errors?: Errors; draft?: CheckoutDraft | null }) {
  return (
    <CheckoutSection
      step={1}
      title="Contact"
      description="We send order updates here."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" htmlFor="checkout-full-name" className="sm:col-span-2">
          <Input
            id="checkout-full-name"
            name="fullName"
            defaultValue={draft?.fullName}
            required
            autoComplete="name"
            placeholder="Taufik Islam"
            aria-invalid={Boolean(errors.fullName)}
          />
          <FieldError message={errors.fullName} />
        </Field>

        <Field label="Phone" htmlFor="checkout-phone" hint="The courier calls this number before delivery.">
          <Input
            id="checkout-phone"
            name="phone"
            required
            type="tel"
            defaultValue={draft?.phone}
            aria-invalid={Boolean(errors.phone)}
            autoComplete="tel"
            placeholder="01XXXXXXXXX"
          />
          <FieldError message={errors.phone} />
        </Field>

        <Field label="Email (optional)" htmlFor="checkout-email">
          <Input
            id="checkout-email"
            name="email"
            type="email"
            defaultValue={draft?.email}
            aria-invalid={Boolean(errors.email)}
            autoComplete="email"
            placeholder="you@example.com"
          />
          <FieldError message={errors.email} />
        </Field>
      </div>
    </CheckoutSection>
  );
}
