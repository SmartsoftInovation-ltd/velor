"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRightIcon } from "@/components/ui/icons-auth";
import { PhoneIcon } from "@/components/ui/icons-footer";
import { Input } from "@/components/ui/input";
import { requestResetCodeAction, type ResetFormState } from "@/lib/actions/password-reset";
import { FieldLabel } from "./field-label";
import { FormAlert } from "./form-alert";

/** Step 1 of a reset: the mobile number on the account, which gets the code by SMS */
export function ForgotPasswordForm({ defaultPhone = "" }: { defaultPhone?: string }) {
  const [state, action, pending] = useActionState<ResetFormState, FormData>(requestResetCodeAction, {});
  const error = state.fieldErrors?.phone;

  return (
    <form action={action} className="space-y-4" noValidate>
      {state.error ? <FormAlert>{state.error}</FormAlert> : null}

      <div>
        <FieldLabel htmlFor="forgot-phone" required>
          Mobile number
        </FieldLabel>
        <Input
          key={state.phone ?? defaultPhone}
          id="forgot-phone"
          name="phone"
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          icon={<PhoneIcon />}
          placeholder="01712345678"
          defaultValue={state.phone ?? defaultPhone}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "forgot-phone-error" : undefined}
          className={error ? "border-danger-solid" : undefined}
          required
        />
        {error ? (
          <p id="forgot-phone-error" className="mt-1.5 text-micro text-danger-text">
            {error}
          </p>
        ) : null}
      </div>

      <Button type="submit" size="lg" fullWidth disabled={pending} iconEnd={pending ? undefined : <ArrowRightIcon />}>
        {pending ? "Sending code…" : "Send reset code"}
      </Button>
    </form>
  );
}
