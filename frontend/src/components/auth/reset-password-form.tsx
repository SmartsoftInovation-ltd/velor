"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRightIcon } from "@/components/ui/icons-auth";
import { resetPasswordAction, type ResetFormState } from "@/lib/actions/password-reset";
import { FormAlert } from "./form-alert";
import { PasswordFields } from "./password-fields";

/** Step 3 of a reset: the new password, checked against the same rules as sign-up */
export function ResetPasswordForm() {
  const [state, action, pending] = useActionState<ResetFormState, FormData>(resetPasswordAction, {});

  return (
    <form action={action} className="space-y-4" noValidate>
      {state.error ? <FormAlert>{state.error}</FormAlert> : null}
      <PasswordFields errors={state.fieldErrors} />
      <Button type="submit" size="lg" fullWidth disabled={pending} iconEnd={pending ? undefined : <ArrowRightIcon />}>
        {pending ? "Saving…" : "Reset password"}
      </Button>
    </form>
  );
}
