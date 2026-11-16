"use client";

import { useState } from "react";
import { CheckIcon } from "@/components/ui/icons-filter";
import { LockIcon } from "@/components/ui/icons-nav";
import { PasswordInput } from "@/components/ui/password-input";
import { cn } from "@/lib/cn";
import { PASSWORD_MIN } from "@/lib/shopper-auth";
import { FieldLabel } from "./field-label";

const RULES = [
  { label: `${PASSWORD_MIN}+ characters`, test: (p: string) => p.length >= PASSWORD_MIN },
  { label: "A number", test: (p: string) => /\d/.test(p) },
  { label: "A letter", test: (p: string) => /[a-z]/i.test(p) },
];

// Four steps; the last one needs every rule plus some extra length
const STRENGTH = ["Too short", "Weak", "Good", "Strong"] as const;

function strengthOf(password: string) {
  if (!password) return 0;
  const passed = RULES.filter((rule) => rule.test(password)).length;
  return passed === RULES.length && password.length >= PASSWORD_MIN + 4 ? 4 : passed;
}

/**
 * New password with a live strength bar and the rules it still misses, then
 * the confirmation, which says as soon as it matches. The server checks the
 * same rules again; this is guidance, not the gate.
 */
export function PasswordFields({
  errors,
  label = "Password",
}: {
  errors?: { password?: string; confirm?: string };
  /** "New password" when changing one */
  label?: string;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const strength = strengthOf(password);
  const matches = confirm.length > 0 && confirm === password;

  return (
    <div className="space-y-3">
      <div>
        <FieldLabel htmlFor="sign-up-password" required>
          {label}
        </FieldLabel>
        <PasswordInput
          id="sign-up-password"
          name="password"
          autoComplete="new-password"
          placeholder="Create a password"
          icon={<LockIcon />}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={errors?.password ? true : undefined}
          aria-describedby="sign-up-password-help"
          required
        />
        <div id="sign-up-password-help" className="mt-2 space-y-2">
          <div className="flex items-center gap-2">
            <div className="grid flex-1 grid-cols-4 gap-1" aria-hidden="true">
              {[1, 2, 3, 4].map((step) => (
                <span
                  key={step}
                  className={cn(
                    "h-1 rounded-full transition-colors duration-300",
                    step <= strength
                      ? strength >= 4 ? "bg-success-solid" : strength >= 3 ? "bg-brand-500" : "bg-warning-solid"
                      : "bg-bg-sunken",
                  )}
                />
              ))}
            </div>
            <span className="w-16 text-right text-micro text-text-tertiary" aria-live="polite">
              {password ? STRENGTH[Math.max(strength - 1, 0)] : ""}
            </span>
          </div>
          <ul className="flex flex-wrap gap-x-3 gap-y-1">
            {RULES.map((rule) => {
              const ok = rule.test(password);
              return (
                <li key={rule.label} className={cn("flex items-center gap-1 text-micro transition-colors", ok ? "text-success-text" : "text-text-tertiary")}>
                  <CheckIcon className={cn("size-3 transition-opacity", ok ? "opacity-100" : "opacity-30")} />
                  {rule.label}
                </li>
              );
            })}
          </ul>
          {errors?.password ? <p className="text-micro text-danger-text">{errors.password}</p> : null}
        </div>
      </div>

      <div>
        <FieldLabel htmlFor="sign-up-confirm" required>
          Confirm password
        </FieldLabel>
        <PasswordInput
          id="sign-up-confirm"
          name="confirm"
          autoComplete="new-password"
          placeholder="Type it again"
          icon={<LockIcon />}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          aria-invalid={errors?.confirm ? true : undefined}
          required
        />
        {matches ? (
          <p className="mt-1.5 flex items-center gap-1 text-micro text-success-text">
            <CheckIcon className="size-3" /> Passwords match
          </p>
        ) : errors?.confirm ? (
          <p className="mt-1.5 text-micro text-danger-text">{errors.confirm}</p>
        ) : null}
      </div>
    </div>
  );
}
