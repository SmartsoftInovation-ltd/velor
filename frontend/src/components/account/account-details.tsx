"use client";

import { useActionState, useState } from "react";
import { FieldLabel } from "@/components/auth/field-label";
import { FormAlert } from "@/components/auth/form-alert";
import { Button } from "@/components/ui/button";
import { MailIcon, PhoneIcon } from "@/components/ui/icons-footer";
import { UserIcon } from "@/components/ui/icons-nav";
import { Input } from "@/components/ui/input";
import { updateProfileAction, type ProfileState } from "@/lib/actions/account";
import { cn } from "@/lib/cn";
import type { Shopper } from "@/lib/shopper-auth";
import { AccountCard } from "./account-card";
import { EditToggle } from "./edit-toggle";
import { SavedNote } from "./saved-note";

const FIELDS = [
  { key: "name", label: "Full name", Icon: UserIcon, type: "text", autoComplete: "name", placeholder: "Your full name", wide: true },
  { key: "email", label: "Email address", Icon: MailIcon, type: "email", autoComplete: "email", placeholder: "you@example.com", wide: false },
  { key: "phone", label: "Mobile number", Icon: PhoneIcon, type: "tel", autoComplete: "tel", placeholder: "01712345678", wide: false },
] as const;

/**
 * The details the shop holds for this account. Read first; Edit turns the
 * tiles into a form. Email or mobile must stay, since one is the sign-in.
 */
export function AccountDetails({ user }: { user: Shopper }) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState<ProfileState, FormData>(async (prev, form) => {
    const next = await updateProfileAction(prev, form);
    if (next.ok) setEditing(false);
    return next;
  }, {});

  const saved = { name: user.name, email: user.email ?? "", phone: user.phone ?? "" };
  // After a failed save the form keeps what was typed
  const values = state.values && !state.ok ? state.values : saved;

  return (
    <AccountCard
      id="account-details-title"
      icon={<UserIcon />}
      title="Personal details"
      note="What this shop uses to reach you about your orders."
      action={editing ? null : <EditToggle label="Edit" onClick={() => setEditing(true)} />}
    >
      {state.ok && !editing ? <SavedNote>Your details were saved.</SavedNote> : null}

      {editing ? (
        <form action={action} className="space-y-5" noValidate>
          {state.error ? <FormAlert>{state.error}</FormAlert> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            {FIELDS.map(({ key, label, Icon, type, autoComplete, placeholder, wide }) => {
              const error = state.fieldErrors?.[key];
              return (
                <div key={key} className={cn(wide && "sm:col-span-2")}>
                  <FieldLabel htmlFor={`account-${key}`} required={key === "name"}>
                    {label}
                  </FieldLabel>
                  <Input
                    id={`account-${key}`}
                    name={key}
                    type={type}
                    autoComplete={autoComplete}
                    placeholder={placeholder}
                    defaultValue={values[key]}
                    icon={<Icon />}
                    className="h-11"
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? `account-${key}-error` : undefined}
                  />
                  {error ? (
                    <p id={`account-${key}-error`} className="mt-1.5 text-micro text-danger-text">
                      {error}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
          <p className="rounded-lg bg-bg-sunken px-3 py-2 text-caption text-text-secondary">
            You sign in with your email or mobile number, so keep at least one of them.
          </p>
          <div className="flex flex-col-reverse gap-3 border-t border-border-subtle pt-5 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" disabled={pending} onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      ) : (
        <dl className="grid gap-3 sm:grid-cols-2">
          {FIELDS.map(({ key, label, Icon, wide }) => (
            <div
              key={key}
              className={cn("flex items-center gap-3 rounded-xl bg-bg-sunken/60 px-4 py-3", wide && "sm:col-span-2")}
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-bg-surface text-text-brand shadow-xs [&>svg]:size-4">
                <Icon />
              </span>
              <div className="min-w-0 flex-1">
                <dt className="text-micro font-medium tracking-wide text-text-tertiary uppercase">{label}</dt>
                <dd className="mt-0.5 truncate text-body font-medium text-text-primary">
                  {saved[key] || <span className="font-normal text-text-tertiary">Not added</span>}
                </dd>
              </div>
            </div>
          ))}
        </dl>
      )}
    </AccountCard>
  );
}
