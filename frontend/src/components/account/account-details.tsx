"use client";

import { useActionState, useState } from "react";
import { FieldLabel } from "@/components/auth/field-label";
import { FormAlert } from "@/components/auth/form-alert";
import { Button } from "@/components/ui/button";
import { CheckCircleIcon } from "@/components/ui/icons-filter";
import { MailIcon, PhoneIcon } from "@/components/ui/icons-footer";
import { UserIcon } from "@/components/ui/icons-nav";
import { Input } from "@/components/ui/input";
import { updateProfileAction, type ProfileState } from "@/lib/actions/account";
import type { Shopper } from "@/lib/shopper-auth";

const FIELDS = [
  { key: "name", label: "Full name", Icon: UserIcon, type: "text", autoComplete: "name", placeholder: "Your full name" },
  { key: "email", label: "Email address", Icon: MailIcon, type: "email", autoComplete: "email", placeholder: "you@example.com" },
  { key: "phone", label: "Mobile number", Icon: PhoneIcon, type: "tel", autoComplete: "tel", placeholder: "01712345678" },
] as const;

/**
 * The details the shop holds for this account. Read first; "Edit" turns the
 * rows into a form. Email or mobile must stay, since one is the sign-in.
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
    <section
      aria-labelledby="account-details-title"
      className="rounded-xl border border-border-subtle bg-bg-surface p-6 shadow-xs"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="account-details-title" className="text-h3 font-semibold tracking-tight text-text-primary">
            Personal details
          </h2>
          <p className="mt-1 text-small text-text-secondary">What this shop uses to reach you about your orders.</p>
        </div>
        {!editing ? (
          <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
            Edit
          </Button>
        ) : null}
      </div>

      {state.ok && !editing ? (
        <p role="status" className="mt-4 flex items-center gap-1.5 text-small font-medium text-success-text">
          <CheckCircleIcon className="size-4" /> Your details were saved.
        </p>
      ) : null}

      {editing ? (
        <form action={action} className="mt-5 space-y-4" noValidate>
          {state.error ? <FormAlert>{state.error}</FormAlert> : null}
          {FIELDS.map(({ key, label, Icon, type, autoComplete, placeholder }) => {
            const error = state.fieldErrors?.[key];
            return (
              <div key={key}>
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
          <p className="text-micro text-text-tertiary">You sign in with your email or mobile number, so keep at least one.</p>
          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
            <Button type="button" variant="secondary" disabled={pending} onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <dl className="mt-5 divide-y divide-border-subtle">
          {FIELDS.map(({ key, label, Icon }) => (
            <div key={key} className="flex items-center gap-4 py-4 first:pt-0 last:pb-0">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-bg-sunken text-text-brand [&>svg]:size-4.5">
                <Icon />
              </span>
              <div className="min-w-0 flex-1">
                <dt className="text-caption text-text-tertiary">{label}</dt>
                <dd className="mt-0.5 truncate text-body font-medium text-text-primary">
                  {saved[key] || <span className="font-normal text-text-tertiary">Not added</span>}
                </dd>
              </div>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
