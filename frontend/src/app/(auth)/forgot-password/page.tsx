import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { cookies } from "next/headers";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { VisualForgot } from "@/components/auth/visual-forgot";
import { readResetProgress, RESET_COOKIE } from "@/lib/password-reset";
import { NO_INDEX } from "@/lib/seo";

export const metadata: Metadata = {
  robots: NO_INDEX,
  title: "Forgot password",
  description: "Get a code by SMS to reset your password.",
};

export default async function ForgotPasswordPage() {
  // "Use a different number" comes back here with the last one filled in
  const progress = readResetProgress((await cookies()).get(RESET_COOKIE)?.value);

  return (
    <AuthShell
      title="Forgot your"
      titleAccent="password?"
      description="Enter the mobile number on your account and we'll text you a 6-digit code."
      aside={{
        headline: "A code lands,",
        script: "not a password",
        note: "We text a short-lived code you type in yourself. Your password is never sent.",
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
      <ForgotPasswordForm defaultPhone={progress?.phone} />
    </AuthShell>
  );
}
