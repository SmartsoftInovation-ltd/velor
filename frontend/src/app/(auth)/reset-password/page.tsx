import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { VisualReset } from "@/components/auth/visual-reset";
import { Button } from "@/components/ui/button";
import { ArrowRightIcon, ShieldLockIcon } from "@/components/ui/icons-auth";
import { LockIcon } from "@/components/ui/icons-nav";
import { PasswordInput } from "@/components/ui/password-input";

const RULES = [
  "At least 8 characters",
  "One number or symbol",
  "Different from your last password",
];

export const metadata: Metadata = {
  title: "Reset password",
  description: "Choose a new password for your ShoPzio account.",
};

export default function ResetPasswordPage() {
  return (
    <AuthShell
      title="Set a new"
      titleAccent="password"
      description="Choose a password you haven't used on this account before."
      aside={{
        headline: "One strong password,",
        script: "used nowhere else",
        note: "A password you reuse is only as safe as the weakest site holding it.",
        visual: <VisualReset />,
      }}
      footer={
        <Link
          href="/sign-in"
          className="font-medium text-text-brand transition-opacity duration-150 hover:opacity-80"
        >
          Back to sign in
        </Link>
      }
    >
      {/* Design only — no action, no validation. */}
      <form className="space-y-3">
        <PasswordInput
          id="reset-password"
          aria-label="New password"
          autoComplete="new-password"
          placeholder="New password"
          icon={<LockIcon />}
        />

        <PasswordInput
          id="reset-password-confirm"
          aria-label="Confirm new password"
          autoComplete="new-password"
          placeholder="Confirm new password"
          icon={<LockIcon />}
        />

        <div className="rounded-md bg-bg-sunken p-3">
          <p className="mb-2 flex items-center gap-2 text-caption font-medium text-text-secondary">
            <ShieldLockIcon className="size-4 text-text-tertiary" />
            Your password should have
          </p>
          <ul className="space-y-1 pl-6">
            {RULES.map((rule) => (
              <li
                key={rule}
                className="relative text-caption text-text-tertiary before:absolute before:-left-3 before:top-2 before:size-1 before:rounded-full before:bg-text-tertiary"
              >
                {rule}
              </li>
            ))}
          </ul>
        </div>

        <Button type="submit" size="lg" fullWidth iconEnd={<ArrowRightIcon />}>
          Reset password
        </Button>
      </form>
    </AuthShell>
  );
}
