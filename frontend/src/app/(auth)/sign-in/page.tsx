import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { VisualSignIn } from "@/components/auth/visual-sign-in";
import { SignInForm } from "@/components/auth/sign-in-form";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your ShoPzio account to track orders and save items.",
};

export default function SignInPage() {
  return (
    <AuthShell
      title="Welcome"
      titleAccent="back"
      description="Sign in to track orders, save items and check out faster."
      aside={{
        headline: "Everything you left,",
        script: "right where it was",
        note: "Your orders, saved sizes and cart follow you across every device — signed in.",
        visual: <VisualSignIn />,
      }}
      footer={
        <>
          New to ShoPzio?{" "}
          <Link
            href="/sign-up"
            className="font-medium text-text-brand transition-opacity duration-150 hover:opacity-80"
          >
            Create an account
          </Link>
        </>
      }
    >
      <SignInForm />
    </AuthShell>
  );
}
