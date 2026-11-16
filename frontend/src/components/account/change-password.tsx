"use client";

import { useActionState, useState } from "react";
import { FieldLabel } from "@/components/auth/field-label";
import { FormAlert } from "@/components/auth/form-alert";
import { PasswordFields } from "@/components/auth/password-fields";
import { Button } from "@/components/ui/button";
import { ShieldCheckIcon } from "@/components/ui/icons";
import { LockIcon } from "@/components/ui/icons-nav";
import { PasswordInput } from "@/components/ui/password-input";
import { changePasswordAction, type PasswordState } from "@/lib/actions/account";
import { AccountCard } from "./account-card";
import { EditToggle } from "./edit-toggle";
import { SavedNote } from "./saved-note";

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
    <AccountCard
      id="change-password-title"
      icon={<ShieldCheckIcon />}
      title="Password & security"
      note="Changing your password signs you out on every other device."
      action={open ? null : <EditToggle label="Change" onClick={() => setOpen(true)} />}
    >
      {state.ok && !open ? <SavedNote>Your password was changed.</SavedNote> : null}

      {open ? (
        <form key={round} action={action} className="space-y-5" noValidate>
          {state.error ? <FormAlert>{state.error}</FormAlert> : null}
          <div className="max-w-md space-y-4">
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
          </div>
          <div className="flex flex-col-reverse gap-3 border-t border-border-subtle pt-5 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" disabled={pending} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Update password"}
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex items-center gap-3 rounded-xl bg-bg-sunken/60 px-4 py-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-bg-surface text-text-brand shadow-xs">
            <LockIcon className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-micro font-medium tracking-wide text-text-tertiary uppercase">Password</p>
            <p className="mt-0.5 text-body font-medium tracking-[0.3em] text-text-primary">••••••••</p>
          </div>
        </div>
      )}
    </AccountCard>
  );
}
