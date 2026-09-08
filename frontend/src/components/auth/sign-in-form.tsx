import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowRightIcon } from "@/components/ui/icons-auth";
import { MailIcon } from "@/components/ui/icons-footer";
import { LockIcon } from "@/components/ui/icons-nav";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { SocialButtons } from "./social-buttons";

/** Design only — no action, no validation. See `.claude/specs/auth.md`. */
export function SignInForm() {
  return (
    <form className="space-y-3">
      <Input
        id="sign-in-email"
        type="email"
        aria-label="Email address"
        autoComplete="email"
        placeholder="Email address"
        icon={<MailIcon />}
      />

      <PasswordInput
        id="sign-in-password"
        aria-label="Password"
        autoComplete="current-password"
        placeholder="Password"
        icon={<LockIcon />}
      />

      <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
        <Checkbox name="remember" label="Keep me signed in" />
        <Link
          href="/forgot-password"
          className="text-caption font-medium text-text-brand transition-opacity duration-150 hover:opacity-80"
        >
          Forgot password?
        </Link>
      </div>

      <Button type="submit" size="lg" fullWidth iconEnd={<ArrowRightIcon />}>
        Sign in
      </Button>

      <SocialButtons />
    </form>
  );
}
