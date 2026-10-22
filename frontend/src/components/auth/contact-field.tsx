"use client";

import { useState } from "react";
import { MailIcon, PhoneIcon } from "@/components/ui/icons-footer";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { FieldLabel } from "./field-label";

type Method = "email" | "phone";

const OPTIONS = [
  { value: "email", label: "Email", Icon: MailIcon, field: "Email address", placeholder: "you@example.com", hint: "You'll sign in with this email." },
  { value: "phone", label: "Mobile number", Icon: PhoneIcon, field: "Mobile number", placeholder: "01712345678", hint: "11 digits, starting with 01." },
] as const;

/**
 * Email or mobile number, whichever the shopper uses. Two full-width tabs say
 * the choice plainly; the field under them follows it, with a hint on what to
 * type. Both post as `contact`, with `method` saying which it is.
 */
export function ContactField({
  defaultMethod = "email",
  defaultValue = "",
  error,
  idPrefix = "sign-up",
  label = "Sign up with",
  showHint = true,
}: {
  defaultMethod?: Method;
  defaultValue?: string;
  error?: string;
  /** Keeps ids unique per form */
  idPrefix?: string;
  label?: string;
  /** Sign-in has no use for "you'll sign in with this"; it shows only errors */
  showHint?: boolean;
}) {
  const [method, setMethod] = useState<Method>(defaultMethod);
  const current = OPTIONS.find((option) => option.value === method) ?? OPTIONS[0];

  return (
    <div>
      <FieldLabel id={`${idPrefix}-with`} required>
        {label}
      </FieldLabel>
      <div role="radiogroup" aria-labelledby={`${idPrefix}-with`} className="mb-2.5 grid grid-cols-2 gap-1 rounded-lg bg-bg-sunken p-1">
        {OPTIONS.map(({ value, label, Icon }) => {
          const active = method === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setMethod(value)}
              className={cn(
                "flex h-9 items-center justify-center gap-2 rounded-md text-small font-medium transition-[background-color,color,box-shadow] duration-150 [&>svg]:size-4",
                active
                  ? "bg-bg-surface text-text-primary shadow-xs ring-1 ring-border-subtle"
                  : "text-text-secondary hover:text-text-primary",
              )}
            >
              <Icon className={active ? "text-text-brand" : undefined} />
              {label}
            </button>
          );
        })}
      </div>

      <input type="hidden" name="method" value={method} />
      {/* Remounted on switch so the browser offers the right autofill and keyboard */}
      <Input
        key={method}
        id={`${idPrefix}-contact`}
        name="contact"
        type={method === "email" ? "email" : "tel"}
        inputMode={method === "email" ? "email" : "tel"}
        autoComplete={method === "email" ? "email" : "tel"}
        aria-label={current.field}
        placeholder={current.placeholder}
        defaultValue={method === defaultMethod ? defaultValue : ""}
        icon={<current.Icon />}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || showHint ? `${idPrefix}-contact-help` : undefined}
        className={error ? "border-danger-solid" : undefined}
        required
      />
      {error || showHint ? (
        <p id={`${idPrefix}-contact-help`} className={cn("mt-1.5 text-micro", error ? "text-danger-text" : "text-text-tertiary")}>
          {error ?? current.hint}
        </p>
      ) : null}
    </div>
  );
}
