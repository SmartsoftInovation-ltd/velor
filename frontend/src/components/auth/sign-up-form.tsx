import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowRightIcon } from "@/components/ui/icons-auth";
import { MailIcon } from "@/components/ui/icons-footer";
import { LockIcon, UserIcon } from "@/components/ui/icons-nav";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { SocialButtons } from "./social-buttons";

/**
 * Placeholder-labelled fields, as in the design: each control carries a
 * leading icon and an `aria-label`, so the label is still announced even
 * though nothing is drawn above the box.
 *
 * Design only — no action, no validation. See `.claude/specs/auth.md`.
 */
export function SignUpForm() {
  return (
    <form className="space-y-3">
      <Input
        id="sign-up-name"
        aria-label="Full name"
        autoComplete="name"
        placeholder="Full name"
        icon={<UserIcon />}
      />

      <Input
        id="sign-up-email"
        type="email"
        aria-label="Email address"
        autoComplete="email"
        placeholder="Email address"
        icon={<MailIcon />}
      />

      <PasswordInput
        id="sign-up-password"
        aria-label="Password"
        autoComplete="new-password"
        placeholder="Password"
        icon={<LockIcon />}
      />

      <PasswordInput
        id="sign-up-confirm"
        aria-label="Confirm password"
        autoComplete="new-password"
        placeholder="Confirm password"
        icon={<LockIcon />}
      />

      <Checkbox
        name="terms"
        label={
          <>
            I agree to the{" "}
            <Link href="/terms" className="font-medium text-text-brand">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="font-medium text-text-brand">
              Privacy Policy
            </Link>
            .
          </>
        }
      />

      <Button type="submit" size="lg" fullWidth iconEnd={<ArrowRightIcon />}>
        Sign up
      </Button>

      <SocialButtons />
    </form>
  );
}
