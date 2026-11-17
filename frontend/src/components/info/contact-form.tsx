"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { FormAlert } from "@/components/auth/form-alert";
import { FieldError } from "@/components/checkout/field-error";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { sendContactAction, type ContactFormState } from "@/lib/actions/contact";
import { CONTACT_LIMITS } from "@/lib/contact";

const TEXTAREA =
  "w-full resize-y rounded-md border border-border-default bg-bg-surface px-3 py-2 text-body text-text-primary shadow-xs transition-colors duration-150 placeholder:text-text-tertiary hover:border-border-strong focus-visible:border-border-brand focus-visible:outline-none";

/** The message box with its live character count; remounts with the form */
function MessageBox({ defaultValue, invalid }: { defaultValue?: string; invalid: boolean }) {
  const [length, setLength] = useState(defaultValue?.length ?? 0);
  return (
    <>
      <textarea
        id="contact-message"
        name="message"
        rows={5}
        placeholder="Tell us more about your inquiry..."
        maxLength={CONTACT_LIMITS.message}
        defaultValue={defaultValue}
        onChange={(e) => setLength(e.target.value.length)}
        aria-invalid={invalid}
        aria-describedby="contact-message-count"
        required
        className={TEXTAREA}
      />
      <p id="contact-message-count" className="mt-1 text-right text-micro text-text-tertiary">
        {length}/{CONTACT_LIMITS.message} characters
      </p>
    </>
  );
}

/** Send us a Message: the card beside the contact details */
export function ContactForm() {
  const [state, action, pending] = useActionState<ContactFormState, FormData>(sendContactAction, {});
  const errors = state.fieldErrors ?? {};
  // A new key after each send clears the form for the next message
  const formKey = state.sent ? "sent" : "draft";

  return (
    <section aria-labelledby="send-message" className="rounded-2xl border border-border-subtle bg-bg-surface p-6 shadow-lg sm:p-8">
      <h2 id="send-message" className="text-h3 font-semibold text-text-primary">Send us a Message</h2>
      <p className="mt-1 mb-6 text-small text-text-secondary">Fill out the form below and we&apos;ll get back to you as soon as possible.</p>

      <form key={formKey} action={action} className="space-y-4" noValidate>
        {state.sent ? (
          <p role="status" className="rounded-md border border-success-solid/30 bg-success-subtle px-3 py-2.5 text-small text-success-text">
            Thanks! Your message has been sent. We&apos;ll get back to you soon.
          </p>
        ) : null}
        {state.error ? <FormAlert>{state.error}</FormAlert> : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Your Name" htmlFor="contact-name">
            <Input id="contact-name" name="name" placeholder="John Doe" autoComplete="name" maxLength={CONTACT_LIMITS.name} defaultValue={state.values?.name} aria-invalid={Boolean(errors.name)} required />
            <FieldError message={errors.name} />
          </Field>
          <Field label="Email Address" htmlFor="contact-email">
            <Input id="contact-email" name="email" type="email" placeholder="john@example.com" autoComplete="email" maxLength={CONTACT_LIMITS.email} defaultValue={state.values?.email} aria-invalid={Boolean(errors.email)} required />
            <FieldError message={errors.email} />
          </Field>
        </div>

        <Field label="Subject" htmlFor="contact-subject">
          <Input id="contact-subject" name="subject" placeholder="How can we help you?" maxLength={CONTACT_LIMITS.subject} defaultValue={state.values?.subject} />
          <FieldError message={errors.subject} />
        </Field>

        <Field label="Message" htmlFor="contact-message">
          <MessageBox defaultValue={state.values?.message} invalid={Boolean(errors.message)} />
          <FieldError message={errors.message} />
        </Field>

        <Button type="submit" fullWidth disabled={pending}>
          {pending ? "Sending…" : "Send Message"}
        </Button>

        <p className="text-center text-micro text-text-tertiary">
          By submitting this form, you agree to our{" "}
          <Link href="/returns" className="text-text-brand hover:underline">Return Policy</Link> and{" "}
          <Link href="/shipping" className="text-text-brand hover:underline">Shipping Info</Link>.
        </p>
      </form>
    </section>
  );
}
