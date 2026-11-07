import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { VisualReset } from "@/components/auth/visual-reset";
import { readResetProgress, RESET_COOKIE } from "@/lib/password-reset";
import { NO_INDEX } from "@/lib/seo";

export const metadata: Metadata = {
  robots: NO_INDEX,
  title: "Reset password",
  description: "Choose a new password for your account.",
};

export default async function ResetPasswordPage() {
  // Only after the code has been checked
  if (!readResetProgress((await cookies()).get(RESET_COOKIE)?.value)?.otp) redirect("/forgot-password");

  return (
    <AuthShell
      title="Set a new"
      titleAccent="password"
      description="Choose a new password. You'll be signed out everywhere and sign in again with it."
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
      <ResetPasswordForm />
    </AuthShell>
  );
}
