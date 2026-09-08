import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { VisualSignUp } from "@/components/auth/visual-sign-up";
import { SignUpForm } from "@/components/auth/sign-up-form";

export const metadata: Metadata = {
  title: "Create account",
  description: "Create a ShoPzio account to check out faster and track orders.",
};

export default function SignUpPage() {
  return (
    <AuthShell
      title="Create"
      titleAccent="your account"
      description="One account for orders, wishlists and faster checkout."
      aside={{
        headline: "Join once,",
        script: "save every time",
        note: "Members get first look at drops, restock alerts on their sizes, and free returns.",
        visual: <VisualSignUp />,
      }}
      footer={
        <>
          Already have an account?{" "}
          <Link
            href="/sign-in"
            className="font-medium text-text-brand transition-opacity duration-150 hover:opacity-80"
          >
            Sign in
          </Link>
        </>
      }
    >
      <SignUpForm />
    </AuthShell>
  );
}
