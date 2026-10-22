"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowRightIcon } from "@/components/ui/icons-auth";
import { UserIcon } from "@/components/ui/icons-nav";
import { Input } from "@/components/ui/input";
import { signUpAction, type SignUpState } from "@/lib/actions/auth";
import { ContactField } from "./contact-field";
import { FieldLabel, RequiredMark } from "./field-label";
import { PasswordFields } from "./password-fields";

const FieldError = ({ id, message }: { id: string; message?: string }) =>
  message ? (
    <p id={id} className="mt-1.5 text-micro text-danger-text">
      {message}
    </p>
  ) : null;

/**
 * Creates the account through a Server Action. The store is not part of the
 * form: the action reads it from the domain on the server. A failed submit
 * keeps what was typed (except passwords) and says what to fix next to it.
 */
export function SignUpForm({ storeName }: { storeName: string }) {
  const [state, action, pending] = useActionState<SignUpState, FormData>(signUpAction, {});
  const errors = state.fieldErrors ?? {};
  // A new key per failed submit remounts the inputs with the returned values
  const attempt = JSON.stringify(state.values ?? {});

  return (
    <form action={action} className="space-y-4" noValidate>
      {state.error ? (
        <p role="alert" className="rounded-md border border-danger-solid/30 bg-danger-subtle px-3 py-2.5 text-small text-danger-text">
          {state.error}
        </p>
      ) : null}

      <div className="animate-rise-in [animation-delay:60ms]">
        <FieldLabel htmlFor="sign-up-name" required>
          Full name
        </FieldLabel>
        <Input
          key={`name-${attempt}`}
          id="sign-up-name"
          name="name"
          autoComplete="name"
          placeholder="Your name"
          defaultValue={state.values?.name}
          icon={<UserIcon />}
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? "sign-up-name-error" : undefined}
          required
        />
        <FieldError id="sign-up-name-error" message={errors.name} />
      </div>

      <div className="animate-rise-in [animation-delay:120ms]">
        <ContactField
          key={`contact-${attempt}`}
          defaultMethod={state.values?.method}
          defaultValue={state.values?.contact}
          error={errors.contact}
        />
      </div>

      <div className="animate-rise-in [animation-delay:180ms]">
        <PasswordFields errors={errors} />
      </div>

      <div className="animate-rise-in [animation-delay:240ms]">
        <Checkbox
          name="terms"
          aria-invalid={errors.terms ? true : undefined}
          label={
            <>
              I agree to {storeName}&apos;s{" "}
              <Link href="/terms" className="font-medium text-text-brand">
                Terms
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="font-medium text-text-brand">
                Privacy Policy
              </Link>
              .
              <RequiredMark />
            </>
          }
        />
        <FieldError id="sign-up-terms-error" message={errors.terms} />
      </div>

      <div className="animate-rise-in [animation-delay:300ms]">
        <Button type="submit" size="lg" fullWidth disabled={pending} iconEnd={pending ? undefined : <ArrowRightIcon />}>
          {pending ? "Creating your account…" : "Create account"}
        </Button>
      </div>
    </form>
  );
}
