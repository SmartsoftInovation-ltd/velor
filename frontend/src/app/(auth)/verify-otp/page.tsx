import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { VisualOtp } from "@/components/auth/visual-otp";
import { OtpForm } from "@/components/auth/otp-form";

export const metadata: Metadata = {
  title: "Verify code",
  description: "Enter the 6-digit code sent to your email to continue.",
};

export default function VerifyOtpPage() {
  return (
    <AuthShell
      title="Enter the"
      titleAccent="code"
      description="We sent a 6-digit code to your email. It is valid for 5 minutes."
      aside={{
        headline: "Six digits,",
        script: "five minutes",
        note: "The code stops working when the timer runs out. Request a new one and this one dies.",
        visual: <VisualOtp />,
      }}
      footer={
        <Link
          href="/forgot-password"
          className="font-medium text-text-brand transition-opacity duration-150 hover:opacity-80"
        >
          Use a different email
        </Link>
      }
    >
      <OtpForm />
    </AuthShell>
  );
}
