import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { VisualOtp } from "@/components/auth/visual-otp";
import { OtpForm } from "@/components/auth/otp-form";
import { maskPhone, readResetProgress, RESET_COOKIE, secondsLeft } from "@/lib/password-reset";
import { NO_INDEX } from "@/lib/seo";

export const metadata: Metadata = {
  robots: NO_INDEX,
  title: "Verify code",
  description: "Enter the 6-digit code we sent by SMS.",
};

export default async function VerifyOtpPage() {
  const progress = readResetProgress((await cookies()).get(RESET_COOKIE)?.value);
  if (!progress) redirect("/forgot-password");

  return (
    <AuthShell
      title="Enter the"
      titleAccent="code"
      description={`We texted a 6-digit code to ${maskPhone(progress.phone)}. It works for ${Math.round(progress.expiresIn / 60)} minutes.`}
      aside={{
        headline: "Six digits,",
        script: "a few minutes",
        note: "The code stops working when the timer runs out. Request a new one and this one dies.",
        visual: <VisualOtp />,
      }}
      footer={
        <Link
          href="/forgot-password"
          className="font-medium text-text-brand transition-opacity duration-150 hover:opacity-80"
        >
          Use a different number
        </Link>
      }
    >
      <OtpForm secondsLeft={secondsLeft(progress)} />
    </AuthShell>
  );
}
