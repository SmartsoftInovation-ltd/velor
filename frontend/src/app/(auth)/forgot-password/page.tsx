import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { VisualForgot } from "@/components/auth/visual-forgot";
import { Button } from "@/components/ui/button";
import { ArrowRightIcon } from "@/components/ui/icons-auth";
import { MailIcon } from "@/components/ui/icons-footer";
import { Input } from "@/components/ui/input";
import { NO_INDEX } from "@/lib/seo";

export const metadata: Metadata = {
  robots: NO_INDEX,
  title: "Forgot password",
  description: "Send a reset code to the email on your account.",
};

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Forgot your"
      titleAccent="password?"
      description="Enter your email and we'll send a 6-digit code to reset it."
      aside={{
        headline: "A code lands,",
        script: "not a password",
        note: "We email a short-lived code you type in yourself — your password is never sent.",
        visual: <VisualForgot />,
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
        <Input
          id="forgot-email"
          type="email"
          aria-label="Email address"
          autoComplete="email"
          icon={<MailIcon />}
          placeholder="Email address"
        />

        <Button type="submit" size="lg" fullWidth iconEnd={<ArrowRightIcon />}>
          Send reset code
        </Button>
      </form>
    </AuthShell>
  );
}
