"use client";

import { useActionState } from "react";
import { FieldLabel } from "@/components/auth/field-label";
import { FormAlert } from "@/components/auth/form-alert";
import { TrackResult } from "@/components/track/track-result";
import { Button } from "@/components/ui/button";
import { PhoneIcon } from "@/components/ui/icons-footer";
import { SearchIcon } from "@/components/ui/icons-nav";
import { Input } from "@/components/ui/input";
import { trackOrderAction, type TrackFormState } from "@/lib/actions/track";

type Field = "invoice" | "phone";

const FIELDS = [
  {
    name: "invoice",
    label: "Invoice number",
    placeholder: "INV-1A2B3C4D",
    hint: "Shown after checkout and in your confirmation message.",
    autoComplete: "off",
    inputMode: "text",
    type: "text",
  },
  {
    name: "phone",
    label: "Phone number",
    placeholder: "01712345678",
    hint: "The number you gave at checkout.",
    autoComplete: "tel-national",
    inputMode: "tel",
    type: "tel",
  },
] as const;

/**
 * The lookup. Both the invoice and the phone are needed: the result shows the
 * delivery address, so an invoice number alone must not be enough to read it.
 */
export function TrackForm() {
  const [state, action, pending] = useActionState<TrackFormState, FormData>(trackOrderAction, {});

  return (
    <div className="space-y-8">
      <form
        action={action}
        noValidate
        className="space-y-4 rounded-xl border border-border-subtle bg-bg-surface p-5 shadow-sm sm:p-6"
      >
        {state.error ? <FormAlert>{state.error}</FormAlert> : null}

        <div className="grid max-w-4xl gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-start">
          {FIELDS.map((field) => {
            const error = state.fieldErrors?.[field.name as Field];
            const id = `track-${field.name}`;
            return (
              <div key={field.name}>
                <FieldLabel htmlFor={id} required>
                  {field.label}
                </FieldLabel>
                <Input
                  key={state[field.name] ?? ""}
                  id={id}
                  name={field.name}
                  type={field.type}
                  inputMode={field.inputMode}
                  autoComplete={field.autoComplete}
                  placeholder={field.placeholder}
                  defaultValue={state[field.name] ?? ""}
                  icon={field.name === "phone" ? <PhoneIcon /> : <SearchIcon />}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={`${id}-hint`}
                  className={error ? "border-danger-solid" : undefined}
                  required
                />
                <p id={`${id}-hint`} className={error ? "mt-1.5 text-micro text-danger-text" : "mt-1.5 text-micro text-text-tertiary"}>
                  {error ?? field.hint}
                </p>
              </div>
            );
          })}

          <Button type="submit" variant="primary" size="md" disabled={pending} className="sm:mt-7 sm:w-32">
            {pending ? "Tracking…" : "Track"}
          </Button>
        </div>
      </form>

      {state.order ? <TrackResult order={state.order} /> : null}
    </div>
  );
}
