"use client";

import { useActionState, useState } from "react";
import { FieldLabel } from "@/components/auth/field-label";
import { FormAlert } from "@/components/auth/form-alert";
import { PasswordFields } from "@/components/auth/password-fields";
import { Button } from "@/components/ui/button";
import { CheckCircleIcon } from "@/components/ui/icons-filter";
import { LockIcon } from "@/components/ui/icons-nav";
import { PasswordInput } from "@/components/ui/password-input";
import { changePasswordAction, type PasswordState } from "@/lib/actions/account";

/**
 * Change password: the current one, then the new one with the same strength
 * rules as sign-up. Other devices are signed out; this one stays signed in.
 * The form is remounted after a change so the typed passwords are cleared.
 */
export function ChangePassword() {
  const [open, setOpen] = useState(false);
  const [round, setRound] = useState(0);
  const [state, action, pending] = useActionState<PasswordState, FormData>(async (prev, form) => {
    const next = await changePasswordAction(prev, form);
    if (next.ok) {
      setOpen(false);
      setRound((n) => n + 1);
    }
    return next;
  }, {});

  return (
    <section
      aria-labelledby="change-password-title"
      className="rounded-xl border border-border-subtle bg-bg-surface p-6 shadow-xs"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-bg-sunken text-text-brand [&>svg]:size-4.5">
            <LockIcon />
          </span>
          <div>
            <h2 id="change-password-title" className="text-h3 font-semibold tracking-tight text-text-primary">
              Password
            </h2>
            <p className="mt-1 text-small text-text-secondary">
              Changing it signs you out on every other device.
            </p>
          </div>
        </div>
        {!open ? (
          <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
            Change
          </Button>
        ) : null}
      </div>

      {state.ok && !open ? (
        <p role="status" className="mt-4 flex items-center gap-1.5 text-small font-medium text-success-text">
          <CheckCircleIcon className="size-4" /> Your password was changed.
        </p>
      ) : null}

      {open ? (
        <form key={round} action={action} className="mt-5 space-y-4" noValidate>
          {state.error ? <FormAlert>{state.error}</FormAlert> : null}
          <div>
            <FieldLabel htmlFor="current-password" required>
              Current password
            </FieldLabel>
            <PasswordInput
              id="current-password"
              name="current"
              autoComplete="current-password"
              placeholder="Your current password"
              icon={<LockIcon />}
              aria-invalid={state.fieldErrors?.current ? true : undefined}
              required
            />
            {state.fieldErrors?.current ? (
              <p className="mt-1.5 text-micro text-danger-text">{state.fieldErrors.current}</p>
            ) : null}
          </div>
          <PasswordFields label="New password" errors={state.fieldErrors} />
          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Update password"}
            </Button>
            <Button type="button" variant="secondary" disabled={pending} onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
