"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowRightIcon } from "@/components/ui/icons-auth";
import { LockIcon } from "@/components/ui/icons-nav";
import { PasswordInput } from "@/components/ui/password-input";
import { signInAction, type SignInState } from "@/lib/actions/auth";
import { ContactField } from "./contact-field";
import { FieldLabel } from "./field-label";

/**
 * Signs in through a Server Action, against the store this domain belongs to.
 * A failed submit keeps the email or number and says what went wrong; the
 * password is never sent back. `returnTo` is where to land after; `notice`
 * says why the shopper was sent here, until they submit.
 */
export function SignInForm({ returnTo = "/", notice }: { returnTo?: string; notice?: string }) {
  const [state, action, pending] = useActionState<SignInState, FormData>(signInAction, {});
  const errors = state.fieldErrors ?? {};
  // A new key per failed submit remounts the inputs with the returned values
  const attempt = JSON.stringify(state.values ?? {});

  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={returnTo} />
      {notice && !state.error && !state.fieldErrors ? (
        <p role="status" className="rounded-md border border-border-default bg-bg-sunken px-3 py-2.5 text-small text-text-secondary">
          {notice}
        </p>
      ) : null}
      {state.error ? (
        <p role="alert" className="rounded-md border border-danger-solid/30 bg-danger-subtle px-3 py-2.5 text-small text-danger-text">
          {state.error}
        </p>
      ) : null}

      <div className="animate-rise-in [animation-delay:60ms]">
        <ContactField
          key={`contact-${attempt}`}
          idPrefix="sign-in"
          label="Sign in with"
          showHint={false}
          defaultMethod={state.values?.method}
          defaultValue={state.values?.contact}
          error={errors.contact}
        />
      </div>

      <div className="animate-rise-in [animation-delay:120ms]">
        <div className="flex items-baseline justify-between gap-2">
          <FieldLabel htmlFor="sign-in-password" required>
            Password
          </FieldLabel>
          <Link
            href="/forgot-password"
            className="mb-1.5 text-caption font-medium text-text-brand transition-opacity duration-150 hover:opacity-80"
          >
            Forgot password?
          </Link>
        </div>
        <PasswordInput
          id="sign-in-password"
          name="password"
          autoComplete="current-password"
          placeholder="Your password"
          icon={<LockIcon />}
          aria-invalid={errors.password ? true : undefined}
          aria-describedby={errors.password ? "sign-in-password-error" : undefined}
          className={errors.password ? "border-danger-solid" : undefined}
          required
        />
        {errors.password ? (
          <p id="sign-in-password-error" className="mt-1.5 text-micro text-danger-text">
            {errors.password}
          </p>
        ) : null}
      </div>

      <div className="animate-rise-in [animation-delay:180ms]">
        <Checkbox name="remember" label="Keep me signed in" defaultChecked />
      </div>

      <div className="animate-rise-in [animation-delay:240ms]">
        <Button type="submit" size="lg" fullWidth disabled={pending} iconEnd={pending ? undefined : <ArrowRightIcon />}>
          {pending ? "Signing you in…" : "Sign in"}
        </Button>
      </div>
    </form>
  );
}
